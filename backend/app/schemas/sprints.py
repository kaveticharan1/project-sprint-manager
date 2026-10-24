from datetime import date, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ApiModel, ObjectIdStr, OptionalText
from app.schemas.products import ProductRef


class SprintState(StrEnum):
    UPCOMING = "Upcoming"
    ACTIVE = "Active"
    COMPLETED = "Completed"


def _check_range(start: date | None, end: date | None) -> None:
    if start and end and start > end:
        raise ValueError("Start date must be on or before the end date")


class SprintCreate(ApiModel):
    product_id: ObjectIdStr
    number: int | None = Field(None, ge=1, le=100_000, description="Defaults to the next number")
    name: OptionalText = Field(None, max_length=100)
    start_date: date
    end_date: date
    goal: OptionalText = Field(None, max_length=1000)

    @model_validator(mode="after")
    def _dates(self):
        _check_range(self.start_date, self.end_date)
        return self


class SprintUpdate(ApiModel):
    product_id: ObjectIdStr | None = None
    number: int | None = Field(None, ge=1, le=100_000)
    name: OptionalText = Field(None, max_length=100)
    start_date: date | None = None
    end_date: date | None = None
    goal: OptionalText = Field(None, max_length=1000)

    @model_validator(mode="after")
    def _dates(self):
        _check_range(self.start_date, self.end_date)
        return self


class MoveTasks(ApiModel):
    target_sprint_id: ObjectIdStr
    date_strategy: Literal["reject", "clamp"] = Field(
        "reject",
        description="'reject' fails if task dates fall outside the target sprint; "
        "'clamp' fits them into the target sprint's range.",
    )
    delete_source: bool = False


class MoveTasksResult(BaseModel):
    moved: int
    adjusted: int
    source_deleted: bool
    target_sprint_id: str


class SprintOut(BaseModel):
    id: str
    product_id: str
    product: ProductRef | None = None
    number: int
    name: str | None = None
    start_date: date
    end_date: date
    goal: str | None = None
    state: SprintState
    task_count: int = 0
    status_counts: dict[str, int] = {}
    created_at: datetime
    updated_at: datetime


class SprintRef(BaseModel):
    id: str
    number: int
    name: str | None = None
    start_date: date
    end_date: date
