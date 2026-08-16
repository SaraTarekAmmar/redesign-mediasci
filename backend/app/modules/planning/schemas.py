from datetime import date
from typing import Optional, List, Union, Any
from pydantic import BaseModel, field_validator, model_validator


class PlanCreateIn(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "draft"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    project_id: Optional[Union[int, str]] = None
    type: Optional[str] = None

    @field_validator("project_id", mode="before")
    @classmethod
    def coerce_project_id(cls, value):
        if value is None or value == "":
            return None
        return int(value)


class PlanUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    type: Optional[str] = None
    project_id: Optional[Union[int, str]] = None

    @field_validator("project_id", mode="before")
    @classmethod
    def coerce_project_id(cls, value):
        if value is None or value == "":
            return None
        return int(value)


class PlanTaskCreateIn(BaseModel):
    plan_id: Optional[int] = None
    project_id: Optional[int] = None
    text: str
    description: Optional[str] = None
    assigned_to: Optional[Any] = None  # user id or display name (frontend sends name)
    status: Optional[str] = "pending"
    priority: Optional[str] = "medium"
    type: Optional[str] = "task"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration: Optional[int] = None
    progress: Optional[int] = 0
    wbs_code: Optional[str] = None
    parent_id: Optional[int] = None
    milestone_id: Optional[int] = None
    sprint_id: Optional[int] = None
    story_points: Optional[int] = None
    cost: Optional[float] = None
    is_milestone: Optional[bool] = False


class PlanTaskUpdateIn(BaseModel):
    text: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[Any] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    type: Optional[str] = None
    start_date: Optional[str] = None
    duration: Optional[int] = None
    progress: Optional[int] = None
    is_milestone: Optional[bool] = None


class MilestoneCreateIn(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    status: Optional[str] = "pending"
    priority: Optional[str] = "medium"
    projects: Optional[List[int]] = None

    @model_validator(mode="after")
    def require_title_or_name(self):
        if not (self.title or self.name):
            raise ValueError("Either title or name is required")
        return self

    @property
    def resolved_title(self) -> str:
        return (self.title or self.name or "").strip()


class DependencyCreateIn(BaseModel):
    source: Union[int, str]
    target: Union[int, str]
    type: Optional[str] = "FS"
    lag: Optional[int] = 0

    @field_validator("source", "target", mode="before")
    @classmethod
    def coerce_ids(cls, value):
        return int(value)


class ProjectBaselineIn(BaseModel):
    planned_duration_days: Optional[int] = 0
    planned_budget: Optional[float] = 0
    planned_hours: Optional[float] = 0
    planned_resources_count: Optional[int] = 0


class ProjectBaselineOut(BaseModel):
    id: int
    project_id: int
    planned_duration_days: int = 0
    planned_budget: float = 0
    planned_hours: float = 0
    planned_resources_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
