from datetime import UTC, date, datetime, time
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.errors import NotFoundError


def utcnow() -> datetime:
    return datetime.now(UTC)


def today() -> date:
    return utcnow().date()


def to_datetime(value: date) -> datetime:
    """MongoDB has no date type; calendar dates are stored as UTC midnight."""
    return datetime.combine(value, time.min, tzinfo=UTC)


def to_date(value: datetime | date | None) -> date | None:
    if value is None:
        return None
    return value.date() if isinstance(value, datetime) else value


def parse_oid(value: str, entity: str) -> ObjectId:
    """Parse a path id. Malformed ids can't match anything, so they are a 404, never a 500."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise NotFoundError(f"{entity} not found", details={"id": value}) from None


def oid_str(value: Any) -> str | None:
    return str(value) if value is not None else None
