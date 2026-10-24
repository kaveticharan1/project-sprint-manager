from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.deps import Db, Paging
from app.routers.tasks import TaskFilters
from app.schemas.common import Page, Role
from app.schemas.developers import (
    DeveloperCreate,
    DeveloperOut,
    DeveloperUpdate,
    ReassignResult,
    ReassignTasks,
)
from app.schemas.tasks import TaskOut
from app.services import developers as service
from app.services import tasks as task_service

router = APIRouter(prefix="/developers", tags=["developers"])


@router.get("", response_model=Page[DeveloperOut])
async def list_developers(
    db: Db,
    page: Paging,
    q: Annotated[str | None, Query(max_length=100, description="Search name or email")] = None,
    is_active: bool | None = None,
    role: Role | None = None,
):
    return await service.list_developers(db, page, q=q, is_active=is_active, role=role)


@router.post("", response_model=DeveloperOut, status_code=status.HTTP_201_CREATED)
async def create_developer(db: Db, data: DeveloperCreate):
    return await service.create_developer(db, data)


@router.get("/{developer_id}", response_model=DeveloperOut)
async def get_developer(db: Db, developer_id: str):
    return await service.get_developer(db, developer_id)


@router.patch("/{developer_id}", response_model=DeveloperOut)
async def update_developer(db: Db, developer_id: str, data: DeveloperUpdate):
    return await service.update_developer(db, developer_id, data)


@router.delete("/{developer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_developer(db: Db, developer_id: str):
    await service.delete_developer(db, developer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{developer_id}/deactivate", response_model=DeveloperOut)
async def deactivate_developer(db: Db, developer_id: str):
    return await service.set_active(db, developer_id, False)


@router.post("/{developer_id}/activate", response_model=DeveloperOut)
async def activate_developer(db: Db, developer_id: str):
    return await service.set_active(db, developer_id, True)


@router.post("/{developer_id}/reassign-tasks", response_model=ReassignResult)
async def reassign_tasks(db: Db, developer_id: str, data: ReassignTasks):
    return await service.reassign_tasks(db, developer_id, data)


# The path parameter is "id" because "developer_id" is also a task filter query parameter.
@router.get("/{id}/tasks", response_model=Page[TaskOut])
async def developer_tasks(db: Db, id: str, page: Paging, filters: TaskFilters):
    await service.get_developer(db, id)
    return await task_service.list_tasks(db, page, **{**filters.as_kwargs(), "developer_id": id})
