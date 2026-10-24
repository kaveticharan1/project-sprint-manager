import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ApiModel, OptionalText

TAG_PATTERN = re.compile(r"^[A-Z0-9]{2,8}$")


def normalize_tag(value: str) -> str:
    value = value.strip().upper()
    if not TAG_PATTERN.match(value):
        raise ValueError("Tag must be 2-8 characters, letters A-Z and digits 0-9 only")
    return value


class ProductCreate(ApiModel):
    name: str = Field(min_length=2, max_length=100)
    tag: str
    description: OptionalText = Field(None, max_length=2000)

    @field_validator("tag")
    @classmethod
    def _tag(cls, value: str) -> str:
        return normalize_tag(value)


class ProductUpdate(ApiModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    tag: str | None = None
    description: OptionalText = Field(None, max_length=2000)

    @field_validator("tag")
    @classmethod
    def _tag(cls, value: str | None) -> str | None:
        return normalize_tag(value) if value is not None else None


class ProductOut(BaseModel):
    id: str
    name: str
    tag: str
    description: str | None = None
    sprint_count: int = 0
    task_count: int = 0
    open_task_count: int = 0
    tag_locked: bool = False
    created_at: datetime
    updated_at: datetime


class ProductRef(BaseModel):
    id: str
    name: str
    tag: str
