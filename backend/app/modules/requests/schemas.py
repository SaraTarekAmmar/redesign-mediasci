from typing import Optional
from pydantic import BaseModel


class RequestCreateIn(BaseModel):
    client_id: int
    title: str
    description: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[str] = "medium"
    estimated_hours: Optional[float] = None
    estimated_cost: Optional[float] = None
    due_date: Optional[str] = None


class RequestUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    estimated_hours: Optional[float] = None
    estimated_cost: Optional[float] = None
    due_date: Optional[str] = None
