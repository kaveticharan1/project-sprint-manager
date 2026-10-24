"""Seed the app database with realistic sample data.

    python -m scripts.seed           # seed if empty (idempotent: re-running is a no-op)
    python -m scripts.seed --reset   # wipe the sprint_manager collections, then seed

Everything goes through the service layer, so validation runs and task numbers come from
the real per-product counters. Dates are relative to today, so the "current" sprint is
always current. Only ever touches the ``sprint_manager`` database.
"""

import argparse
import asyncio
from datetime import timedelta

from app.config import get_settings
from app.db import COLLECTIONS, PRODUCTS, create_client, ensure_indexes, get_database
from app.db import DEVELOPERS as DEVELOPERS_COLLECTION
from app.schemas.developers import DeveloperCreate
from app.schemas.products import ProductCreate
from app.schemas.sprints import SprintCreate
from app.schemas.tasks import TaskCreate
from app.services import developers, products, sprints, tasks
from app.utils import today

SEED_DATABASE = "sprint_manager"

DEVELOPERS = [
    ("priya", "Priya Sharma", "priya.sharma@example.com", "Tech Lead"),
    ("marcus", "Marcus Chen", "marcus.chen@example.com", "Backend"),
    ("sofia", "Sofia Alvarez", "sofia.alvarez@example.com", "Frontend"),
    ("daniel", "Daniel Okafor", "daniel.okafor@example.com", "QA"),
    ("liam", "Liam O'Brien", "liam.obrien@example.com", "DevOps"),
    ("emma", "Emma Johansson", "emma.johansson@example.com", "Designer"),
]
INACTIVE = {"emma"}

PRODUCTS_DATA = [
    # key, name, tag, description, sprint offset (days) so products aren't perfectly in lockstep
    (
        "learn",
        "Learning Platform",
        "LEARN",
        "Online courses, lessons, quizzes and certificates for learners and instructors.",
        0,
    ),
    (
        "pay",
        "Payments Gateway",
        "PAY",
        "Card processing, refunds and payouts with PCI-compliant storage.",
        -2,
    ),
    (
        "mobi",
        "Mobile App",
        "MOBI",
        "iOS and Android companion app with offline lessons and push notifications.",
        1,
    ),
]

SPRINT_LENGTH = 14
# Sprint index -> (start offset from today, name, goal). Index 1 always contains today.
SPRINTS = [
    (-24, "Foundations", "Lay the groundwork: data models, auth and core flows."),
    (-10, "Core features", "Ship the main user-facing features behind feature flags."),
    (4, "Polish & launch prep", "Harden, measure and get ready for the public launch."),
]

# product, sprint index, title, assignee, severity, status, start/end day within the sprint
TASKS = [
    ("learn", 0, "Set up course catalog data model", "marcus", "High", "Done", 0, 4),
    ("learn", 0, "Design lesson player wireframes", "emma", "Medium", "Done", 0, 5),
    ("learn", 0, "Implement SSO login with Google", "priya", "Critical", "Done", 2, 9),
    ("learn", 0, "Fix video progress not saving on refresh", "marcus", "High", "In Progress", 8, 12),
    ("learn", 1, "Build lesson player UI", "sofia", "High", "In Progress", 0, 11),
    ("learn", 1, "Course search with filters", "sofia", "Medium", "To Do", 2, 7),
    ("learn", 1, "Quiz engine: multiple-choice questions", "marcus", "Medium", "To Do", 3, 13),
    ("learn", 1, "Certificate PDF generation", None, "Low", "To Do", 6, 13),
    ("learn", 1, "Regression test plan for enrollment flow", "daniel", "Medium", "Blocked", 4, 12),
    ("learn", 2, "Instructor analytics dashboard", None, "Medium", "To Do", 0, 9),
    ("learn", 2, "Accessibility audit of course pages", "emma", "High", "To Do", 2, 8),
    ("pay", 0, "Stripe webhook signature verification", "marcus", "Critical", "Done", 0, 5),
    ("pay", 0, "PCI scope documentation", "priya", "Medium", "Done", 1, 10),
    ("pay", 0, "Retry logic for failed payouts", "liam", "High", "Blocked", 5, 13),
    ("pay", 1, "Refund API endpoint", "marcus", "High", "In Progress", 0, 10),
    ("pay", 1, "3-D Secure challenge flow", "sofia", "Critical", "In Progress", 1, 12),
    ("pay", 1, "Idempotency keys for charge requests", "priya", "Critical", "To Do", 2, 13),
    ("pay", 1, "Currency rounding bug in invoices", None, "Critical", "To Do", 9, 13),
    ("pay", 1, "Load test checkout at 500 rps", "liam", "Medium", "To Do", 5, 13),
    ("pay", 1, "E2E tests for the refund flow", "daniel", "Medium", "To Do", 6, 13),
    ("pay", 2, "Apple Pay integration", None, "High", "To Do", 0, 10),
    ("mobi", 0, "Push notification service setup", "liam", "Medium", "Done", 0, 6),
    ("mobi", 0, "Onboarding screens", "sofia", "Low", "Done", 2, 8),
    ("mobi", 0, "Crash on Android 12 when opening the camera", "sofia", "Critical", "In Progress", 9, 13),
    ("mobi", 1, "Offline mode for downloaded lessons", "sofia", "High", "In Progress", 0, 12),
    ("mobi", 1, "Biometric login (Face ID / fingerprint)", "marcus", "High", "To Do", 3, 13),
    ("mobi", 1, "App Store screenshots and listing copy", "emma", "Low", "Done", 0, 4),
    ("mobi", 1, "Smoke test suite on the device farm", "daniel", "Medium", "In Progress", 2, 7),
    ("mobi", 1, "Dark mode support", None, "Low", "To Do", 5, 13),
    ("mobi", 2, "In-app purchases for premium courses", None, "Medium", "To Do", 1, 12),
]


async def reset(db) -> None:
    assert db.name == SEED_DATABASE, f"Refusing to reset database {db.name!r}"
    for name in COLLECTIONS:
        await db[name].delete_many({})
    print(f"Cleared collections in {db.name!r}.")


async def seed(db) -> None:
    base = today()
    dev_ids = {}
    for key, name, email, role in DEVELOPERS:
        # Reuse developers left behind by an interrupted earlier run.
        existing = await db[DEVELOPERS_COLLECTION].find_one({"email": email})
        if existing:
            dev_ids[key] = str(existing["_id"])
            continue
        dev = await developers.create_developer(
            db, DeveloperCreate(name=name, email=email, role=role)
        )
        dev_ids[key] = dev["id"]

    sprint_docs = {}
    for key, name, tag, description, offset in PRODUCTS_DATA:
        product = await products.create_product(
            db, ProductCreate(name=name, tag=tag, description=description)
        )
        for index, (start, sprint_name, goal) in enumerate(SPRINTS):
            start_date = base + timedelta(days=start + offset)
            sprint_docs[(key, index)] = await sprints.create_sprint(
                db,
                SprintCreate(
                    product_id=product["id"],
                    name=sprint_name,
                    goal=goal,
                    start_date=start_date,
                    end_date=start_date + timedelta(days=SPRINT_LENGTH - 1),
                ),
            )

    for product_key, index, title, dev, severity, status, start, end in TASKS:
        sprint = sprint_docs[(product_key, index)]
        await tasks.create_task(
            db,
            TaskCreate(
                title=title,
                product_id=sprint["product_id"],
                sprint_id=sprint["id"],
                developer_id=dev_ids[dev] if dev else None,
                severity=severity,
                status=status,
                start_date=sprint["start_date"] + timedelta(days=start),
                end_date=sprint["start_date"] + timedelta(days=end),
            ),
        )

    # Deactivate after assigning, so inactive developers keep historical tasks.
    for key in INACTIVE:
        await developers.set_active(db, dev_ids[key], False)

    print(
        f"Seeded {len(DEVELOPERS)} developers, {len(PRODUCTS_DATA)} products, "
        f"{len(sprint_docs)} sprints and {len(TASKS)} tasks into {db.name!r}."
    )


async def main(do_reset: bool) -> None:
    settings = get_settings()
    if settings.mongodb_db != SEED_DATABASE:
        raise SystemExit(f"Refusing to seed database {settings.mongodb_db!r}")
    client = create_client(settings.mongodb_uri)
    try:
        db = get_database(client, SEED_DATABASE)
        await ensure_indexes(db)
        if do_reset:
            await reset(db)
        existing = await db[PRODUCTS].count_documents(
            {"tag": {"$in": [tag for _, _, tag, _, _ in PRODUCTS_DATA]}}
        )
        if existing:
            print("Sample data already present; nothing to do. Use --reset to recreate it.")
            return
        await seed(db)
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--reset",
        action="store_true",
        help="delete all documents in the sprint_manager collections first",
    )
    asyncio.run(main(parser.parse_args().reset))
