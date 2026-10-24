import re

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.db import COUNTERS, PRODUCTS, SPRINTS, TASKS, in_transaction
from app.errors import ConflictError
from app.schemas.common import PageParams, Status, make_page
from app.schemas.products import ProductCreate, ProductUpdate
from app.services.common import changed_fields, duplicate_key_conflict, get_or_404
from app.utils import parse_oid, utcnow

ENTITY = "Product"
DUPLICATES = {
    "name_key": ("name", "A product with this name already exists"),
    "tag": ("tag", "This tag is already used by another product"),
}


def name_key(name: str) -> str:
    return name.strip().casefold()


def serialize(doc: dict, counts: dict | None = None) -> dict:
    c = counts or {}
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "tag": doc["tag"],
        "description": doc.get("description"),
        "sprint_count": c.get("sprints", 0),
        "task_count": c.get("tasks", 0),
        "open_task_count": c.get("open", 0),
        "tag_locked": c.get("tasks", 0) > 0,
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


def ref(doc: dict) -> dict:
    return {"id": str(doc["_id"]), "name": doc["name"], "tag": doc["tag"]}


async def counts_for(db: AsyncIOMotorDatabase, ids: list[ObjectId]) -> dict[ObjectId, dict]:
    counts: dict[ObjectId, dict] = {oid: {} for oid in ids}
    sprint_rows = db[SPRINTS].aggregate(
        [
            {"$match": {"product_id": {"$in": ids}}},
            {"$group": {"_id": "$product_id", "n": {"$sum": 1}}},
        ]
    )
    async for row in sprint_rows:
        counts[row["_id"]]["sprints"] = row["n"]
    task_rows = db[TASKS].aggregate(
        [
            {"$match": {"product_id": {"$in": ids}}},
            {
                "$group": {
                    "_id": "$product_id",
                    "n": {"$sum": 1},
                    "open": {"$sum": {"$cond": [{"$ne": ["$status", Status.DONE]}, 1, 0]}},
                }
            },
        ]
    )
    async for row in task_rows:
        counts[row["_id"]].update(tasks=row["n"], open=row["open"])
    return counts


async def list_products(db: AsyncIOMotorDatabase, page: PageParams, q: str | None = None) -> dict:
    query: dict = {}
    if q:
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"name": pattern}, {"tag": pattern}]
    total = await db[PRODUCTS].count_documents(query)
    cursor = db[PRODUCTS].find(query).sort("name_key", 1).skip(page.skip).limit(page.page_size)
    docs = await cursor.to_list(None)
    counts = await counts_for(db, [d["_id"] for d in docs])
    return make_page([serialize(d, counts[d["_id"]]) for d in docs], total, page)


async def get_product(db: AsyncIOMotorDatabase, product_id: str) -> dict:
    oid = parse_oid(product_id, ENTITY)
    doc = await get_or_404(db[PRODUCTS], oid, ENTITY)
    counts = await counts_for(db, [oid])
    return serialize(doc, counts[oid])


async def create_product(db: AsyncIOMotorDatabase, data: ProductCreate) -> dict:
    now = utcnow()
    doc = {
        **data.model_dump(),
        "name_key": name_key(data.name),
        "rev": 0,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db[PRODUCTS].insert_one(doc)
    except DuplicateKeyError as exc:
        raise duplicate_key_conflict(exc, DUPLICATES) from None
    doc["_id"] = result.inserted_id
    return serialize(doc)


async def update_product(db: AsyncIOMotorDatabase, product_id: str, data: ProductUpdate) -> dict:
    oid = parse_oid(product_id, ENTITY)

    async def txn(session):
        current = await get_or_404(db[PRODUCTS], oid, ENTITY, session)
        changes = changed_fields(data, current, nullable={"description"})
        if "tag" in changes:
            task_count = await db[TASKS].count_documents({"product_id": oid}, session=session)
            if task_count:
                message = (
                    f"The tag can't be changed because {task_count} task number(s) already use "
                    f"{current['tag']}."
                )
                raise ConflictError(
                    message,
                    code="tag_locked",
                    details={"task_count": task_count},
                    fields={"tag": message},
                )
        if "name" in changes:
            changes["name_key"] = name_key(changes["name"])
        if changes:
            changes["updated_at"] = utcnow()
            await db[PRODUCTS].update_one(
                {"_id": oid}, {"$set": changes, "$inc": {"rev": 1}}, session=session
            )

    try:
        await in_transaction(db, txn)
    except DuplicateKeyError as exc:
        raise duplicate_key_conflict(exc, DUPLICATES) from None
    return await get_product(db, product_id)


async def delete_product(db: AsyncIOMotorDatabase, product_id: str) -> None:
    oid = parse_oid(product_id, ENTITY)

    async def txn(session):
        product = await get_or_404(db[PRODUCTS], oid, ENTITY, session)
        sprint_count = await db[SPRINTS].count_documents({"product_id": oid}, session=session)
        task_count = await db[TASKS].count_documents({"product_id": oid}, session=session)
        if sprint_count or task_count:
            raise ConflictError(
                f"{product['name']} has {sprint_count} sprint(s) and {task_count} task(s). "
                "Delete or move them before deleting the product.",
                code="product_in_use",
                details={"sprint_count": sprint_count, "task_count": task_count},
            )
        await db[PRODUCTS].delete_one({"_id": oid}, session=session)
        await db[COUNTERS].delete_one({"_id": oid}, session=session)

    await in_transaction(db, txn)
