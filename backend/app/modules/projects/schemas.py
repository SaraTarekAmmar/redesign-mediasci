"""Projects module schemas."""
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime, date


class ProjectCreateIn(BaseModel):
    name: str
    key: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    classification: Optional[str] = None
    presale_type: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    client_id: Optional[int] = None

    client_request_id: Optional[int] = None
    team_id: Optional[int] = None
    team_ids: Optional[list[int]] = None
    resource_ids: Optional[list[int]] = None
    partner_ids: Optional[list[int]] = None
    partner_team_ids: Optional[list[int]] = None
    partner_member_ids: Optional[list[int]] = None
    settings: Optional[dict] = None
    color: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_presale: Optional[bool] = False


class ProjectUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    classification: Optional[str] = None
    presale_type: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    client_id: Optional[int] = None
    client_request_id: Optional[int] = None
    team_id: Optional[int] = None
    team_ids: Optional[list[int]] = None
    resource_ids: Optional[list[int]] = None
    partner_ids: Optional[list[int]] = None
    partner_team_ids: Optional[list[int]] = None
    partner_member_ids: Optional[list[int]] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    owner_id: Optional[int] = None
    settings: Optional[dict] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    color: Optional[str] = None
    is_presale: Optional[bool] = None


class ProjectMemberIn(BaseModel):
    user_id: int
    role: Optional[str] = "member"


class ProjectTeamIn(BaseModel):
    team_id: int


class ProjectPartnerIn(BaseModel):
    partner_id: int


class ProjectPartnerTeamIn(BaseModel):
    partner_team_id: int


class ProjectPartnerMemberIn(BaseModel):
    partner_member_id: int


class IssueStatusCreateIn(BaseModel):
    name: str
    color: Optional[str] = "#6B7280"
    category: Optional[str] = "todo"
    position: Optional[int] = 0


class IssueStatusUpdateIn(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    category: Optional[str] = None
    position: Optional[int] = None


class IssueLabelCreateIn(BaseModel):
    name: str
    color: Optional[str] = "#6B7280"


class CustomFieldCreateIn(BaseModel):
    name: str
    field_type: str  # text, number, date, select, multiselect, boolean
    description: Optional[str] = None
    options: Optional[list[str]] = None
    required: Optional[bool] = False


class ProjectSettingUpdateIn(BaseModel):
    key: str
    value: str
