async def test_create_and_get_developer(client):
    r = await client.post(
        "/developers", json={"name": "Ada Lovelace", "email": "Ada@Example.COM", "role": "Backend"}
    )
    assert r.status_code == 201
    dev = r.json()
    assert dev["email"] == "ada@example.com"
    assert dev["is_active"] is True
    assert dev["task_count"] == 0

    r = await client.get(f"/developers/{dev['id']}")
    assert r.status_code == 200
    assert r.json()["name"] == "Ada Lovelace"


async def test_duplicate_email_is_case_insensitive_409(client, make):
    await make.developer(email="grace@example.com")
    r = await client.post(
        "/developers", json={"name": "Other", "email": "GRACE@example.com", "role": "QA"}
    )
    assert r.status_code == 409
    error = r.json()["error"]
    assert error["code"] == "duplicate"
    assert "email" in error["details"]["fields"]


async def test_update_to_duplicate_email_is_409(client, make):
    await make.developer(email="taken@example.com")
    dev = await make.developer()
    r = await client.patch(f"/developers/{dev['id']}", json={"email": "Taken@example.com"})
    assert r.status_code == 409


async def test_update_developer_partial(client, make):
    dev = await make.developer(role="QA")
    r = await client.patch(f"/developers/{dev['id']}", json={"role": "DevOps"})
    assert r.status_code == 200
    assert r.json()["role"] == "DevOps"
    assert r.json()["name"] == dev["name"]


async def test_invalid_email_and_role_rejected(client):
    r = await client.post("/developers", json={"name": "X Y", "email": "bad", "role": "Boss"})
    assert r.status_code == 422
    assert {"email", "role"} <= set(r.json()["error"]["details"]["fields"])


async def test_search_and_active_filter(client, make):
    await make.developer(name="Alice Smith", email="alice@example.com")
    await make.developer(name="Bob Jones", email="bob@corp.io")
    inactive = await make.developer(name="Carol Smith", email="carol@example.com")
    await client.post(f"/developers/{inactive['id']}/deactivate")

    r = await client.get("/developers", params={"q": "smith"})
    assert {d["name"] for d in r.json()["items"]} == {"Alice Smith", "Carol Smith"}

    r = await client.get("/developers", params={"q": "CORP"})
    assert [d["name"] for d in r.json()["items"]] == ["Bob Jones"]

    r = await client.get("/developers", params={"is_active": "false"})
    assert [d["name"] for d in r.json()["items"]] == ["Carol Smith"]

    r = await client.get("/developers", params={"page_size": 2, "page": 2})
    body = r.json()
    assert body["total"] == 3 and body["pages"] == 2 and len(body["items"]) == 1


async def test_delete_developer_without_tasks(client, make):
    dev = await make.developer()
    r = await client.delete(f"/developers/{dev['id']}")
    assert r.status_code == 204
    assert (await client.get(f"/developers/{dev['id']}")).status_code == 404


async def test_delete_developer_with_tasks_blocked(client, make):
    dev = await make.developer()
    sprint = await make.sprint(await make.product())
    await make.task(sprint, developer_id=dev["id"])
    await make.task(sprint, developer_id=dev["id"], status="Done")

    r = await client.delete(f"/developers/{dev['id']}")
    assert r.status_code == 409
    error = r.json()["error"]
    assert error["code"] == "developer_has_tasks"
    assert error["details"] == {"task_count": 2, "open_task_count": 1}
    assert (await client.get(f"/developers/{dev['id']}")).status_code == 200


async def test_deactivate_keeps_tasks_and_blocks_new_assignment(client, make):
    dev = await make.developer()
    sprint = await make.sprint(await make.product())
    task = await make.task(sprint, developer_id=dev["id"])

    r = await client.post(f"/developers/{dev['id']}/deactivate")
    assert r.status_code == 200
    assert r.json()["is_active"] is False
    assert r.json()["open_task_count"] == 1

    # Existing task keeps its assignee and can still be edited without reassigning.
    r = await client.patch(f"/tasks/{task['id']}", json={"title": "Renamed task", "status": "Done"})
    assert r.status_code == 200
    assert r.json()["developer_id"] == dev["id"]

    # New assignments are rejected.
    other = await make.task(sprint)
    r = await client.patch(f"/tasks/{other['id']}/assignee", json={"developer_id": dev["id"]})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "developer_inactive"

    r = await client.post(
        "/tasks",
        json={
            "title": "New one",
            "product_id": sprint["product_id"],
            "sprint_id": sprint["id"],
            "developer_id": dev["id"],
            "start_date": sprint["start_date"],
            "end_date": sprint["start_date"],
        },
    )
    assert r.status_code == 422
    assert "developer_id" in r.json()["error"]["details"]["fields"]

    r = await client.post(f"/developers/{dev['id']}/activate")
    assert r.json()["is_active"] is True
    r = await client.patch(f"/tasks/{other['id']}/assignee", json={"developer_id": dev["id"]})
    assert r.status_code == 200


async def test_reassign_open_tasks(client, make):
    source, target = await make.developer(), await make.developer()
    sprint = await make.sprint(await make.product())
    open_task = await make.task(sprint, developer_id=source["id"])
    done_task = await make.task(sprint, developer_id=source["id"], status="Done")

    r = await client.post(
        f"/developers/{source['id']}/reassign-tasks", json={"target_developer_id": target["id"]}
    )
    assert r.status_code == 200
    assert r.json()["moved"] == 1
    assert (await client.get(f"/tasks/{open_task['id']}")).json()["developer_id"] == target["id"]
    assert (await client.get(f"/tasks/{done_task['id']}")).json()["developer_id"] == source["id"]


async def test_reassign_to_inactive_developer_rejected(client, make):
    source, target = await make.developer(), await make.developer()
    await client.post(f"/developers/{target['id']}/deactivate")
    r = await client.post(
        f"/developers/{source['id']}/reassign-tasks", json={"target_developer_id": target["id"]}
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "developer_inactive"


async def test_developer_tasks_endpoint(client, make):
    dev = await make.developer()
    sprint = await make.sprint(await make.product())
    await make.task(sprint, developer_id=dev["id"])
    await make.task(sprint)
    r = await client.get(f"/developers/{dev['id']}/tasks")
    assert r.status_code == 200
    assert r.json()["total"] == 1
