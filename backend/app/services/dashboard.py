from datetime import timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db import DEVELOPERS, PRODUCTS, SPRINTS, TASKS
from app.schemas.common import Severity, Status
from app.schemas.sprints import SprintState
from app.services import sprints as sprint_service
from app.services import tasks as task_service
from app.utils import to_date, to_datetime, today

LIST_LIMIT = 8


async def _group_count(db: AsyncIOMotorDatabase, field: str) -> dict[str, int]:
    pipeline = [{"$group": {"_id": f"${field}", "n": {"$sum": 1}}}]
    return {row["_id"]: row["n"] async for row in db[TASKS].aggregate(pipeline)}


async def _task_list(db: AsyncIOMotorDatabase, query: dict, sort: list) -> list[dict]:
    docs = await db[TASKS].find(query).sort(sort).limit(LIST_LIMIT).to_list(None)
    return await task_service.serialize_many(db, docs)


async def summary(db: AsyncIOMotorDatabase) -> dict:
    now = today()
    now_dt = to_datetime(now)
    week_end = to_datetime(now + timedelta(days=7))
    not_done = {"status": {"$ne": Status.DONE}}
    overdue_q = {**not_done, "end_date": {"$lt": now_dt}}
    due_week_q = {**not_done, "end_date": {"$gte": now_dt, "$lte": week_end}}

    by_status = await _group_count(db, "status")
    by_severity = await _group_count(db, "severity")

    open_expr = {"$sum": {"$cond": [{"$ne": ["$status", Status.DONE]}, 1, 0]}}
    done_expr = {"$sum": {"$cond": [{"$eq": ["$status", Status.DONE]}, 1, 0]}}

    product_rows = {
        r["_id"]: r
        async for r in db[TASKS].aggregate(
            [{"$group": {"_id": "$product_id", "total": {"$sum": 1}, "done": done_expr}}]
        )
    }
    products = await db[PRODUCTS].find().sort("name_key", 1).to_list(None)
    per_product = [
        {
            "product_id": str(p["_id"]),
            "name": p["name"],
            "tag": p["tag"],
            "total": product_rows.get(p["_id"], {}).get("total", 0),
            "done": product_rows.get(p["_id"], {}).get("done", 0),
        }
        for p in products
    ]

    dev_rows = [
        r
        async for r in db[TASKS].aggregate(
            [{"$group": {"_id": "$developer_id", "total": {"$sum": 1}, "open": open_expr}}]
        )
    ]
    developers = {
        d["_id"]: d
        async for d in db[DEVELOPERS].find({"_id": {"$in": [r["_id"] for r in dev_rows]}})
    }
    per_developer = sorted(
        (
            {
                "developer_id": str(r["_id"]) if r["_id"] else None,
                "name": developers[r["_id"]]["name"] if r["_id"] in developers else "Unassigned",
                "is_active": developers[r["_id"]]["is_active"] if r["_id"] in developers else True,
                "total": r["total"],
                "open": r["open"],
            }
            for r in dev_rows
        ),
        key=lambda row: (row["developer_id"] is None, -row["open"], row["name"]),
    )

    active_sprint_docs = (
        await db[SPRINTS]
        .find(sprint_service.state_query(SprintState.ACTIVE))
        .sort("end_date", 1)
        .to_list(None)
    )
    active_sprints = [
        {
            "sprint_id": s["id"],
            "product_id": s["product_id"],
            "tag": s["product"]["tag"] if s["product"] else "",
            "number": s["number"],
            "name": s["name"],
            "start_date": to_date(s["start_date"]),
            "end_date": to_date(s["end_date"]),
            "total": s["task_count"],
            "status_counts": s["status_counts"],
        }
        for s in await sprint_service.serialize_many(db, active_sprint_docs)
    ]

    totals = {
        "developers": await db[DEVELOPERS].count_documents({}),
        "active_developers": await db[DEVELOPERS].count_documents({"is_active": True}),
        "products": len(products),
        "sprints": await db[SPRINTS].count_documents({}),
        "active_sprints": len(active_sprints),
        "tasks": sum(by_status.values()),
        "open_tasks": sum(n for s, n in by_status.items() if s != Status.DONE),
        "overdue_tasks": await db[TASKS].count_documents(overdue_q),
        "unassigned_tasks": await db[TASKS].count_documents({"developer_id": None}),
    }

    return {
        "today": now,
        "totals": totals,
        "tasks_by_status": {s.value: by_status.get(s.value, 0) for s in Status},
        "tasks_by_severity": {s.value: by_severity.get(s.value, 0) for s in Severity},
        "tasks_per_product": per_product,
        "tasks_per_developer": per_developer,
        "active_sprints": active_sprints,
        "overdue": await _task_list(db, overdue_q, [("end_date", 1), ("severity_rank", 1)]),
        "due_this_week": await _task_list(db, due_week_q, [("end_date", 1), ("severity_rank", 1)]),
        "recently_updated": await _task_list(db, {}, [("updated_at", -1)]),
    }
