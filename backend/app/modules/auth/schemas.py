"""
Auth module schemas — login, profile, user output.
"""
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    timezone: Optional[str] = None
    dark_mode: Optional[bool] = None
    password: Optional[str] = None
    password_confirmation: Optional[str] = None


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    name: str


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    bio: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    timezone: Optional[str] = "UTC"
    avatar: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    last_active_at: Optional[str] = None
    roles: list[RoleOut] = []
    permissions: list[str] = []
    teams: list[TeamOut] = []
    department_id: Optional[int] = None


class AuthResponse(BaseModel):
    user: UserOut
    token: str
