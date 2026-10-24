from typing import Annotated

from fastapi import Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.common import PageParams


def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db


def get_page(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 20,
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


Db = Annotated[AsyncIOMotorDatabase, Depends(get_db)]
Paging = Annotated[PageParams, Depends(get_page)]
