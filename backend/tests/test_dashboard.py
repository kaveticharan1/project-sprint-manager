async def test_empty_dashboard(client):
    r = await client.get("/dashboard/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["totals"]["tasks"] == 0
    assert body["tasks_by_status"] == {"To Do": 0, "In Progress": 0, "Blocked": 0, "Done": 0}
    assert body["tasks_by_severity"] == {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}


async def test_dashboard_summary_numbers(client, make):
    alice = await make.developer(name="Alice")
    bob = await make.developer(name="Bob")
    await client.post(f"/developers/{bob['id']}/deactivate")
    learn = await make.product(name="Learning", tag="LEARN")
    pay = await make.product(name="Payments", tag="PAY")
    past = await make.sprint(learn, start=-30, end=-15)
    current = await make.sprint(learn, start=-5, end=10)
    await make.sprint(pay, start=5, end=20)

    await make.task(past, start=-20, end=-16, severity="Critical", developer_id=alice["id"])
    await make.task(past, start=-20, end=-16, status="Done", developer_id=alice["id"])
    await make.task(current, start=0, end=3, severity="High", status="In Progress")
    await make.task(current, start=0, end=9, severity="Low", status="Blocked")

    body = (await client.get("/dashboard/summary")).json()
    totals = body["totals"]
    assert totals == {
        "developers": 2,
        "active_developers": 1,
        "products": 2,
        "sprints": 3,
        "active_sprints": 1,
        "tasks": 4,
        "open_tasks": 3,
        "overdue_tasks": 1,
        "unassigned_tasks": 2,
    }
    assert body["tasks_by_status"] == {"To Do": 1, "In Progress": 1, "Blocked": 1, "Done": 1}
    assert body["tasks_by_severity"] == {"Critical": 1, "High": 1, "Medium": 1, "Low": 1}

    per_product = {p["tag"]: (p["total"], p["done"]) for p in body["tasks_per_product"]}
    assert per_product == {"LEARN": (4, 1), "PAY": (0, 0)}

    per_dev = {d["name"]: (d["total"], d["open"]) for d in body["tasks_per_developer"]}
    assert per_dev == {"Alice": (2, 1), "Unassigned": (2, 2)}

    assert [s["number"] for s in body["active_sprints"]] == [2]
    assert body["active_sprints"][0]["total"] == 2
    assert [t["number"] for t in body["overdue"]] == ["LEARN-101"]
    assert [t["number"] for t in body["due_this_week"]] == ["LEARN-103"]
    assert len(body["recently_updated"]) == 4
