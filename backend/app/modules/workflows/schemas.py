from typing import Optional
from pydantic import BaseModel


class TemplateCreateIn(BaseModel):
    name: str
    description: Optional[str] = None
    is_global: Optional[bool] = True


class WorkflowStageCreateIn(BaseModel):
    name: str
    category: Optional[str] = "todo"  # todo, in_progress, review, done
    color: Optional[str] = "#6366F1"
    wip_limit: Optional[int] = None
    is_initial: Optional[bool] = False
    is_final: Optional[bool] = False


class WorkflowStageUpdateIn(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    wip_limit: Optional[int] = None
    is_active: Optional[bool] = None
    is_initial: Optional[bool] = None
    is_final: Optional[bool] = None


class WorkflowStageReorderIn(BaseModel):
    stage_ids: list[int]
