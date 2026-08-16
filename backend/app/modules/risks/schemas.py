from typing import Optional
from pydantic import BaseModel


class RiskCreateIn(BaseModel):
    project_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    probability: Optional[int] = 2      # 1-5
    impact: Optional[int] = 2           # 1-5
    severity: Optional[str] = None
    owner: Optional[str] = None
    owner_user_id: Optional[int] = None
    response_plan: Optional[str] = None
    contingency_plan: Optional[str] = None
    due_date: Optional[str] = None


class RiskUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    probability: Optional[int] = None
    impact: Optional[int] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    owner: Optional[str] = None
    owner_user_id: Optional[int] = None
    response_plan: Optional[str] = None
    contingency_plan: Optional[str] = None
    due_date: Optional[str] = None
