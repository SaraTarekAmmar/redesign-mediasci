from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from typing import Optional


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    password_confirmation: str
    timezone: Optional[str] = "UTC"


class RoleOut(BaseModel):
    name: str


class TeamBrief(BaseModel):
    id: int
    name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    bio: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    timezone: Optional[str] = "UTC"
    avatar: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = True
    last_active_at: Optional[datetime] = None
    roles: list[RoleOut] = []
    teams: list[TeamBrief] = []


class AuthResponse(BaseModel):
    user: UserOut
    token: str


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    job_title: Optional[str] = None
    timezone: Optional[str] = None
    dark_mode: Optional[bool] = None
    password: Optional[str] = None
    password_confirmation: Optional[str] = None
