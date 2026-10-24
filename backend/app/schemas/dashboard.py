from datetime import date

from pydantic import BaseModel

from app.schemas.tasks import TaskOut


class Totals(BaseModel):
    developers: int
    active_developers: int
    products: int
    sprints: int
    active_sprints: int
    tasks: int
    open_tasks: int
    overdue_tasks: int
    unassigned_tasks: int


class ProductBucket(BaseModel):
    product_id: str
    name: str
    tag: str
    total: int
    done: int


class DeveloperBucket(BaseModel):
    developer_id: str | None
    name: str
    is_active: bool
    total: int
    open: int


class SprintBucket(BaseModel):
    sprint_id: str
    product_id: str
    tag: str
    number: int
    name: str | None
    start_date: date
    end_date: date
    total: int
    status_counts: dict[str, int]


class DashboardSummary(BaseModel):
    today: date
    totals: Totals
    tasks_by_status: dict[str, int]
    tasks_by_severity: dict[str, int]
    tasks_per_product: list[ProductBucket]
    tasks_per_developer: list[DeveloperBucket]
    active_sprints: list[SprintBucket]
    overdue: list[TaskOut]
    due_this_week: list[TaskOut]
    recently_updated: list[TaskOut]
