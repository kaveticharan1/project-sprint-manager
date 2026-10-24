"""Test fixtures.

Tests run against the real MongoDB from ``MONGODB_URI`` but only ever inside the dedicated
``sprint_manager_test`` database. Every test starts with empty collections (documents are
deleted; indexes are kept).
"""

import logging
from datetime import timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from pytest_asyncio import is_async_test

from app.config import get_settings
from app.db import COLLECTIONS, create_client, ensure_indexes
from app.main import create_app
from app.utils import today

TEST_DB = "sprint_manager_test"

logging.getLogger("httpx").setLevel(logging.WARNING)


def pytest_collection_modifyitems(items):
    # One event loop for the whole session so the shared Motor client stays usable.
    session_loop = pytest.mark.asyncio(loop_scope="session")
    for item in items:
        if is_async_test(item):
            item.add_marker(session_loop, append=False)


@pytest.fixture(scope="session")
async def db():
    settings = get_settings()
    if settings.mongodb_test_db != TEST_DB:
        pytest.exit(f"Refusing to run tests against database {settings.mongodb_test_db!r}")
    client = create_client(settings.mongodb_uri)
    database = client[TEST_DB]
    assert database.name == TEST_DB
    await ensure_indexes(database)
    yield database
    client.close()


@pytest.fixture(autouse=True)
async def clean(db):
    for name in COLLECTIONS:
        await db[name].delete_many({})
    yield


@pytest.fixture(scope="session")
async def client(db):
    app = create_app(get_settings())
    app.state.db = db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as http:
        yield http


TODAY = today()  # UTC, same clock the app uses


def d(offset: int) -> str:
    """ISO date ``offset`` days from today."""
    return (TODAY + timedelta(days=offset)).isoformat()


class Factory:
    """Small helpers that create entities through the API and assert success."""

    def __init__(self, client: AsyncClient):
        self.client = client
        self._n = 0

    def _next(self) -> int:
        self._n += 1
        return self._n

    async def developer(self, **overrides) -> dict:
        n = self._next()
        body = {"name": f"Dev {n}", "email": f"dev{n}@example.com", "role": "Backend"} | overrides
        r = await self.client.post("/developers", json=body)
        assert r.status_code == 201, r.text
        return r.json()

    async def product(self, **overrides) -> dict:
        n = self._next()
        body = {"name": f"Product {n}", "tag": f"P{n}"} | overrides
        r = await self.client.post("/products", json=body)
        assert r.status_code == 201, r.text
        return r.json()

    async def sprint(self, product: dict, start: int = -7, end: int = 7, **overrides) -> dict:
        body = {"product_id": product["id"], "start_date": d(start), "end_date": d(end)}
        r = await self.client.post("/sprints", json=body | overrides)
        assert r.status_code == 201, r.text
        return r.json()

    async def task(self, sprint: dict, start: int = -1, end: int = 1, **overrides) -> dict:
        n = self._next()
        body = {
            "title": f"Task number {n}",
            "product_id": sprint["product_id"],
            "sprint_id": sprint["id"],
            "start_date": d(start),
            "end_date": d(end),
        } | overrides
        r = await self.client.post("/tasks", json=body)
        assert r.status_code == 201, r.text
        return r.json()


@pytest.fixture
def make(client) -> Factory:
    return Factory(client)
