from dataclasses import asdict, dataclass
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.deps import Db, Paging
from app.schemas.common import Page, Severity, Status
from app.schemas.tasks import (
    AssigneeUpdate,
    SeverityUpdate,
    StatusUpdate,
    TaskCreate,
    TaskOut,
    TaskSort,
    TaskUpdate,
)
from app.services import tasks as service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@dataclass
class _TaskFilters:
    q: str | None
    product_id: str | None
    sprint_id: str | None
    developer_id: str | None
    severity: list[Severity] | None
    status: list[Status] | None
    overdue: bool | None
    sort: str

    def as_kwargs(self) -> dict:
        return asdict(self)


def task_filters(
    q: Annotated[
        str | None, Query(max_length=120, description="Partial, case-insensitive number or title")
    ] = None,
    product_id: str | None = None,
    sprint_id: str | None = None,
    developer_id: Annotated[
        str | None, Query(description="Developer id, or 'unassigned' for tasks with no assignee")
    ] = None,
    severity: Annotated[list[Severity] | None, Query()] = None,
    status: Annotated[list[Status] | None, Query()] = None,
    overdue: bool | None = None,
    sort: TaskSort = "number",
) -> _TaskFilters:
    return _TaskFilters(q, product_id, sprint_id, developer_id, severity, status, overdue, sort)


TaskFilters = Annotated[_TaskFilters, Depends(task_filters)]


@router.get("", response_model=Page[TaskOut])
async def list_tasks(db: Db, page: Paging, filters: TaskFilters):
    return await service.list_tasks(db, page, **filters.as_kwargs())


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(db: Db, data: TaskCreate):
    return await service.create_task(db, data)


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(db: Db, task_id: str):
    return await service.get_task(db, task_id)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(db: Db, task_id: str, data: TaskUpdate):
    return await service.update_task(db, task_id, data)


@router.patch("/{task_id}/status", response_model=TaskOut)
async def update_status(db: Db, task_id: str, data: StatusUpdate):
    return await service.update_task(db, task_id, TaskUpdate(status=data.status))


@router.patch("/{task_id}/severity", response_model=TaskOut)
async def update_severity(db: Db, task_id: str, data: SeverityUpdate):
    return await service.update_task(db, task_id, TaskUpdate(severity=data.severity))


@router.patch("/{task_id}/assignee", response_model=TaskOut)
async def update_assignee(db: Db, task_id: str, data: AssigneeUpdate):
    return await service.update_task(db, task_id, TaskUpdate(developer_id=data.developer_id))


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(db: Db, task_id: str):
    await service.delete_task(db, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
