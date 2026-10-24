from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import ApiModel, ObjectIdStr, Role


class DeveloperCreate(ApiModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    role: Role
    is_active: bool = True

    @field_validator("email")
    @classmethod
    def _lower(cls, value: str) -> str:
        return value.lower()


class DeveloperUpdate(ApiModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    email: EmailStr | None = None
    role: Role | None = None

    @field_validator("email")
    @classmethod
    def _lower(cls, value: str | None) -> str | None:
        return value.lower() if value else value


class ReassignTasks(ApiModel):
    target_developer_id: ObjectIdStr
    only_open: bool = True


class DeveloperOut(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    is_active: bool
    task_count: int = 0
    open_task_count: int = 0
    created_at: datetime
    updated_at: datetime


class ReassignResult(BaseModel):
    moved: int
    target_developer_id: str
