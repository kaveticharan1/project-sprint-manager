from tests.conftest import d


async def test_create_sprint_defaults_number_and_state(client, make):
    product = await make.product()
    first = await make.sprint(product, start=-20, end=-10)
    second = await make.sprint(product, start=-3, end=3, name="Current", goal="Ship it")
    third = await make.sprint(product, start=10, end=20)
    assert (first["number"], second["number"], third["number"]) == (1, 2, 3)
    assert (first["state"], second["state"], third["state"]) == ("Completed", "Active", "Upcoming")
    assert second["product"]["tag"] == product["tag"]
    assert second["status_counts"] == {"To Do": 0, "In Progress": 0, "Blocked": 0, "Done": 0}


async def test_duplicate_sprint_number_in_same_product_409(client, make):
    product = await make.product()
    await make.sprint(product, number=4)
    r = await client.post(
        "/sprints",
        json={"product_id": product["id"], "number": 4, "start_date": d(0), "end_date": d(1)},
    )
    assert r.status_code == 409
    assert "number" in r.json()["error"]["details"]["fields"]

    # Same number in another product is fine.
    await make.sprint(await make.product(), number=4)


async def test_invalid_sprint_dates(client, make):
    product = await make.product()
    r = await client.post(
        "/sprints", json={"product_id": product["id"], "start_date": d(5), "end_date": d(1)}
    )
    assert r.status_code == 422

    r = await client.post(
        "/sprints", json={"product_id": product["id"], "start_date": "2025-02-30", "end_date": d(1)}
    )
    assert r.status_code == 422
    assert "start_date" in r.json()["error"]["details"]["fields"]

    sprint = await make.sprint(product)
    r = await client.patch(f"/sprints/{sprint['id']}", json={"end_date": d(-30)})
    assert r.status_code == 422


async def test_sprint_for_unknown_product_is_422(client):
    r = await client.post(
        "/sprints",
        json={"product_id": "0123456789abcdef01234567", "start_date": d(0), "end_date": d(1)},
    )
    assert r.status_code == 422
    assert "product_id" in r.json()["error"]["details"]["fields"]


async def test_sprint_date_edit_that_orphans_tasks_rejected(client, make):
    sprint = await make.sprint(await make.product(), start=-10, end=10)
    inside = await make.task(sprint, start=-2, end=2)
    edge = await make.task(sprint, start=5, end=9)

    r = await client.patch(f"/sprints/{sprint['id']}", json={"end_date": d(6)})
    assert r.status_code == 409
    error = r.json()["error"]
    assert error["code"] == "sprint_dates_conflict"
    assert error["details"]["task_numbers"] == [edge["number"]]

    # A range that still contains every task is accepted.
    r = await client.patch(f"/sprints/{sprint['id']}", json={"start_date": d(-2), "end_date": d(9)})
    assert r.status_code == 200
    assert (r.json()["start_date"], r.json()["end_date"]) == (d(-2), d(9))
    assert (await client.get(f"/tasks/{inside['id']}")).json()["sprint_id"] == sprint["id"]


async def test_sprint_product_change_blocked_when_it_has_tasks(client, make):
    product, other = await make.product(), await make.product()
    sprint = await make.sprint(product)
    r = await client.patch(f"/sprints/{sprint['id']}", json={"product_id": other["id"]})
    assert r.status_code == 200 and r.json()["product_id"] == other["id"]

    await make.task(r.json())
    r = await client.patch(f"/sprints/{sprint['id']}", json={"product_id": product["id"]})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "sprint_has_tasks"


async def test_delete_sprint_with_tasks_blocked(client, make):
    sprint = await make.sprint(await make.product())
    await make.task(sprint)
    r = await client.delete(f"/sprints/{sprint['id']}")
    assert r.status_code == 409
    assert r.json()["error"]["details"] == {"task_count": 1}


async def test_move_tasks_then_delete(client, make):
    product = await make.product()
    source = await make.sprint(product, start=-10, end=10)
    target = await make.sprint(product, start=-5, end=5)
    tasks = [await make.task(source, start=-1, end=1) for _ in range(3)]

    r = await client.post(
        f"/sprints/{source['id']}/move-tasks",
        json={"target_sprint_id": target["id"], "delete_source": True},
    )
    assert r.status_code == 200
    assert r.json() == {
        "moved": 3,
        "adjusted": 0,
        "source_deleted": True,
        "target_sprint_id": target["id"],
    }
    assert (await client.get(f"/sprints/{source['id']}")).status_code == 404
    for task in tasks:
        moved = (await client.get(f"/tasks/{task['id']}")).json()
        assert moved["sprint_id"] == target["id"]
        assert moved["number"] == task["number"]
    assert (await client.get(f"/sprints/{target['id']}")).json()["task_count"] == 3


async def test_move_tasks_date_conflicts_reject_or_clamp(client, make):
    product = await make.product()
    source = await make.sprint(product, start=-10, end=10)
    target = await make.sprint(product, start=0, end=5)
    outside = await make.task(source, start=-8, end=-6)
    await make.task(source, start=1, end=2)

    r = await client.post(
        f"/sprints/{source['id']}/move-tasks", json={"target_sprint_id": target["id"]}
    )
    assert r.status_code == 409
    assert r.json()["error"]["details"]["task_numbers"] == [outside["number"]]
    # Nothing moved: the whole operation is one transaction.
    assert (await client.get(f"/sprints/{source['id']}")).json()["task_count"] == 2

    r = await client.post(
        f"/sprints/{source['id']}/move-tasks",
        json={"target_sprint_id": target["id"], "date_strategy": "clamp"},
    )
    assert r.status_code == 200
    assert r.json()["adjusted"] == 1
    moved = (await client.get(f"/tasks/{outside['id']}")).json()
    assert (moved["start_date"], moved["end_date"]) == (d(0), d(0))


async def test_move_tasks_to_other_product_rejected(client, make):
    source = await make.sprint(await make.product())
    foreign = await make.sprint(await make.product())
    r = await client.post(
        f"/sprints/{source['id']}/move-tasks", json={"target_sprint_id": foreign["id"]}
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "sprint_product_mismatch"


async def test_filter_sprints_by_product_and_state(client, make):
    p1, p2 = await make.product(), await make.product()
    await make.sprint(p1, start=-20, end=-10)
    await make.sprint(p1, start=-1, end=1)
    await make.sprint(p2, start=-1, end=1)

    r = await client.get("/sprints", params={"product_id": p1["id"]})
    assert r.json()["total"] == 2
    r = await client.get("/sprints", params={"state": "Active"})
    assert r.json()["total"] == 2
    r = await client.get("/sprints", params={"product_id": p1["id"], "state": "Completed"})
    assert r.json()["total"] == 1


async def test_sprint_status_breakdown(client, make):
    sprint = await make.sprint(await make.product())
    for status in ["To Do", "Done", "Done", "Blocked"]:
        await make.task(sprint, status=status)
    body = (await client.get(f"/sprints/{sprint['id']}")).json()
    assert body["task_count"] == 4
    assert body["status_counts"] == {"To Do": 1, "In Progress": 0, "Blocked": 1, "Done": 2}
    assert (await client.get(f"/sprints/{sprint['id']}/tasks")).json()["total"] == 4
