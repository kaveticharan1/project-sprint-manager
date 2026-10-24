from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ApiModel, ObjectIdStr, OptionalText, Severity, Status
from app.schemas.products import ProductRef
from app.schemas.sprints import SprintRef

TitleField = Field(min_length=3, max_length=120)
DescriptionField = Field(None, max_length=5000)


def _check_range(start: date | None, end: date | None) -> None:
    if start and end and start > end:
        raise ValueError("Start date must be on or before the end date")


class TaskCreate(ApiModel):
    title: str = TitleField
    description: OptionalText = DescriptionField
    product_id: ObjectIdStr
    sprint_id: ObjectIdStr
    developer_id: ObjectIdStr | None = None
    severity: Severity = Severity.MEDIUM
    status: Status = Status.TODO
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def _dates(self):
        _check_range(self.start_date, self.end_date)
        return self


class TaskUpdate(ApiModel):
    title: str | None = Field(None, min_length=3, max_length=120)
    description: OptionalText = DescriptionField
    # Accepted only so a client re-sending the unchanged product gets a no-op instead of a 422;
    # any attempt to change it is rejected by the service.
    product_id: ObjectIdStr | None = None
    sprint_id: ObjectIdStr | None = None
    developer_id: ObjectIdStr | None = None
    severity: Severity | None = None
    status: Status | None = None
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def _dates(self):
        _check_range(self.start_date, self.end_date)
        return self


class StatusUpdate(ApiModel):
    status: Status


class SeverityUpdate(ApiModel):
    severity: Severity


class AssigneeUpdate(ApiModel):
    developer_id: ObjectIdStr | None


class DeveloperRef(BaseModel):
    id: str
    name: str
    email: str
    is_active: bool


class TaskOut(BaseModel):
    id: str
    number: str
    title: str
    description: str | None = None
    product_id: str
    sprint_id: str
    developer_id: str | None = None
    product: ProductRef | None = None
    sprint: SprintRef | None = None
    developer: DeveloperRef | None = None
    severity: Severity
    status: Status
    start_date: date
    end_date: date
    is_overdue: bool = False
    created_at: datetime
    updated_at: datetime


TaskSort = Literal[
    "number",
    "-number",
    "title",
    "-title",
    "severity",
    "-severity",
    "status",
    "-status",
    "start_date",
    "-start_date",
    "end_date",
    "-end_date",
    "updated_at",
    "-updated_at",
]
