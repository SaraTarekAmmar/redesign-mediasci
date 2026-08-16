from pydantic import BaseModel, ConfigDict
from datetime import datetime, date
from typing import Optional, Any


class PaginatedResponse(BaseModel):
    data: list[Any] = []
    current_page: int = 1
    per_page: int = 15
    total: int = 0
    last_page: int = 1


class MessageResponse(BaseModel):
    message: str


class IDResponse(BaseModel):
    id: int
    message: str = "Created"


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    key: Optional[str] = None
    type: Optional[str] = None
    classification: Optional[str] = None
    category: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    team_id: Optional[int] = None
    status: Optional[str] = "active"
    notes: Optional[str] = None
    client_id: Optional[int] = None
    company_name: Optional[str] = None
    presale_type: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    key: Optional[str] = None
    type: Optional[str] = None
    classification: Optional[str] = None
    category: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    team_id: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    client_id: Optional[int] = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class IssueBase(BaseModel):
    title: str
    description: Optional[str] = None
    issue_type_id: Optional[int] = None
    issue_status_id: Optional[int] = None
    issue_priority_id: Optional[int] = None
    assignee_id: Optional[int] = None
    epic_id: Optional[int] = None
    story_id: Optional[int] = None
    parent_id: Optional[int] = None
    story_points: Optional[int] = None
    estimate_minutes: Optional[int] = None
    due_date: Optional[date] = None
    start_date: Optional[date] = None
    position: Optional[int] = 0
    color: Optional[str] = None


class IssueCreate(IssueBase):
    project_id: Optional[int] = None


class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    issue_type_id: Optional[int] = None
    issue_status_id: Optional[int] = None
    issue_priority_id: Optional[int] = None
    assignee_id: Optional[int] = None
    epic_id: Optional[int] = None
    story_id: Optional[int] = None
    parent_id: Optional[int] = None
    story_points: Optional[int] = None
    estimate_minutes: Optional[int] = None
    remaining_minutes: Optional[int] = None
    due_date: Optional[date] = None
    start_date: Optional[date] = None
    position: Optional[int] = None
    color: Optional[str] = None


class IssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    key: Optional[str] = None
    title: str
    description: Optional[str] = None
    project_id: int
    issue_type_id: Optional[int] = None
    issue_status_id: Optional[int] = None
    issue_priority_id: Optional[int] = None
    assignee_id: Optional[int] = None
    reporter_id: Optional[int] = None
    epic_id: Optional[int] = None
    story_id: Optional[int] = None
    parent_id: Optional[int] = None
    story_points: Optional[int] = None
    estimate_minutes: Optional[int] = None
    remaining_minutes: Optional[int] = None
    due_date: Optional[date] = None
    start_date: Optional[date] = None
    position: Optional[int] = 0
    color: Optional[str] = None
    triage_status: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SprintBase(BaseModel):
    name: str
    goal: Optional[str] = None
    notes: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = "planning"
    board_id: Optional[int] = None
    capacity_hours: Optional[int] = None
    duration: Optional[int] = None


class SprintCreate(SprintBase):
    project_id: int


class SprintUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    notes: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    capacity_hours: Optional[int] = None


class SprintOut(SprintBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    completed_at: Optional[datetime] = None
    velocity: Optional[int] = None
    created_at: Optional[datetime] = None


class CommentCreate(BaseModel):
    body: str
    parent_id: Optional[int] = None


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    issue_id: int
    user_id: int
    body: str
    parent_id: Optional[int] = None
    created_at: Optional[datetime] = None


class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None


class TeamOut(TeamBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slug: Optional[str] = None
    owner_id: Optional[int] = None
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
