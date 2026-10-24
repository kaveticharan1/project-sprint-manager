import asyncio
from datetime import date

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import UpdateOne
from pymongo.errors import DuplicateKeyError

from app.db import PRODUCTS, SPRINTS, TASKS, in_transaction
from app.errors import ConflictError, ValidationFailed
from app.schemas.common import PageParams, Status, make_page
from app.schemas.sprints import MoveTasks, SprintCreate, SprintState, SprintUpdate
from app.services import products as product_service
from app.services.common import changed_fields, duplicate_key_conflict, get_or_404, require_ref
from app.utils import parse_oid, to_date, to_datetime, today, utcnow

ENTITY = "Sprint"
DUPLICATES = {"number": ("number", "This sprint number already exists for the product")}


def state_of(start: date, end: date, on: date | None = None) -> SprintState:
    on = on or today()
    if on < start:
        return SprintState.UPCOMING
    if on > end:
        return SprintState.COMPLETED
    return SprintState.ACTIVE


def state_query(state: SprintState) -> dict:
    now = to_datetime(today())
    return {
        SprintState.UPCOMING: {"start_date": {"$gt": now}},
        SprintState.COMPLETED: {"end_date": {"$lt": now}},
        SprintState.ACTIVE: {"start_date": {"$lte": now}, "end_date": {"$gte": now}},
    }[state]


def ref(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "number": doc["number"],
        "name": doc.get("name"),
        "start_date": to_date(doc["start_date"]),
        "end_date": to_date(doc["end_date"]),
    }


def serialize(doc: dict, product: dict | None = None, counts: dict | None = None) -> dict:
    status_counts = {s.value: 0 for s in Status}
    status_counts.update(counts or {})
    start, end = to_date(doc["start_date"]), to_date(doc["end_date"])
    return {
        **ref(doc),
        "product_id": str(doc["product_id"]),
        "product": product_service.ref(product) if product else None,
        "goal": doc.get("goal"),
        "state": state_of(start, end),
        "task_count": sum(status_counts.values()),
        "status_counts": status_counts,
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


async def status_counts(db: AsyncIOMotorDatabase, ids: list[ObjectId]) -> dict[ObjectId, dict]:
    pipeline = [
        {"$match": {"sprint_id": {"$in": ids}}},
        {"$group": {"_id": {"sprint": "$sprint_id", "status": "$status"}, "n": {"$sum": 1}}},
    ]
    counts: dict[ObjectId, dict] = {}
    async for row in db[TASKS].aggregate(pipeline):
        counts.setdefault(row["_id"]["sprint"], {})[row["_id"]["status"]] = row["n"]
    return counts


async def serialize_many(db: AsyncIOMotorDatabase, docs: list[dict]) -> list[dict]:
    product_ids = list({d["product_id"] for d in docs})
    product_docs, counts = await asyncio.gather(
        db[PRODUCTS].find({"_id": {"$in": product_ids}}).to_list(None),
        status_counts(db, [d["_id"] for d in docs]),
    )
    products = {p["_id"]: p for p in product_docs}
    return [serialize(d, products.get(d["product_id"]), counts.get(d["_id"])) for d in docs]


async def list_sprints(
    db: AsyncIOMotorDatabase,
    page: PageParams,
    product_id: str | None = None,
    state: SprintState | None = None,
) -> dict:
    query: dict = {}
    if product_id:
        query["product_id"] = parse_oid(product_id, "Product")
    if state:
        query.update(state_query(state))
    total = await db[SPRINTS].count_documents(query)
    cursor = (
        db[SPRINTS]
        .find(query)
        .sort([("start_date", -1), ("number", -1)])
        .skip(page.skip)
        .limit(page.page_size)
    )
    docs = await cursor.to_list(None)
    return make_page(await serialize_many(db, docs), total, page)


async def get_sprint(db: AsyncIOMotorDatabase, sprint_id: str) -> dict:
    doc = await get_or_404(db[SPRINTS], parse_oid(sprint_id, ENTITY), ENTITY)
    return (await serialize_many(db, [doc]))[0]


def _sprint_doc_dates(values: dict) -> dict:
    return {k: to_datetime(v) if k in ("start_date", "end_date") else v for k, v in values.items()}


async def create_sprint(db: AsyncIOMotorDatabase, data: SprintCreate) -> dict:
    product_oid = ObjectId(data.product_id)

    async def txn(session):
        await require_ref(db[PRODUCTS], product_oid, "Product", "product_id", session)
        number = data.number
        if number is None:
            last = await db[SPRINTS].find_one(
                {"product_id": product_oid}, sort=[("number", -1)], session=session
            )
            number = (last["number"] + 1) if last else 1
        now = utcnow()
        doc = _sprint_doc_dates(
            {
                **data.model_dump(exclude={"product_id", "number"}),
                "product_id": product_oid,
                "number": number,
                "rev": 0,
                "created_at": now,
                "updated_at": now,
            }
        )
        result = await db[SPRINTS].insert_one(doc, session=session)
        return result.inserted_id

    try:
        new_id = await in_transaction(db, txn)
    except DuplicateKeyError as exc:
        raise duplicate_key_conflict(exc, DUPLICATES) from None
    return await get_sprint(db, str(new_id))


async def update_sprint(db: AsyncIOMotorDatabase, sprint_id: str, data: SprintUpdate) -> dict:
    oid = parse_oid(sprint_id, ENTITY)

    async def txn(session):
        current = await get_or_404(db[SPRINTS], oid, ENTITY, session)
        changes = changed_fields(data, current, nullable={"name", "goal"})

        if "product_id" in changes:
            task_count = await db[TASKS].count_documents({"sprint_id": oid}, session=session)
            if task_count:
                message = f"This sprint has {task_count} task(s), so its product can't change."
                raise ConflictError(
                    message,
                    code="sprint_has_tasks",
                    details={"task_count": task_count},
                    fields={"product_id": message},
                )
            await require_ref(db[PRODUCTS], changes["product_id"], "Product", "product_id", session)
            changes["product_id"] = ObjectId(changes["product_id"])

        start = changes.get("start_date", to_date(current["start_date"]))
        end = changes.get("end_date", to_date(current["end_date"]))
        if start > end:
            message = "Start date must be on or before the end date"
            raise ValidationFailed(message, fields={"end_date": message})

        if "start_date" in changes or "end_date" in changes:
            outside = await (
                db[TASKS]
                .find(
                    {
                        "sprint_id": oid,
                        "$or": [
                            {"start_date": {"$lt": to_datetime(start)}},
                            {"end_date": {"$gt": to_datetime(end)}},
                        ],
                    },
                    {"number": 1},
                    session=session,
                )
                .sort([("seq", 1)])
                .to_list(None)
            )
            if outside:
                numbers = [t["number"] for t in outside]
                shown = ", ".join(numbers[:10]) + (" …" if len(numbers) > 10 else "")
                message = f"{len(numbers)} task(s) would fall outside the new dates: {shown}"
                raise ConflictError(
                    message,
                    code="sprint_dates_conflict",
                    details={"task_numbers": numbers},
                    fields={"start_date": message, "end_date": message},
                )

        if changes:
            changes["updated_at"] = utcnow()
            await db[SPRINTS].update_one(
                {"_id": oid},
                {"$set": _sprint_doc_dates(changes), "$inc": {"rev": 1}},
                session=session,
            )

    try:
        await in_transaction(db, txn)
    except DuplicateKeyError as exc:
        raise duplicate_key_conflict(exc, DUPLICATES) from None
    return await get_sprint(db, sprint_id)


async def delete_sprint(db: AsyncIOMotorDatabase, sprint_id: str) -> None:
    oid = parse_oid(sprint_id, ENTITY)

    async def txn(session):
        sprint = await get_or_404(db[SPRINTS], oid, ENTITY, session)
        task_count = await db[TASKS].count_documents({"sprint_id": oid}, session=session)
        if task_count:
            raise ConflictError(
                f"Sprint {sprint['number']} has {task_count} task(s). "
                "Move them to another sprint of the same product first.",
                code="sprint_has_tasks",
                details={"task_count": task_count},
            )
        await db[SPRINTS].delete_one({"_id": oid}, session=session)

    await in_transaction(db, txn)


def _clamp(value: date, low: date, high: date) -> date:
    return max(low, min(value, high))


async def move_tasks(db: AsyncIOMotorDatabase, sprint_id: str, data: MoveTasks) -> dict:
    source_id = parse_oid(sprint_id, ENTITY)
    target_id = ObjectId(data.target_sprint_id)
    if source_id == target_id:
        message = "Choose a different sprint"
        raise ValidationFailed(message, fields={"target_sprint_id": message})

    async def txn(session):
        source = await get_or_404(db[SPRINTS], source_id, ENTITY, session)
        target = await require_ref(db[SPRINTS], target_id, ENTITY, "target_sprint_id", session)
        if target["product_id"] != source["product_id"]:
            message = "Tasks can only move to a sprint of the same product"
            raise ValidationFailed(
                message, code="sprint_product_mismatch", fields={"target_sprint_id": message}
            )
        low, high = to_date(target["start_date"]), to_date(target["end_date"])
        tasks = await (
            db[TASKS].find({"sprint_id": source_id}, session=session).sort("seq", 1).to_list(None)
        )

        updates, outside = [], []
        now = utcnow()
        for task in tasks:
            start, end = to_date(task["start_date"]), to_date(task["end_date"])
            fields = {"sprint_id": target_id, "updated_at": now}
            if start < low or end > high:
                outside.append(task["number"])
                fields["start_date"] = to_datetime(_clamp(start, low, high))
                fields["end_date"] = to_datetime(_clamp(end, low, high))
            updates.append(UpdateOne({"_id": task["_id"]}, {"$set": fields}))

        if outside and data.date_strategy == "reject":
            raise ConflictError(
                f"{len(outside)} task(s) have dates outside the target sprint "
                f"({low.isoformat()} – {high.isoformat()}).",
                code="task_dates_outside_target",
                details={"task_numbers": outside},
            )
        if updates:
            await db[TASKS].bulk_write(updates, session=session)
        if data.delete_source:
            await db[SPRINTS].delete_one({"_id": source_id}, session=session)
        else:
            await db[SPRINTS].update_one({"_id": source_id}, {"$inc": {"rev": 1}}, session=session)
        return {
            "moved": len(updates),
            "adjusted": len(outside),
            "source_deleted": data.delete_source,
            "target_sprint_id": str(target_id),
        }

    return await in_transaction(db, txn)
