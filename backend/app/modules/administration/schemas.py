"""
Administration module schemas.
"""
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime


# ── User Management ──────────────────────────────────────────────────────────

class UserCreateIn(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    # Job Title / Role — business-facing title that maps to existing RBAC roles.
    # Prefer `role` (slug). `job_title` is accepted as an alias for the same concept.
    job_title: Optional[str] = None
    department_id: Optional[int] = None
    team_id: Optional[int] = None
    # RBAC role slug (model_has_roles). Required unless job_title is provided.
    role: Optional[str] = None
    password: Optional[str] = "password"
    is_active: Optional[bool] = True


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    # Job Title / Role alias — updating this replaces RBAC assignment + users.job_title.
    job_title: Optional[str] = None
    department_id: Optional[int] = None
    team_id: Optional[int] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserListOut(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[int] = None
    is_active: bool
    avatar_url: Optional[str] = None
    deleted_at: Optional[str] = None
    role: str = ""
    department: Optional[dict] = None
    teams: list[dict] = []


# ── Departments ──────────────────────────────────────────────────────────────

class DepartmentCreateIn(BaseModel):
    name: str
    description: Optional[str] = None
    manager_id: Optional[int] = None
    team_leader_id: Optional[int] = None
    color: Optional[str] = None
    type: Optional[str] = "department"


class DepartmentUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    manager_id: Optional[int] = None
    team_leader_id: Optional[int] = None
    color: Optional[str] = None
    type: Optional[str] = None


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str] = None
    manager_id: Optional[int] = None
    color: Optional[str] = None
    created_at: Optional[datetime] = None


# ── Teams ──────────────────────────────────────────────────────────

class TeamCreateIn(BaseModel):
    name: str
    department_id: int
    slug: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    owner_id: Optional[int] = None
    is_active: Optional[bool] = True


class TeamUpdateIn(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    owner_id: Optional[int] = None
    is_active: Optional[bool] = None


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    department_id: Optional[int] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    owner_id: Optional[int] = None
    is_active: bool = True
    members_count: int = 0
    department: Optional[dict] = None
    created_at: Optional[datetime] = None


class TeamMemberCreateIn(BaseModel):
    user_id: int
    role: Optional[str] = "member"


class TeamMemberUpdateIn(BaseModel):
    role: str


class TeamMemberUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[int] = None


class TeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    team_id: int
    user_id: int
    role: str = "member"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user: TeamMemberUserOut


# ── Skills ───────────────────────────────────────────────────────────────────

class SkillCreateIn(BaseModel):
    name: str
    category: Optional[str] = None


class SkillUpdateIn(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    category: Optional[str] = None


class UserSkillAssignmentIn(BaseModel):
    skill_id: int
    proficiency_level: Optional[str] = "Intermediate"
    years_of_experience: Optional[float] = 0.0


class TeamMemberWorkforceUpdateIn(BaseModel):
    position: Optional[str] = None
    seniority: Optional[str] = None
    capacity: Optional[int] = None
    availability: Optional[str] = None
    hourly_cost: Optional[float] = None
    salary: Optional[float] = None
    currency: Optional[str] = None
    department_id: Optional[int] = None
    team_ids: Optional[list[int]] = None
    skills: Optional[list[UserSkillAssignmentIn]] = None


class TeamMemberWorkforceCreateIn(BaseModel):
    name: str
    email: EmailStr
    password: Optional[str] = "password123"
    phone: Optional[str] = None
    bio: Optional[str] = None
    position: str
    seniority: Optional[str] = "Mid"
    capacity: Optional[int] = 40
    availability: Optional[str] = "Available"
    salary: Optional[float] = None
    currency: Optional[str] = "USD"
    department_id: int
    team_ids: Optional[list[int]] = None
    skills: Optional[list[UserSkillAssignmentIn]] = None


# ── Admin Tasks ───────────────────────────────────────────────────────────────

class AdminTaskCreateIn(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = "medium"
    assigned_to: Optional[int] = None
    due_date: Optional[str] = None


class AdminTaskUpdateIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[str] = None


class AdminTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: str = "pending"
    assigned_to: Optional[int] = None
    due_date: Optional[str] = None
    created_at: Optional[datetime] = None
