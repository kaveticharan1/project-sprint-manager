from fastapi import APIRouter, Response, status

from app.deps import Db, Paging
from app.routers.tasks import TaskFilters
from app.schemas.common import Page
from app.schemas.sprints import (
    MoveTasks,
    MoveTasksResult,
    SprintCreate,
    SprintOut,
    SprintState,
    SprintUpdate,
)
from app.schemas.tasks import TaskOut
from app.services import sprints as service
from app.services import tasks as task_service

router = APIRouter(prefix="/sprints", tags=["sprints"])


@router.get("", response_model=Page[SprintOut])
async def list_sprints(
    db: Db, page: Paging, product_id: str | None = None, state: SprintState | None = None
):
    return await service.list_sprints(db, page, product_id=product_id, state=state)


@router.post("", response_model=SprintOut, status_code=status.HTTP_201_CREATED)
async def create_sprint(db: Db, data: SprintCreate):
    return await service.create_sprint(db, data)


@router.get("/{sprint_id}", response_model=SprintOut)
async def get_sprint(db: Db, sprint_id: str):
    return await service.get_sprint(db, sprint_id)


@router.patch("/{sprint_id}", response_model=SprintOut)
async def update_sprint(db: Db, sprint_id: str, data: SprintUpdate):
    return await service.update_sprint(db, sprint_id, data)


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sprint(db: Db, sprint_id: str):
    await service.delete_sprint(db, sprint_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{sprint_id}/move-tasks", response_model=MoveTasksResult)
async def move_tasks(db: Db, sprint_id: str, data: MoveTasks):
    return await service.move_tasks(db, sprint_id, data)


# The path parameter is "id" because "sprint_id" is also a task filter query parameter.
@router.get("/{id}/tasks", response_model=Page[TaskOut])
async def sprint_tasks(db: Db, id: str, page: Paging, filters: TaskFilters):
    await service.get_sprint(db, id)
    return await task_service.list_tasks(db, page, **{**filters.as_kwargs(), "sprint_id": id})
