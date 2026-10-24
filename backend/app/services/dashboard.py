import asyncio
from datetime import timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db import DEVELOPERS, PRODUCTS, SPRINTS, TASKS
from app.schemas.common import Severity, Status
from app.schemas.sprints import SprintState
from app.services import sprints as sprint_service
from app.services import tasks as task_service
from app.utils import to_date, to_datetime, today

LIST_LIMIT = 8
OPEN_EXPR = {"$sum": {"$cond": [{"$ne": ["$status", Status.DONE]}, 1, 0]}}
DONE_EXPR = {"$sum": {"$cond": [{"$eq": ["$status", Status.DONE]}, 1, 0]}}


async def _group_count(db: AsyncIOMotorDatabase, field: str) -> dict[str, int]:
    pipeline = [{"$group": {"_id": f"${field}", "n": {"$sum": 1}}}]
    return {row["_id"]: row["n"] async for row in db[TASKS].aggregate(pipeline)}


async def _task_list(db: AsyncIOMotorDatabase, query: dict, sort: list) -> list[dict]:
    docs = await db[TASKS].find(query).sort(sort).limit(LIST_LIMIT).to_list(None)
    return await task_service.serialize_many(db, docs)


async def _per_product(db: AsyncIOMotorDatabase) -> list[dict]:
    pipeline = [{"$group": {"_id": "$product_id", "total": {"$sum": 1}, "done": DONE_EXPR}}]
    rows, products = await asyncio.gather(
        db[TASKS].aggregate(pipeline).to_list(None),
        db[PRODUCTS].find().sort("name_key", 1).to_list(None),
    )
    by_product = {r["_id"]: r for r in rows}
    return [
        {
            "product_id": str(p["_id"]),
            "name": p["name"],
            "tag": p["tag"],
            "total": by_product.get(p["_id"], {}).get("total", 0),
            "done": by_product.get(p["_id"], {}).get("done", 0),
        }
        for p in products
    ]


async def _per_developer(db: AsyncIOMotorDatabase) -> list[dict]:
    pipeline = [{"$group": {"_id": "$developer_id", "total": {"$sum": 1}, "open": OPEN_EXPR}}]
    rows = await db[TASKS].aggregate(pipeline).to_list(None)
    developers = {
        d["_id"]: d async for d in db[DEVELOPERS].find({"_id": {"$in": [r["_id"] for r in rows]}})
    }

    def row(r: dict) -> dict:
        dev = developers.get(r["_id"])
        return {
            "developer_id": str(r["_id"]) if r["_id"] else None,
            "name": dev["name"] if dev else "Unassigned",
            "is_active": dev["is_active"] if dev else True,
            "total": r["total"],
            "open": r["open"],
        }

    # Busiest first; the "Unassigned" bucket always last.
    return sorted(map(row, rows), key=lambda r: (r["developer_id"] is None, -r["open"], r["name"]))


async def _active_sprints(db: AsyncIOMotorDatabase) -> list[dict]:
    docs = (
        await db[SPRINTS]
        .find(sprint_service.state_query(SprintState.ACTIVE))
        .sort("end_date", 1)
        .to_list(None)
    )
    return [
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
        for s in await sprint_service.serialize_many(db, docs)
    ]


async def summary(db: AsyncIOMotorDatabase) -> dict:
    now = today()
    now_dt = to_datetime(now)
    week_end = to_datetime(now + timedelta(days=7))
    not_done = {"status": {"$ne": Status.DONE}}
    overdue_q = {**not_done, "end_date": {"$lt": now_dt}}
    due_week_q = {**not_done, "end_date": {"$gte": now_dt, "$lte": week_end}}
    by_due = [("end_date", 1), ("severity_rank", 1)]

    # Every part is independent, so run them concurrently: one round-trip of latency, not ~15.
    (
        by_status,
        by_severity,
        per_product,
        per_developer,
        active_sprints,
        developer_count,
        active_developer_count,
        sprint_count,
        overdue_count,
        unassigned_count,
        overdue,
        due_this_week,
        recently_updated,
    ) = await asyncio.gather(
        _group_count(db, "status"),
        _group_count(db, "severity"),
        _per_product(db),
        _per_developer(db),
        _active_sprints(db),
        db[DEVELOPERS].count_documents({}),
        db[DEVELOPERS].count_documents({"is_active": True}),
        db[SPRINTS].count_documents({}),
        db[TASKS].count_documents(overdue_q),
        db[TASKS].count_documents({"developer_id": None}),
        _task_list(db, overdue_q, by_due),
        _task_list(db, due_week_q, by_due),
        _task_list(db, {}, [("updated_at", -1)]),
    )

    return {
        "today": now,
        "totals": {
            "developers": developer_count,
            "active_developers": active_developer_count,
            "products": len(per_product),
            "sprints": sprint_count,
            "active_sprints": len(active_sprints),
            "tasks": sum(by_status.values()),
            "open_tasks": sum(n for s, n in by_status.items() if s != Status.DONE),
            "overdue_tasks": overdue_count,
            "unassigned_tasks": unassigned_count,
        },
        "tasks_by_status": {s.value: by_status.get(s.value, 0) for s in Status},
        "tasks_by_severity": {s.value: by_severity.get(s.value, 0) for s in Severity},
        "tasks_per_product": per_product,
        "tasks_per_developer": per_developer,
        "active_sprints": active_sprints,
        "overdue": overdue,
        "due_this_week": due_this_week,
        "recently_updated": recently_updated,
    }
