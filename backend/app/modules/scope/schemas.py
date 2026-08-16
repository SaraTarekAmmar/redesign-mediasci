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


class ScopeDeliverableCreateIn(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[Union[str, date]] = None
    dueDate: Optional[Union[str, date]] = None
    status: Optional[str] = "pending"

    @field_validator("due_date", "dueDate", mode="before")
    def parse_dates(cls, v):
        return _parse_date(v)


class ScopeDeliverableUpdateIn(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[Union[str, date]] = None
    dueDate: Optional[Union[str, date]] = None
    status: Optional[str] = None

    @field_validator("due_date", "dueDate", mode="before")
    def parse_dates(cls, v):
        return _parse_date(v)


class ScopeObjectiveCreateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


class ScopeObjectiveUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
