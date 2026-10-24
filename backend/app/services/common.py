from datetime import datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorCollection
from pymongo.errors import DuplicateKeyError

from app.errors import ConflictError, NotFoundError, ValidationFailed

Session = AsyncIOMotorClientSession | None


async def get_or_404(
    coll: AsyncIOMotorCollection, oid: ObjectId, entity: str, session: Session = None
) -> dict:
    doc = await coll.find_one({"_id": oid}, session=session)
    if doc is None:
        raise NotFoundError(f"{entity} not found", details={"id": str(oid)})
    return doc


async def touch(
    coll: AsyncIOMotorCollection,
    query: dict[str, Any],
    session: Session,
) -> dict | None:
    """Bump the document's revision inside a transaction and return it (None if no match).

    Writing to the parent makes any concurrent transaction that also writes it (a delete, a date
    edit, a deactivation) conflict, so referential checks can't be raced.
    """
    return await coll.find_one_and_update(
        query, {"$inc": {"rev": 1}}, session=session, return_document=True
    )


async def require_ref(
    coll: AsyncIOMotorCollection,
    oid: str | ObjectId,
    entity: str,
    field: str,
    session: Session,
    extra: dict[str, Any] | None = None,
) -> dict:
    """Lock a referenced document from a request body; missing references are a 422 on ``field``."""
    doc = await touch(coll, {"_id": ObjectId(oid), **(extra or {})}, session)
    if doc is None:
        message = f"{entity} not found"
        raise ValidationFailed(message, code="invalid_reference", fields={field: message})
    return doc


def duplicate_key_conflict(exc: DuplicateKeyError, messages: dict[str, tuple[str, str]]):
    """Translate a unique-index violation into a 409 on the offending field.

    ``messages`` maps an index key name to ``(api_field, message)``.
    """
    key_pattern = (exc.details or {}).get("keyPattern", {})
    for key, (field, message) in messages.items():
        if key in key_pattern:
            return ConflictError(message, code="duplicate", fields={field: message})
    return ConflictError("A record with these values already exists", code="duplicate")


def changed_fields(payload, current: dict, nullable: set[str] = frozenset()) -> dict[str, Any]:
    """Fields explicitly sent in a PATCH that differ from the stored document.

    ``None`` clears a nullable field and is ignored for the rest.
    """
    changes = {}
    for name in payload.model_fields_set:
        value = getattr(payload, name)
        if value is None and name not in nullable:
            continue
        if _comparable(current.get(name)) != value:
            changes[name] = value
    return changes


def _comparable(stored: Any) -> Any:
    if isinstance(stored, ObjectId):
        return str(stored)
    if isinstance(stored, datetime):
        return stored.date()
    return stored
