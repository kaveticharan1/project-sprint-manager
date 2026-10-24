from enum import StrEnum
from typing import Annotated, Generic, TypeVar

from bson import ObjectId
from pydantic import AfterValidator, BaseModel, ConfigDict, Field

T = TypeVar("T")


class Role(StrEnum):
    FRONTEND = "Frontend"
    BACKEND = "Backend"
    FULL_STACK = "Full-Stack"
    QA = "QA"
    DEVOPS = "DevOps"
    DESIGNER = "Designer"
    TECH_LEAD = "Tech Lead"


class Severity(StrEnum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Status(StrEnum):
    TODO = "To Do"
    IN_PROGRESS = "In Progress"
    BLOCKED = "Blocked"
    DONE = "Done"


# Ranks drive "sort by severity/status"; stored on each task so MongoDB can sort on them.
SEVERITY_RANK = {Severity.CRITICAL: 0, Severity.HIGH: 1, Severity.MEDIUM: 2, Severity.LOW: 3}
STATUS_RANK = {Status.TODO: 0, Status.IN_PROGRESS: 1, Status.BLOCKED: 2, Status.DONE: 3}


def _validate_object_id(value: str) -> str:
    if not ObjectId.is_valid(value):
        raise ValueError("Must be a valid id")
    return value


ObjectIdStr = Annotated[str, AfterValidator(_validate_object_id)]


def _strip_or_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


OptionalText = Annotated[str | None, AfterValidator(_strip_or_none)]


class ApiModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class PageParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=200)

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.page_size


def make_page(items: list, total: int, params: PageParams) -> dict:
    pages = (total + params.page_size - 1) // params.page_size if total else 0
    return {
        "items": items,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": pages,
    }
