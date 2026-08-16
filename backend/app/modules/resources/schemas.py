from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr


class ResourceSkillIn(BaseModel):
    skill_id: Optional[int] = None
    name: Optional[str] = None
    proficiency: Optional[str] = "mid"
    years_of_experience: Optional[float] = 1.0


class ResourceCreateIn(BaseModel):
    name: str
    email: EmailStr
    password: Optional[str] = "password123"
    employee_number: Optional[str] = None
    position: Optional[str] = "Team Member"
    seniority: Optional[str] = "Mid"
    department_id: Optional[int] = None
    salary: Optional[float] = 0.0
    currency: Optional[str] = "USD"
    cost_per_hour: Optional[float] = 0.0
    weekly_capacity: Optional[float] = 40.0
    daily_capacity_hours: Optional[float] = 8.0
    availability_status: Optional[str] = "available"
    contract_type: Optional[str] = "full_time"
    phone: Optional[str] = None
    bio: Optional[str] = None
    team_ids: Optional[List[int]] = []
    skills: Optional[List[Any]] = []
    certifications: Optional[List[str]] = []
    experience_years: Optional[float] = 0.0
    manager_id: Optional[int] = None
    hire_date: Optional[str] = None
    is_active: Optional[bool] = True


class ResourceUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    employee_number: Optional[str] = None
    position: Optional[str] = None
    seniority: Optional[str] = None
    department_id: Optional[int] = None
    salary: Optional[float] = None
    currency: Optional[str] = None
    cost_per_hour: Optional[float] = None
    weekly_capacity: Optional[float] = None
    daily_capacity_hours: Optional[float] = None
    availability_status: Optional[str] = None
    contract_type: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    team_ids: Optional[List[int]] = None
    skills: Optional[List[Any]] = None
    certifications: Optional[List[str]] = None
    experience_years: Optional[float] = None
    manager_id: Optional[int] = None
    hire_date: Optional[str] = None
    is_active: Optional[bool] = None


class AllocationCreateIn(BaseModel):
    resource_id: int
    project_id: Optional[int] = None
    task_id: Optional[int] = None
    allocation_pct: Optional[int] = 100
    allocated_hours: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    role: Optional[str] = None


class AvailabilitySetIn(BaseModel):
    resource_id: int
    date: str
    available_hours: float
    reason: Optional[str] = None
    note: Optional[str] = None


class ProjectResourceAssignmentCreateIn(BaseModel):
    resource_id: int
    allocation_pct: Optional[int] = 100
    allocated_hours: Optional[float] = None
    role: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ProjectResourceAssignmentUpdateIn(BaseModel):
    allocation_pct: Optional[int] = None
    allocated_hours: Optional[float] = None
    role: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
