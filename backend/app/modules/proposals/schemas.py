from typing import Optional
from pydantic import BaseModel


class ProposalCreateIn(BaseModel):
    client_request_id: Optional[int] = None
    rfp_id: Optional[int] = None
    title: str
    status: Optional[str] = "draft"


class ProposalVersionIn(BaseModel):
    content: Optional[str] = None
    summary: Optional[str] = None
    estimated_hours: Optional[float] = None
    estimated_cost: Optional[float] = None
    changes: Optional[str] = None


class RfpCreateIn(BaseModel):
    title: str
    content: Optional[str] = None
    client_id: Optional[int] = None
    deadline: Optional[str] = None
    budget_range: Optional[str] = None
    requirements: Optional[str] = None
    status: Optional[str] = "open"
