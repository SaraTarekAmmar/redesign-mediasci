from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Table, JSON, Float, Numeric,
)
from sqlalchemy.orm import relationship
from app.database import Base

# ── Association tables (Spatie permission system) ──
role_has_permissions = Table(
    "role_has_permissions", Base.metadata,
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

# Spatie uses model_has_roles with model_type + model_id (polymorphic)
user_roles_table = Table(
    "model_has_roles", Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("model_type", String(255), primary_key=True),
    Column("model_id", Integer, primary_key=True),
)

model_has_permissions = Table(
    "model_has_permissions", Base.metadata,
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    Column("model_type", String(255), primary_key=True),
    Column("model_id", Integer, primary_key=True),
)

# ── User-related association tables ──
team_user = Table(
    "team_user", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("team_id", Integer, ForeignKey("teams.id", ondelete="CASCADE")),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE")),
    Column("role", String(50)),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)

project_members = Table(
    "project_members", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE")),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE")),
    Column("role", String(50)),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)

skill_user = Table(
    "skill_user", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("skill_id", Integer, ForeignKey("skills.id", ondelete="CASCADE")),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE")),
    Column("proficiency", String(50)),
    Column("proficiency_level", String(50)),
    Column("years_of_experience", Float),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)


class Permission(Base):
    __tablename__ = "permissions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    guard_name = Column(String(255), nullable=False, default="web")
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    roles = relationship("Role", secondary=role_has_permissions, back_populates="permissions")


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    guard_name = Column(String(255), nullable=False, default="web")
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    permissions = relationship("Permission", secondary=role_has_permissions, back_populates="roles")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    email_verified_at = Column(DateTime)
    password = Column(String(255), nullable=False)
    avatar = Column(String(255))
    bio = Column(Text)
    phone = Column(String(50))
    timezone = Column(String(50), default="UTC")
    job_title = Column(String(255))
    position = Column(String(255))
    seniority = Column(String(50), default="Mid")
    capacity = Column(Integer, default=40)
    availability = Column(String(50), default="Available")
    hourly_cost = Column(Numeric(10, 2), nullable=True)
    salary = Column(Numeric(12, 2), nullable=True)
    currency = Column(String(10), default="USD")
    dark_mode = Column(Boolean, default=False)
    notification_preferences = Column(JSON)
    last_active_at = Column(DateTime)
    department_id = Column(Integer, ForeignKey("departments.id"))
    is_active = Column(Boolean, default=True)
    role_id = Column(Integer)
    remember_token = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    # Relationships
    department = relationship("Department", back_populates="users", foreign_keys=[department_id])
    teams = relationship("Team", secondary=team_user, back_populates="members")
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    projects = relationship("Project", secondary=project_members, back_populates="members")
    assigned_issues = relationship("Issue", back_populates="assignee", foreign_keys="Issue.assignee_id")
    reported_issues = relationship("Issue", back_populates="reporter", foreign_keys="Issue.reporter_id")
    comments = relationship("IssueComment", back_populates="user")
    time_logs = relationship("TimeLog", back_populates="user", foreign_keys="TimeLog.user_id")
    resource = relationship("Resource", back_populates="linked_user", uselist=False)


    achievements = relationship("Achievement", back_populates="user")
    skills = relationship("Skill", secondary=skill_user, back_populates="users")

    @property
    def avatar_url(self) -> str:
        if self.avatar:
            return f"/uploads/{self.avatar}"
        from urllib.parse import quote
        name = quote(self.name or "User")
        return f"https://ui-avatars.com/api/?name={name}&background=4f46e5&color=fff&size=128"

    @property
    def role_names(self) -> list[str]:
        from sqlalchemy.orm import Session, object_session
        db = object_session(self)
        if db is None:
            return []
        rows = db.execute(
            user_roles_table.select().where(user_roles_table.c.model_id == self.id)
        ).fetchall()
        role_ids = [r.role_id for r in rows]
        if not role_ids:
            return []
        roles = db.query(Role).filter(Role.id.in_(role_ids)).all()
        return [r.name for r in roles]
