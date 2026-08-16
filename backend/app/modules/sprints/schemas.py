from typing import Optional
from pydantic import BaseModel


class SprintCreateIn(BaseModel):
    name: str
    goal: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    project_id: Optional[int] = None


class SprintUpdateIn(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None


class CompleteSprintIn(BaseModel):
    move_incomplete_to: Optional[int] = None  # sprint_id to move unfinished issues
