"""Issues module schemas for Sprint 6."""
from pydantic import BaseModel, field_validator
from typing import Optional, Any, Union


class IssueCreateIn(BaseModel):
    title: str
    description: Optional[str] = None
    issue_type_id: Optional[int] = None
    issue_status_id: Optional[int] = None
    issue_priority_id: Optional[int] = None
    assignee_id: Optional[int] = None
    external_assignee_id: Optional[int] = None
    reporter_id: Optional[int] = None
    reported_to: Optional[list[int]] = []
    epic_id: Optional[int] = None
    sprint_id: Optional[int] = None
    story_points: Optional[int] = None
    due_date: Optional[str] = None
    label_ids: Optional[list[int]] = []
    parent_id: Optional[int] = None
    milestone_id: Optional[int] = None
    deliverable_id: Optional[int] = None
    custom_fields: Optional[dict[str, Any]] = {}
    position: Optional[int] = 0
    project_id: Optional[int] = None

    # Sprint 6 Execution & AI fields
    acceptance_criteria: Optional[str] = None
    definition_of_ready: Optional[str] = None
    definition_of_done: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    remaining_hours: Optional[float] = None
    completion_percentage: Optional[int] = 0

    ai_estimated_hours: Optional[float] = None
    ai_priority: Optional[str] = None
    ai_risk: Optional[str] = None
    ai_suggested_resource_id: Optional[int] = None
    ai_similar_tasks: Optional[list[Any]] = None
    ai_confidence_score: Optional[float] = None


class IssueUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    issue_status_id: Optional[int] = None
    issue_priority_id: Optional[int] = None
    assignee_id: Optional[Union[int, str]] = None
    external_assignee_id: Optional[Union[int, str]] = None
    reported_to: Optional[list[int]] = None
    epic_id: Optional[int] = None
    sprint_id: Optional[int] = None
    story_points: Optional[int] = None
    due_date: Optional[str] = None
    label_ids: Optional[list[int]] = None
    issue_type_id: Optional[int] = None
    parent_id: Optional[int] = None
    milestone_id: Optional[int] = None
    deliverable_id: Optional[int] = None
    custom_fields: Optional[dict[str, Any]] = None

    # Sprint 6 Execution & AI fields
    acceptance_criteria: Optional[str] = None
    definition_of_ready: Optional[str] = None
    definition_of_done: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    remaining_hours: Optional[float] = None
    completion_percentage: Optional[int] = None

    ai_estimated_hours: Optional[float] = None
    ai_priority: Optional[str] = None
    ai_risk: Optional[str] = None
    ai_suggested_resource_id: Optional[int] = None
    ai_similar_tasks: Optional[list[Any]] = None
    ai_confidence_score: Optional[float] = None

    @field_validator("assignee_id", "external_assignee_id", mode="before")
    @classmethod
    def coerce_assignee_id(cls, value):
        if value is None or value == "" or value == "unassigned":
            return None
        return int(value)


class IssueReorderIn(BaseModel):
    positions: list[dict]  # [{id, position, status_id}]


class IssueTriageIn(BaseModel):
    status: str  # new, triaging, confirmed, dismissed
    notes: Optional[str] = None
    priority_id: Optional[int] = None


class CommentCreateIn(BaseModel):
    body: str
    parent_id: Optional[int] = None


class CommentUpdateIn(BaseModel):
    body: str


class TimeLogCreateIn(BaseModel):
    hours: float
    description: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    billable: Optional[bool] = False


class TimeLogUpdateIn(BaseModel):
    hours: Optional[float] = None
    description: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    billable: Optional[bool] = None


class DependencyCreateIn(BaseModel):
    depends_on_id: int
    relationship: Optional[str] = "blocks"  # blocks, blocked_by, related_to, duplicate_of, parent, child
    dependency_type: Optional[str] = "finish_to_start"  # finish_to_start, start_to_start, finish_to_finish, start_to_finish


class ChecklistCreateIn(BaseModel):
    title: str
    completed: Optional[bool] = False


class ChecklistUpdateIn(BaseModel):
    title: Optional[str] = None
    completed: Optional[bool] = None


class AttachmentCreateIn(BaseModel):
    original_filename: str
    mime_type: Optional[str] = "application/octet-stream"
    file_size: Optional[int] = 0
    storage_path: Optional[str] = ""


class SubtaskCreateIn(BaseModel):
    title: str
    estimated_hours: Optional[float] = 0.0
