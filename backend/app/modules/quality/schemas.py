from typing import Optional
from pydantic import BaseModel, Field


class HandoffIn(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")
    comments: str = Field(..., min_length=1)


class RuleCreateIn(BaseModel):
    project_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    type: Optional[str] = "syntax"  # syntax, compliance, security, logic
    config: Optional[dict] = {}
    status: Optional[str] = "active"
