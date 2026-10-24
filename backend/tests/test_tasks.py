import asyncio

import pytest

from tests.conftest import d


@pytest.fixture
async def world(make):
    """Two products with one sprint each, two developers, nothing else."""
    learn = await make.product(name="Learning Platform", tag="LEARN")
    pay = await make.product(name="Payments Gateway", tag="PAY")
    return {
        "learn": learn,
        "pay": pay,
        "s_learn": await make.sprint(learn, start=-10, end=10),
        "s_pay": await make.sprint(pay, start=-10, end=10),
        "alice": await make.developer(name="Alice"),
        "bob": await make.developer(name="Bob"),
    }


def body(sprint, **overrides):
    return {
        "title": "Build login page",
        "product_id": sprint["product_id"],
        "sprint_id": sprint["id"],
        "start_date": d(0),
        "end_date": d(2),
    } | overrides


async def test_create_task_generates_number_and_defaults(client, world):
    r = await client.post("/tasks", json=body(world["s_learn"], description="  "))
    assert r.status_code == 201
    task = r.json()
    assert task["number"] == "LEARN-101"
    assert (task["severity"], task["status"]) == ("Medium", "To Do")
    assert task["description"] is None
    assert task["developer"] is None
    assert task["product"] == {
        "id": world["learn"]["id"],
        "name": "Learning Platform",
        "tag": "LEARN",
    }
    assert task["sprint"]["number"] == 1


async def test_numbers_are_sequential_per_product(client, world, make):
    numbers = [(await make.task(world["s_learn"]))["number"] for _ in range(3)]
    numbers.append((await make.task(world["s_pay"]))["number"])
    assert numbers == ["LEARN-101", "LEARN-102", "LEARN-103", "PAY-101"]


async def test_numbers_unique_under_concurrent_creation(client, world):
    responses = await asyncio.gather(
        *[client.post("/tasks", json=body(world["s_learn"], title=f"Task {i}")) for i in range(20)]
    )
    assert all(r.status_code == 201 for r in responses), [r.text for r in responses]
    numbers = sorted(int(r.json()["number"].split("-")[1]) for r in responses)
    assert numbers == list(range(101, 121))


async def test_number_is_immutable(client, world, make):
    task = await make.task(world["s_learn"])
    r = await client.patch(f"/tasks/{task['id']}", json={"number": "LEARN-999"})
    assert r.status_code == 422


async def test_sprint_must_belong_to_product(client, world):
    r = await client.post("/tasks", json=body(world["s_pay"], product_id=world["learn"]["id"]))
    assert r.status_code == 422
    error = r.json()["error"]
    assert error["code"] == "sprint_product_mismatch"
    assert "sprint_id" in error["details"]["fields"]


async def test_invalid_task_dates(client, world):
    r = await client.post("/tasks", json=body(world["s_learn"], start_date=d(3), end_date=d(1)))
    assert r.status_code == 422

    r = await client.post("/tasks", json=body(world["s_learn"], start_date=d(-11)))
    assert r.status_code == 422
    assert "start_date" in r.json()["error"]["details"]["fields"]

    r = await client.post("/tasks", json=body(world["s_learn"], end_date=d(11)))
    assert r.status_code == 422
    assert "end_date" in r.json()["error"]["details"]["fields"]


async def test_title_and_enum_validation(client, world):
    r = await client.post(
        "/tasks", json=body(world["s_learn"], title="ab", severity="Urgent", status="Doing")
    )
    assert r.status_code == 422
    assert {"title", "severity", "status"} <= set(r.json()["error"]["details"]["fields"])

    r = await client.post("/tasks", json=body(world["s_learn"], description="x" * 5001))
    assert r.status_code == 422


async def test_unknown_references_are_422(client, world):
    missing = "0123456789abcdef01234567"
    r = await client.post("/tasks", json=body(world["s_learn"], developer_id=missing))
    assert r.status_code == 422
    assert "developer_id" in r.json()["error"]["details"]["fields"]

    r = await client.post("/tasks", json=body(world["s_learn"], sprint_id="not-an-id"))
    assert r.status_code == 422


async def test_product_cannot_change_but_sprint_can_within_product(client, world, make):
    task = await make.task(world["s_learn"], start=1, end=2)
    r = await client.patch(f"/tasks/{task['id']}", json={"product_id": world["pay"]["id"]})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "product_immutable"

    r = await client.patch(f"/tasks/{task['id']}", json={"sprint_id": world["s_pay"]["id"]})
    assert r.status_code == 422

    other = await make.sprint(world["learn"], start=0, end=5)
    r = await client.patch(f"/tasks/{task['id']}", json={"sprint_id": other["id"]})
    assert r.status_code == 200
    assert r.json()["sprint"]["number"] == 2

    # Moving to a sprint whose range doesn't cover the task is rejected.
    late = await make.sprint(world["learn"], start=20, end=30)
    r = await client.patch(f"/tasks/{task['id']}", json={"sprint_id": late["id"]})
    assert r.status_code == 422
    r = await client.patch(
        f"/tasks/{task['id']}",
        json={"sprint_id": late["id"], "start_date": d(21), "end_date": d(22)},
    )
    assert r.status_code == 200


async def test_quick_edits(client, world, make):
    task = await make.task(world["s_learn"])
    r = await client.patch(f"/tasks/{task['id']}/status", json={"status": "In Progress"})
    assert r.json()["status"] == "In Progress"
    r = await client.patch(f"/tasks/{task['id']}/severity", json={"severity": "Critical"})
    assert r.json()["severity"] == "Critical"
    r = await client.patch(
        f"/tasks/{task['id']}/assignee", json={"developer_id": world["bob"]["id"]}
    )
    assert r.json()["developer"]["name"] == "Bob"
    r = await client.patch(f"/tasks/{task['id']}/assignee", json={"developer_id": None})
    assert r.json()["developer_id"] is None


async def test_delete_task(client, world, make):
    task = await make.task(world["s_learn"])
    assert (await client.delete(f"/tasks/{task['id']}")).status_code == 204
    assert (await client.delete(f"/tasks/{task['id']}")).status_code == 404


async def test_search_filters_sort_and_pagination(client, world, make):
    a, b = world["alice"]["id"], world["bob"]["id"]
    s_learn, s_pay = world["s_learn"], world["s_pay"]
    await make.task(s_learn, title="Login page", developer_id=a, severity="High", end=5)
    await make.task(s_learn, title="Logout flow", developer_id=b, severity="Low", status="Done")
    await make.task(s_learn, title="Course catalog", severity="Critical", status="Blocked")
    await make.task(s_pay, title="Refund login audit", developer_id=a, status="In Progress")
    await make.task(s_pay, title="Card tokenization", developer_id=b, severity="Critical")

    async def numbers(**params):
        r = await client.get("/tasks", params=params)
        assert r.status_code == 200, r.text
        return [t["number"] for t in r.json()["items"]]

    # Search: partial, case-insensitive, on title or number.
    assert await numbers(q="LOGIN") == ["LEARN-101", "PAY-101"]
    assert await numbers(q="pay-10") == ["PAY-101", "PAY-102"]
    assert await numbers(q="learn-103") == ["LEARN-103"]
    assert await numbers(q="(unbalanced[") == []

    # Each filter.
    assert await numbers(product_id=world["pay"]["id"]) == ["PAY-101", "PAY-102"]
    assert await numbers(sprint_id=s_learn["id"]) == ["LEARN-101", "LEARN-102", "LEARN-103"]
    assert await numbers(developer_id=a) == ["LEARN-101", "PAY-101"]
    assert await numbers(developer_id="unassigned") == ["LEARN-103"]
    assert await numbers(severity="Critical") == ["LEARN-103", "PAY-102"]
    assert await numbers(status="Done") == ["LEARN-102"]
    assert await numbers(status=["Done", "Blocked"]) == ["LEARN-102", "LEARN-103"]

    # Combined filters.
    assert await numbers(developer_id=b, severity="Critical") == ["PAY-102"]
    assert await numbers(q="lo", product_id=world["learn"]["id"], status="To Do") == ["LEARN-101"]

    # Sorting.
    assert (await numbers(sort="-number"))[0] == "PAY-102"
    assert (await numbers(sort="severity"))[:2] == ["LEARN-103", "PAY-102"]
    assert (await numbers(sort="-end_date"))[0] == "LEARN-101"

    # Pagination.
    r = await client.get("/tasks", params={"page": 2, "page_size": 2})
    page = r.json()
    assert (page["total"], page["pages"], page["page"]) == (5, 3, 2)
    assert [t["number"] for t in page["items"]] == ["LEARN-103", "PAY-101"]

    # Invalid filter values are a 422, never a 500.
    assert (await client.get("/tasks", params={"product_id": "nope"})).status_code == 422
    assert (await client.get("/tasks", params={"severity": "Urgent"})).status_code == 422
    assert (await client.get("/tasks", params={"sort": "random"})).status_code == 422


async def test_overdue_flag_and_filter(client, make):
    product = await make.product()
    past = await make.sprint(product, start=-20, end=-5)
    late = await make.task(past, start=-15, end=-10)
    await make.task(past, start=-15, end=-10, status="Done")
    current = await make.sprint(product, start=-1, end=10)
    await make.task(current, start=0, end=5)

    r = await client.get("/tasks", params={"overdue": "true"})
    assert [t["number"] for t in r.json()["items"]] == [late["number"]]
    assert r.json()["items"][0]["is_overdue"] is True
