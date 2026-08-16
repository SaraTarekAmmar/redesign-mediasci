from datetime import date
from typing import Optional, Union

from pydantic import BaseModel, field_validator


def _parse_date(v):
    if v is None:
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        v = v.strip()
        if not v:
            return None
        try:
            from datetime import datetime
            return datetime.strptime(v[:10], "%Y-%m-%d").date()
        except Exception:
            return None
    return None


class DeliverableCreateIn(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    planned_completion_date: Optional[Union[str, date]] = None
    actual_completion_date: Optional[Union[str, date]] = None
    due_date: Optional[Union[str, date]] = None
    date: Optional[Union[str, date]] = None
    status: Optional[str] = "pending"
    owner_resource_id: Optional[int] = None

    @field_validator("planned_completion_date", "actual_completion_date", "due_date", "date", mode="before")
    def parse_dates(cls, v):
        return _parse_date(v)


class DeliverableUpdateIn(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    planned_completion_date: Optional[Union[str, date]] = None
    actual_completion_date: Optional[Union[str, date]] = None
    due_date: Optional[Union[str, date]] = None
    date: Optional[Union[str, date]] = None
    status: Optional[str] = None
    owner_resource_id: Optional[int] = None

    @field_validator("planned_completion_date", "actual_completion_date", "due_date", "date", mode="before")
    def parse_dates(cls, v):
        return _parse_date(v)


class DeliverableOut(BaseModel):
    id: int
    milestone_id: int
    title: str
    name: str
    description: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    planned_completion_date: Optional[str] = None
    actual_completion_date: Optional[str] = None
    status: str
    owner_resource_id: Optional[int] = None
    owner_resource: Optional[dict] = None
    date: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
