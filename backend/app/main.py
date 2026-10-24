import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.db import create_client, ensure_indexes, get_database
from app.deps import Db
from app.errors import register_error_handlers
from app.routers import dashboard, developers, products, sprints, tasks

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("app")

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        client = create_client(settings.mongodb_uri)
        app.state.db = get_database(client, settings.mongodb_db)
        await ensure_indexes(app.state.db)
        logger.info("Connected to MongoDB database %r", settings.mongodb_db)
        try:
            yield
        finally:
            client.close()

    app = FastAPI(
        title="Project & Sprint Manager API",
        version="1.0.0",
        description="Manage developers, products, sprints and tasks.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    @app.get("/health", tags=["health"])
    async def health(db: Db):
        await db.command("ping")
        return {"status": "ok", "database": db.name}

    for module in (dashboard, developers, products, sprints, tasks):
        app.include_router(module.router, prefix=API_PREFIX)

    return app


app = create_app()
