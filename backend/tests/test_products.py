async def test_create_product_uppercases_tag(client):
    r = await client.post("/products", json={"name": "Learning Platform", "tag": " learn "})
    assert r.status_code == 201
    product = r.json()
    assert product["tag"] == "LEARN"
    assert product["tag_locked"] is False


async def test_invalid_tag_rejected(client):
    for tag in ["A", "TOOLONGTAG", "AB-C", "ÄB"]:
        r = await client.post("/products", json={"name": f"Prod {tag}", "tag": tag})
        assert r.status_code == 422, tag
        assert "tag" in r.json()["error"]["details"]["fields"]


async def test_duplicate_name_case_insensitive_and_duplicate_tag(client, make):
    await make.product(name="Payments Gateway", tag="PAY")

    r = await client.post("/products", json={"name": "payments gateway", "tag": "PAY2"})
    assert r.status_code == 409
    assert "name" in r.json()["error"]["details"]["fields"]

    r = await client.post("/products", json={"name": "Another", "tag": "pay"})
    assert r.status_code == 409
    assert "tag" in r.json()["error"]["details"]["fields"]


async def test_tag_immutable_once_product_has_tasks(client, make):
    product = await make.product(tag="MOBI")
    r = await client.patch(f"/products/{product['id']}", json={"tag": "MOB"})
    assert r.status_code == 200 and r.json()["tag"] == "MOB"

    await make.task(await make.sprint(product))
    r = await client.get(f"/products/{product['id']}")
    assert r.json()["tag_locked"] is True

    r = await client.patch(f"/products/{product['id']}", json={"tag": "MOBILE"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "tag_locked"

    # Re-sending the same tag together with other edits is fine.
    r = await client.patch(f"/products/{product['id']}", json={"tag": "mob", "description": "Apps"})
    assert r.status_code == 200
    assert r.json()["description"] == "Apps"


async def test_product_counts_and_detail_lists(client, make):
    product = await make.product()
    sprint = await make.sprint(product)
    await make.task(sprint)
    await make.task(sprint, status="Done")

    r = await client.get(f"/products/{product['id']}")
    body = r.json()
    assert (body["sprint_count"], body["task_count"], body["open_task_count"]) == (1, 2, 1)

    assert (await client.get(f"/products/{product['id']}/sprints")).json()["total"] == 1
    assert (await client.get(f"/products/{product['id']}/tasks")).json()["total"] == 2


async def test_delete_product_blocked_when_in_use(client, make):
    product = await make.product()
    sprint = await make.sprint(product)

    r = await client.delete(f"/products/{product['id']}")
    assert r.status_code == 409
    assert r.json()["error"]["details"] == {"sprint_count": 1, "task_count": 0}

    await client.delete(f"/sprints/{sprint['id']}")
    r = await client.delete(f"/products/{product['id']}")
    assert r.status_code == 204


async def test_list_products_search(client, make):
    await make.product(name="Learning Platform", tag="LEARN")
    await make.product(name="Mobile App", tag="MOBI")
    r = await client.get("/products", params={"q": "learn"})
    assert [p["tag"] for p in r.json()["items"]] == ["LEARN"]
