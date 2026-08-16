from typing import Optional
from pydantic import BaseModel


class CRCreateIn(BaseModel):
    project_id: int
    title: str
    description: Optional[str] = None
    type: Optional[str] = None
    impact: Optional[str] = None
    justification: Optional[str] = None
    estimated_hours: Optional[float] = None
    estimated_cost: Optional[float] = None
    requested_for: Optional[str] = None


class CRUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    impact: Optional[str] = None
    justification: Optional[str] = None
    estimated_hours: Optional[float] = None
    estimated_cost: Optional[float] = None
    status: Optional[str] = None
