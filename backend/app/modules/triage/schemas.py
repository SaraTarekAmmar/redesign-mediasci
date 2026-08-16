from typing import Optional

from pydantic import BaseModel


class TriageUpdateIn(BaseModel):
    triage_status: Optional[str] = None
    triage_notes: Optional[str] = None
    status: Optional[str] = None  # legacy alias
    notes: Optional[str] = None  # legacy alias


class TriageIssueOut(BaseModel):
    id: int
    key: str
    title: str
    description: Optional[str] = None
    triage_status: str
    triage_notes: Optional[str] = None
    created_at: str
    project: Optional[dict] = None
    reporter: Optional[dict] = None
    assignee: Optional[dict] = None
    type: Optional[dict] = None
