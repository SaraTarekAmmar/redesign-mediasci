from typing import Optional
from pydantic import BaseModel


class StakeholderCreateIn(BaseModel):
    name: str
    role: Optional[str] = None
    organization: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    influence: Optional[str] = None
    influence_level: Optional[str] = None
    interest: Optional[str] = None
    interest_level: Optional[str] = None
    communicationPreference: Optional[str] = None
    communication_preference: Optional[str] = None
    status: Optional[str] = "Active"
    notes: Optional[str] = None
    project_id: Optional[int] = None


class StakeholderUpdateIn(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    organization: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    influence: Optional[str] = None
    influence_level: Optional[str] = None
    interest: Optional[str] = None
    interest_level: Optional[str] = None
    communicationPreference: Optional[str] = None
    communication_preference: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class EngagementCreateIn(BaseModel):
    type: Optional[str] = None
    notes: Optional[str] = None
    next_action: Optional[str] = None
    next_action_date: Optional[str] = None
    engagement_date: Optional[str] = None


class ImpactCreateIn(BaseModel):
    area: Optional[str] = None
    level: Optional[str] = "Medium"
    description: Optional[str] = None
    mitigation_strategy: Optional[str] = None
