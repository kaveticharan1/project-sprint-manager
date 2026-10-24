from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.deps import Db, Paging
from app.routers.tasks import TaskFilters
from app.schemas.common import Page
from app.schemas.products import ProductCreate, ProductOut, ProductUpdate
from app.schemas.sprints import SprintOut, SprintState
from app.schemas.tasks import TaskOut
from app.services import products as service
from app.services import sprints as sprint_service
from app.services import tasks as task_service

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=Page[ProductOut])
async def list_products(
    db: Db,
    page: Paging,
    q: Annotated[str | None, Query(max_length=100, description="Search name or tag")] = None,
):
    return await service.list_products(db, page, q=q)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(db: Db, data: ProductCreate):
    return await service.create_product(db, data)


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(db: Db, product_id: str):
    return await service.get_product(db, product_id)


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(db: Db, product_id: str, data: ProductUpdate):
    return await service.update_product(db, product_id, data)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(db: Db, product_id: str):
    await service.delete_product(db, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{product_id}/sprints", response_model=Page[SprintOut])
async def product_sprints(db: Db, product_id: str, page: Paging, state: SprintState | None = None):
    await service.get_product(db, product_id)
    return await sprint_service.list_sprints(db, page, product_id=product_id, state=state)


# The path parameter is "id" because "product_id" is also a task filter query parameter.
@router.get("/{id}/tasks", response_model=Page[TaskOut])
async def product_tasks(db: Db, id: str, page: Paging, filters: TaskFilters):
    await service.get_product(db, id)
    return await task_service.list_tasks(db, page, **{**filters.as_kwargs(), "product_id": id})
