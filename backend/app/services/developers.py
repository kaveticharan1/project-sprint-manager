import re

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.db import DEVELOPERS, TASKS, in_transaction
from app.errors import ConflictError, ValidationFailed
from app.schemas.common import PageParams, Status, make_page
from app.schemas.developers import DeveloperCreate, DeveloperUpdate, ReassignTasks
from app.services.common import changed_fields, duplicate_key_conflict, get_or_404, require_ref
from app.utils import parse_oid, utcnow

ENTITY = "Developer"
DUPLICATES = {"email": ("email", "A developer with this email already exists")}


def serialize(doc: dict, counts: dict[ObjectId, dict] | None = None) -> dict:
    c = (counts or {}).get(doc["_id"], {})
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "email": doc["email"],
        "role": doc["role"],
        "is_active": doc["is_active"],
        "task_count": c.get("total", 0),
        "open_task_count": c.get("open", 0),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


async def task_counts(db: AsyncIOMotorDatabase, ids: list[ObjectId]) -> dict[ObjectId, dict]:
    pipeline = [
        {"$match": {"developer_id": {"$in": ids}}},
        {
            "$group": {
                "_id": "$developer_id",
                "total": {"$sum": 1},
                "open": {"$sum": {"$cond": [{"$ne": ["$status", Status.DONE]}, 1, 0]}},
            }
        },
    ]
    return {row["_id"]: row async for row in db[TASKS].aggregate(pipeline)}


async def _out(db: AsyncIOMotorDatabase, doc: dict) -> dict:
    return serialize(doc, await task_counts(db, [doc["_id"]]))


async def list_developers(
    db: AsyncIOMotorDatabase,
    page: PageParams,
    q: str | None = None,
    is_active: bool | None = None,
    role: str | None = None,
) -> dict:
    query: dict = {}
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": pattern}, {"email": pattern}]
    if is_active is not None:
        query["is_active"] = is_active
    if role:
        query["role"] = role
    total = await db[DEVELOPERS].count_documents(query)
    cursor = (
        db[DEVELOPERS]
        .find(query)
        .sort([("is_active", -1), ("name", 1)])
        .skip(page.skip)
        .limit(page.page_size)
    )
    docs = await cursor.to_list(None)
    counts = await task_counts(db, [d["_id"] for d in docs])
    return make_page([serialize(d, counts) for d in docs], total, page)


async def get_developer(db: AsyncIOMotorDatabase, developer_id: str) -> dict:
    doc = await get_or_404(db[DEVELOPERS], parse_oid(developer_id, ENTITY), ENTITY)
    return await _out(db, doc)


async def create_developer(db: AsyncIOMotorDatabase, data: DeveloperCreate) -> dict:
    now = utcnow()
    doc = {**data.model_dump(mode="json"), "rev": 0, "created_at": now, "updated_at": now}
    try:
        result = await db[DEVELOPERS].insert_one(doc)
    except DuplicateKeyError as exc:
        raise duplicate_key_conflict(exc, DUPLICATES) from None
    doc["_id"] = result.inserted_id
    return serialize(doc)


async def update_developer(db: AsyncIOMotorDatabase, developer_id: str, data: DeveloperUpdate):
    oid = parse_oid(developer_id, ENTITY)
    current = await get_or_404(db[DEVELOPERS], oid, ENTITY)
    changes = changed_fields(data, current)
    if changes:
        changes["updated_at"] = utcnow()
        try:
            await db[DEVELOPERS].update_one({"_id": oid}, {"$set": changes})
        except DuplicateKeyError as exc:
            raise duplicate_key_conflict(exc, DUPLICATES) from None
    return await get_developer(db, developer_id)


async def delete_developer(db: AsyncIOMotorDatabase, developer_id: str) -> None:
    oid = parse_oid(developer_id, ENTITY)

    async def txn(session):
        dev = await get_or_404(db[DEVELOPERS], oid, ENTITY, session)
        task_count = await db[TASKS].count_documents({"developer_id": oid}, session=session)
        if task_count:
            open_count = await db[TASKS].count_documents(
                {"developer_id": oid, "status": {"$ne": Status.DONE}}, session=session
            )
            raise ConflictError(
                f"{dev['name']} has {task_count} task(s) and can't be deleted. "
                "Deactivate them or reassign their tasks instead.",
                code="developer_has_tasks",
                details={"task_count": task_count, "open_task_count": open_count},
            )
        await db[DEVELOPERS].delete_one({"_id": oid}, session=session)

    await in_transaction(db, txn)


async def set_active(db: AsyncIOMotorDatabase, developer_id: str, active: bool) -> dict:
    oid = parse_oid(developer_id, ENTITY)
    await get_or_404(db[DEVELOPERS], oid, ENTITY)
    # A plain write on the developer document: any in-flight assignment transaction that
    # touched this developer conflicts with it and re-checks is_active on retry.
    await db[DEVELOPERS].update_one(
        {"_id": oid},
        {"$set": {"is_active": active, "updated_at": utcnow()}, "$inc": {"rev": 1}},
    )
    return await get_developer(db, developer_id)


async def reassign_tasks(db: AsyncIOMotorDatabase, developer_id: str, data: ReassignTasks) -> dict:
    source_id = parse_oid(developer_id, ENTITY)
    target_id = ObjectId(data.target_developer_id)
    if source_id == target_id:
        message = "Choose a different developer"
        raise ValidationFailed(message, fields={"target_developer_id": message})

    async def txn(session):
        await get_or_404(db[DEVELOPERS], source_id, ENTITY, session)
        target = await require_ref(
            db[DEVELOPERS], target_id, ENTITY, "target_developer_id", session
        )
        if not target["is_active"]:
            message = f"{target['name']} is inactive and can't be assigned tasks"
            raise ValidationFailed(
                message, code="developer_inactive", fields={"target_developer_id": message}
            )
        query: dict = {"developer_id": source_id}
        if data.only_open:
            query["status"] = {"$ne": Status.DONE}
        result = await db[TASKS].update_many(
            query, {"$set": {"developer_id": target_id, "updated_at": utcnow()}}, session=session
        )
        return result.modified_count

    moved = await in_transaction(db, txn)
    return {"moved": moved, "target_developer_id": str(target_id)}
