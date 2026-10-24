import asyncio
import re

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.db import COUNTERS, DEVELOPERS, PRODUCTS, SPRINTS, TASKS, in_transaction
from app.errors import NotFoundError, ValidationFailed
from app.schemas.common import SEVERITY_RANK, STATUS_RANK, PageParams, Severity, Status, make_page
from app.schemas.tasks import TaskCreate, TaskUpdate
from app.services import products as product_service
from app.services import sprints as sprint_service
from app.services.common import Session, changed_fields, get_or_404, require_ref, touch
from app.utils import parse_oid, to_date, to_datetime, today, utcnow

ENTITY = "Task"
FIRST_SEQ = 101
UNASSIGNED = "unassigned"

SORT_FIELDS = {
    "number": [("tag", 1), ("seq", 1)],
    "title": [("title", 1)],
    "severity": [("severity_rank", 1)],
    "status": [("status_rank", 1)],
    "start_date": [("start_date", 1)],
    "end_date": [("end_date", 1)],
    "updated_at": [("updated_at", 1)],
}


# --------------------------------------------------------------------------- serialization


def _developer_ref(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "email": doc["email"],
        "is_active": doc["is_active"],
    }


def serialize(
    doc: dict,
    product: dict | None = None,
    sprint: dict | None = None,
    developer: dict | None = None,
) -> dict:
    end = to_date(doc["end_date"])
    return {
        "id": str(doc["_id"]),
        "number": doc["number"],
        "title": doc["title"],
        "description": doc.get("description"),
        "product_id": str(doc["product_id"]),
        "sprint_id": str(doc["sprint_id"]),
        "developer_id": str(doc["developer_id"]) if doc.get("developer_id") else None,
        "product": product_service.ref(product) if product else None,
        "sprint": sprint_service.ref(sprint) if sprint else None,
        "developer": _developer_ref(developer) if developer else None,
        "severity": doc["severity"],
        "status": doc["status"],
        "start_date": to_date(doc["start_date"]),
        "end_date": end,
        "is_overdue": doc["status"] != Status.DONE and end < today(),
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }


async def _by_id(db: AsyncIOMotorDatabase, coll: str, ids: set) -> dict:
    ids.discard(None)
    if not ids:
        return {}
    return {d["_id"]: d async for d in db[coll].find({"_id": {"$in": list(ids)}})}


async def serialize_many(db: AsyncIOMotorDatabase, docs: list[dict]) -> list[dict]:
    products, sprints, developers = await asyncio.gather(
        _by_id(db, PRODUCTS, {d["product_id"] for d in docs}),
        _by_id(db, SPRINTS, {d["sprint_id"] for d in docs}),
        _by_id(db, DEVELOPERS, {d.get("developer_id") for d in docs}),
    )
    return [
        serialize(
            d,
            products.get(d["product_id"]),
            sprints.get(d["sprint_id"]),
            developers.get(d.get("developer_id")),
        )
        for d in docs
    ]


# --------------------------------------------------------------------------- queries


def _oid_filter(value: str, field: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise ValidationFailed(f"Invalid {field}", fields={field: "Must be a valid id"})
    return ObjectId(value)


def build_query(
    q: str | None = None,
    product_id: str | None = None,
    sprint_id: str | None = None,
    developer_id: str | None = None,
    severity: list[Severity] | None = None,
    status: list[Status] | None = None,
    overdue: bool | None = None,
) -> dict:
    query: dict = {}
    if q and q.strip():
        pattern = {"$regex": re.escape(q.strip()), "$options": "i"}
        query["$or"] = [{"number": pattern}, {"title": pattern}]
    if product_id:
        query["product_id"] = _oid_filter(product_id, "product_id")
    if sprint_id:
        query["sprint_id"] = _oid_filter(sprint_id, "sprint_id")
    if developer_id:
        query["developer_id"] = (
            None if developer_id == UNASSIGNED else _oid_filter(developer_id, "developer_id")
        )
    if severity:
        query["severity"] = {"$in": [s.value for s in severity]}
    if status:
        query["status"] = {"$in": [s.value for s in status]}
    if overdue:
        query["end_date"] = {"$lt": to_datetime(today())}
        open_statuses = [s.value for s in status or Status if s != Status.DONE]
        query["status"] = {"$in": open_statuses}
    return query


def sort_spec(sort: str) -> list[tuple[str, int]]:
    direction = -1 if sort.startswith("-") else 1
    keys = SORT_FIELDS[sort.lstrip("-")]
    # Task number is a stable tiebreaker so pagination never shuffles equal rows.
    tiebreak = [] if sort.lstrip("-") == "number" else SORT_FIELDS["number"]
    return [(k, d * direction) for k, d in keys] + tiebreak + [("_id", 1)]


async def list_tasks(
    db: AsyncIOMotorDatabase,
    page: PageParams,
    sort: str = "number",
    **filters,
) -> dict:
    query = build_query(**filters)
    cursor = db[TASKS].find(query).sort(sort_spec(sort)).skip(page.skip).limit(page.page_size)
    total, docs = await asyncio.gather(db[TASKS].count_documents(query), cursor.to_list(None))
    return make_page(await serialize_many(db, docs), total, page)


async def get_task(db: AsyncIOMotorDatabase, task_id: str) -> dict:
    doc = await get_or_404(db[TASKS], parse_oid(task_id, ENTITY), ENTITY)
    return (await serialize_many(db, [doc]))[0]


# --------------------------------------------------------------------------- validation


async def _lock_active_developer(db, developer_id: str, session: Session) -> dict:
    developer = await require_ref(
        db[DEVELOPERS], developer_id, "Developer", "developer_id", session
    )
    if not developer["is_active"]:
        message = f"{developer['name']} is inactive and can't be assigned tasks"
        raise ValidationFailed(message, code="developer_inactive", fields={"developer_id": message})
    return developer


async def _lock_sprint_for_product(db, sprint_id, product_id: ObjectId, session) -> dict:
    sprint = await require_ref(db[SPRINTS], sprint_id, "Sprint", "sprint_id", session)
    if sprint["product_id"] != product_id:
        message = f"Sprint {sprint['number']} belongs to a different product"
        raise ValidationFailed(
            message, code="sprint_product_mismatch", fields={"sprint_id": message}
        )
    return sprint


def _check_dates_in_sprint(start, end, sprint: dict) -> None:
    fields = {}
    if start > end:
        fields["end_date"] = "End date must be on or after the start date"
    low, high = to_date(sprint["start_date"]), to_date(sprint["end_date"])
    window = f"Sprint {sprint['number']} runs {low.isoformat()} to {high.isoformat()}"
    if not low <= start <= high:
        fields["start_date"] = f"Must be within the sprint. {window}"
    if not low <= end <= high:
        fields.setdefault("end_date", f"Must be within the sprint. {window}")
    if fields:
        raise ValidationFailed(
            next(iter(fields.values())), code="task_dates_invalid", fields=fields
        )


async def _next_number(db, product: dict, session: Session) -> tuple[int, str]:
    # Pipeline update so the first increment of a missing counter yields FIRST_SEQ atomically.
    counter = await db[COUNTERS].find_one_and_update(
        {"_id": product["_id"]},
        [{"$set": {"seq": {"$add": [{"$ifNull": ["$seq", FIRST_SEQ - 1]}, 1]}}}],
        upsert=True,
        return_document=ReturnDocument.AFTER,
        session=session,
    )
    seq = counter["seq"]
    return seq, f"{product['tag']}-{seq}"


# --------------------------------------------------------------------------- commands


async def create_task(db: AsyncIOMotorDatabase, data: TaskCreate) -> dict:
    product_oid = ObjectId(data.product_id)

    async def txn(session):
        product = await require_ref(db[PRODUCTS], product_oid, "Product", "product_id", session)
        sprint = await _lock_sprint_for_product(db, data.sprint_id, product_oid, session)
        if data.developer_id:
            await _lock_active_developer(db, data.developer_id, session)
        _check_dates_in_sprint(data.start_date, data.end_date, sprint)

        seq, number = await _next_number(db, product, session)
        now = utcnow()
        doc = {
            "number": number,
            "tag": product["tag"],
            "seq": seq,
            "title": data.title,
            "description": data.description,
            "product_id": product_oid,
            "sprint_id": sprint["_id"],
            "developer_id": ObjectId(data.developer_id) if data.developer_id else None,
            "severity": data.severity.value,
            "severity_rank": SEVERITY_RANK[data.severity],
            "status": data.status.value,
            "status_rank": STATUS_RANK[data.status],
            "start_date": to_datetime(data.start_date),
            "end_date": to_datetime(data.end_date),
            "created_at": now,
            "updated_at": now,
        }
        result = await db[TASKS].insert_one(doc, session=session)
        return result.inserted_id

    new_id = await in_transaction(db, txn)
    return await get_task(db, str(new_id))


async def update_task(db: AsyncIOMotorDatabase, task_id: str, data: TaskUpdate) -> dict:
    oid = parse_oid(task_id, ENTITY)

    async def txn(session):
        current = await get_or_404(db[TASKS], oid, ENTITY, session)
        changes = changed_fields(data, current, nullable={"description", "developer_id"})

        if "product_id" in changes:
            message = "A task's product can't be changed. Create a new task instead."
            raise ValidationFailed(
                message, code="product_immutable", fields={"product_id": message}
            )

        # Assignment is only validated when it changes, so tasks of a since-deactivated
        # developer can still be edited without being reassigned.
        if changes.get("developer_id"):
            await _lock_active_developer(db, changes["developer_id"], session)
            changes["developer_id"] = ObjectId(changes["developer_id"])

        start = changes.get("start_date", to_date(current["start_date"]))
        end = changes.get("end_date", to_date(current["end_date"]))
        if {"sprint_id", "start_date", "end_date"} & changes.keys():
            # Lock the (possibly new) sprint so its dates can't change underneath us.
            sprint = await _lock_sprint_for_product(
                db, changes.get("sprint_id", current["sprint_id"]), current["product_id"], session
            )
            _check_dates_in_sprint(start, end, sprint)
            if "sprint_id" in changes:
                changes["sprint_id"] = sprint["_id"]
                # Leaving the old sprint also writes it, so a concurrent date edit or delete of
                # the old sprint can't miss this task.
                await touch(db[SPRINTS], {"_id": current["sprint_id"]}, session)

        for field in ("start_date", "end_date"):
            if field in changes:
                changes[field] = to_datetime(changes[field])
        if "severity" in changes:
            changes["severity_rank"] = SEVERITY_RANK[changes["severity"]]
        if "status" in changes:
            changes["status_rank"] = STATUS_RANK[changes["status"]]

        if changes:
            changes["updated_at"] = utcnow()
            for enum_field in ("severity", "status"):
                if enum_field in changes:
                    changes[enum_field] = changes[enum_field].value
            await db[TASKS].update_one({"_id": oid}, {"$set": changes}, session=session)

    await in_transaction(db, txn)
    return await get_task(db, task_id)


async def delete_task(db: AsyncIOMotorDatabase, task_id: str) -> None:
    result = await db[TASKS].delete_one({"_id": parse_oid(task_id, ENTITY)})
    if result.deleted_count == 0:
        raise NotFoundError(f"{ENTITY} not found", details={"id": task_id})
