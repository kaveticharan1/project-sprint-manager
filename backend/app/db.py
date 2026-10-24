"""MongoDB connection, index management and transaction helpers."""

from collections.abc import Awaitable, Callable
from typing import TypeVar

from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorClientSession,
    AsyncIOMotorDatabase,
)
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.config import assert_allowed_database

T = TypeVar("T")

DEVELOPERS = "developers"
PRODUCTS = "products"
SPRINTS = "sprints"
TASKS = "tasks"
COUNTERS = "counters"
COLLECTIONS = (DEVELOPERS, PRODUCTS, SPRINTS, TASKS, COUNTERS)


def create_client(uri: str) -> AsyncIOMotorClient:
    return AsyncIOMotorClient(uri, serverSelectionTimeoutMS=10_000, tz_aware=True)


def get_database(client: AsyncIOMotorClient, name: str) -> AsyncIOMotorDatabase:
    return client[assert_allowed_database(name)]


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db[DEVELOPERS].create_indexes(
        [
            IndexModel([("email", ASCENDING)], unique=True, name="uniq_email"),
            IndexModel([("is_active", ASCENDING), ("name", ASCENDING)], name="active_name"),
        ]
    )
    await db[PRODUCTS].create_indexes(
        [
            IndexModel([("name_key", ASCENDING)], unique=True, name="uniq_name"),
            IndexModel([("tag", ASCENDING)], unique=True, name="uniq_tag"),
        ]
    )
    await db[SPRINTS].create_indexes(
        [
            IndexModel(
                [("product_id", ASCENDING), ("number", ASCENDING)],
                unique=True,
                name="uniq_product_number",
            ),
            IndexModel([("start_date", ASCENDING), ("end_date", ASCENDING)], name="dates"),
        ]
    )
    await db[TASKS].create_indexes(
        [
            IndexModel(
                [("product_id", ASCENDING), ("number", ASCENDING)],
                unique=True,
                name="uniq_product_number",
            ),
            IndexModel([("tag", ASCENDING), ("seq", ASCENDING)], name="number_order"),
            IndexModel([("sprint_id", ASCENDING)], name="sprint"),
            IndexModel([("developer_id", ASCENDING)], name="developer"),
            IndexModel([("status", ASCENDING)], name="status"),
            IndexModel([("severity", ASCENDING)], name="severity"),
            IndexModel([("end_date", ASCENDING)], name="end_date"),
            IndexModel([("updated_at", DESCENDING)], name="updated_at"),
            # Search is a case-insensitive partial match on number/title; these indexes let
            # MongoDB scan index keys rather than whole documents for those regexes.
            IndexModel([("number", ASCENDING)], name="search_number"),
            IndexModel([("title", ASCENDING)], name="search_title"),
        ]
    )


async def in_transaction(
    db: AsyncIOMotorDatabase,
    callback: Callable[[AsyncIOMotorClientSession], Awaitable[T]],
) -> T:
    """Run ``callback(session)`` inside a transaction, retrying on transient write conflicts.

    Services that must not race with a delete/update of a parent document "touch" that parent
    (``$inc: {rev: 1}``) inside the transaction; concurrent writers then conflict and one retries
    against the new state instead of leaving inconsistent data behind.
    """
    async with await db.client.start_session() as session:
        return await session.with_transaction(callback)
