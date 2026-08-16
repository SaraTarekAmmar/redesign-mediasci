"""Partners module schemas."""
from pydantic import BaseModel, Field
from typing import Optional


class PartnerCreateIn(BaseModel):
    name: str
    company: Optional[str] = None
    specialty: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = "active"
    notes: Optional[str] = None
    color: Optional[str] = None


class PartnerUpdateIn(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    specialty: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    color: Optional[str] = None


class PartnerMemberCreateIn(BaseModel):
    name: str
    user_id: Optional[int] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None


class PartnerMemberUpdateIn(BaseModel):
    name: Optional[str] = None
    user_id: Optional[int] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class PartnerTeamCreateIn(BaseModel):
    name: str
    description: Optional[str] = None
    member_ids: list[int] = Field(default_factory=list)


class PartnerTeamUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    member_ids: Optional[list[int]] = None


class PartnerTeamMemberIn(BaseModel):
    member_id: int
