from datetime import date
from typing import Optional

from pydantic import BaseModel


class MilestoneCreateIn(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    planned_hours: Optional[float] = 0
    planned_budget: Optional[float] = 0
    planned_progress: Optional[float] = 0
    status: Optional[str] = "pending"
    owner_resource_id: Optional[int] = None
    sort_order: Optional[int] = None
    date: Optional[date] = None


class MilestoneUpdateIn(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    planned_hours: Optional[float] = None
    planned_budget: Optional[float] = None
    planned_progress: Optional[float] = None
    status: Optional[str] = None
    owner_resource_id: Optional[int] = None
    sort_order: Optional[int] = None
    date: Optional[date] = None


class MilestoneOut(BaseModel):
    id: int
    project_id: int
    name: str
    title: str
    description: Optional[str] = None
    planned_start_date: Optional[str] = None
    planned_end_date: Optional[str] = None
    actual_start_date: Optional[str] = None
    actual_end_date: Optional[str] = None
    planned_hours: float = 0
    planned_budget: float = 0
    planned_progress: float = 0
    status: str
    owner_resource_id: Optional[int] = None
    sort_order: int = 0
    date: Optional[str] = None
    owner_resource: Optional[dict] = None
    deliverables: list[dict] = []
    deliverables_count: int = 0


class MilestoneListOut(BaseModel):
    milestones: list[MilestoneOut]


class MilestoneDependencyMilestoneOut(BaseModel):
    id: int
    project_id: int
    name: str
    title: str
    status: str
    sort_order: int = 0


class MilestoneDependencyCreateIn(BaseModel):
    predecessor_milestone_id: int
    successor_milestone_id: int
    dependency_type: Optional[str] = "finish_to_start"


class MilestoneDependencyUpdateIn(BaseModel):
    predecessor_milestone_id: Optional[int] = None
    successor_milestone_id: Optional[int] = None
    dependency_type: Optional[str] = None


class MilestoneDependencyOut(BaseModel):
    id: int
    predecessor_milestone_id: int
    successor_milestone_id: int
    dependency_type: str
    predecessor_milestone: MilestoneDependencyMilestoneOut
    successor_milestone: MilestoneDependencyMilestoneOut
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
