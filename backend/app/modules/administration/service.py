"""
Administration Service — business logic for user management, departments, skills.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    DuplicateEmailException,
    ForbiddenException,
    NotFoundException,
    PasswordMismatchException,
)
from app.models.user import User, team_user
from app.models.team import Department, Team
from app.security import hash_password
from app.modules.auth.service import get_user_roles, get_user_permissions
from app.modules.administration import repository as repo

logger = logging.getLogger("operation_hub.administration")

PROTECTED_ROLE = "super-admin"

# Job Title / Role display labels. Business-facing title == RBAC role.
ROLE_DISPLAY_LABELS = {
    "super-admin": "Super Admin",
    "admin": "Admin",
    "project-manager": "Project Manager",
    "team-leader": "Team Leader",
    "developer": "Developer",
    "member": "Member",
    "viewer": "Viewer",
    "account-manager": "Account Manager",
    "department-manager": "Department Manager",
    "hr-manager": "HR Manager",
    "reviewer": "Reviewer",
    "executive": "Executive",
    "partner": "Partner",
    "client": "Client",
}


def _normalize_role_name(role: str) -> str:
    return (role or "").strip().lower().replace("_", "-").replace(" ", "-")


def job_title_for_role(role_slug: str) -> str:
    """Human-readable Job Title / Role stored on users.job_title."""
    return ROLE_DISPLAY_LABELS.get(
        role_slug,
        role_slug.replace("-", " ").title(),
    )


def validate_role_assignment(
    db: Session,
    role_name: str,
    *,
    actor_roles: set[str],
) -> str:
    """
    Validate Job Title / Role for create/update against existing RBAC roles.

    - Role must exist in the roles table
    - Only super-admin may assign the super-admin role (privilege escalation guard)
    """
    normalized = _normalize_role_name(role_name)
    if not normalized:
        raise BadRequestException("A job title / role is required.")

    role_obj = repo.get_role_by_name(db, normalized)
    if not role_obj:
        raise BadRequestException(f"Role '{role_name}' does not exist.")

    actor = {_normalize_role_name(r) for r in actor_roles}
    if normalized == PROTECTED_ROLE and PROTECTED_ROLE not in actor:
        raise ForbiddenException(
            "Only a Super Admin can assign the Super Admin role."
        )

    return normalized


# Backward-compatible alias used by older call sites / tests.
validate_global_role_assignment = validate_role_assignment


def format_user(user: User, db: Session) -> dict:
    """Serialize user to API response dict."""
    roles = get_user_roles(user.id, db)
    permissions = get_user_permissions(user.id, db)
    department = None
    if user.department_id:
        department = db.execute(
            select(Department.__table__.c.id, Department.__table__.c.name)
            .select_from(Department.__table__)
            .where(Department.__table__.c.id == user.department_id)
        ).first()
    teams = db.execute(
        select(Team.__table__.c.id, Team.__table__.c.name)
        .select_from(Team.__table__)
        .join(team_user, team_user.c.team_id == Team.__table__.c.id)
        .where(team_user.c.user_id == user.id)
        .order_by(Team.__table__.c.name)
    ).all()
    role_slug = roles[0] if roles else ""
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        # Job Title / Role — prefer persisted title; fall back to RBAC display label.
        "job_title": user.job_title or (job_title_for_role(role_slug) if role_slug else None),
        "department_id": user.department_id,
        "is_active": bool(user.is_active),
        "avatar_url": user.avatar_url,
        "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
        # Never invent a role — authorization reads model_has_roles only.
        "role": role_slug,
        "permissions": permissions,
        "department": (
            {"id": int(department.id), "name": department.name}
            if department
            else None
        ),
        "teams": [{"id": int(team.id), "name": team.name} for team in teams],
    }


def create_user(
    db: Session,
    *,
    name: str,
    email: str,
    phone: Optional[str],
    job_title: Optional[str],
    department_id: Optional[int],
    team_id: Optional[int],
    role: Optional[str],
    password: str,
    creator_id: int,
    actor_roles: set[str],
    is_active: bool = True,
) -> User:
    existing = repo.get_user_by_email(db, email)
    if existing:
        raise DuplicateEmailException()

    # Job Title / Role is one concept: accept `role` and/or `job_title`, map to RBAC.
    role_input = (role or "").strip() or (job_title or "").strip()
    resolved_role = validate_role_assignment(
        db, role_input, actor_roles=actor_roles
    )
    display_title = job_title_for_role(resolved_role)

    user = repo.create_user(
        db,
        name=name,
        email=email,
        phone=phone,
        job_title=display_title,
        department_id=department_id,
        password=hash_password(password),
        is_active=bool(is_active),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    repo.assign_role_to_user(db, user.id, resolved_role)

    if team_id:
        repo.add_user_to_team(db, user.id, team_id)

    db.commit()
    db.refresh(user)
    logger.info(
        "User created: %s (id=%d, job_title=%s, role=%s) by admin id=%d",
        email,
        user.id,
        display_title,
        resolved_role,
        creator_id,
    )
    return user


def update_user(
    db: Session,
    user_id: int,
    data: dict,
    *,
    actor_roles: set[str],
) -> User:
    user = repo.get_user_by_id(db, user_id)
    if not user:
        raise NotFoundException("User", user_id)

    if "password" in data and data["password"]:
        user.password = hash_password(data["password"])

    for field in ("name", "email", "phone", "department_id", "is_active"):
        if field in data and data[field] is not None:
            setattr(user, field, data[field])

    # Unified Job Title / Role: `role` or `job_title` both update RBAC + users.job_title.
    role_input = None
    if "role" in data:
        role_input = data["role"]
    elif "job_title" in data:
        role_input = data["job_title"]

    if role_input is not None:
        if not str(role_input).strip():
            raise BadRequestException("A job title / role is required.")
        resolved_role = validate_role_assignment(
            db, str(role_input), actor_roles=actor_roles
        )
        repo.assign_role_to_user(db, user.id, resolved_role)
        user.job_title = job_title_for_role(resolved_role)

    if "team_id" in data:
        from app.models.user import team_user
        db.execute(team_user.delete().where(team_user.c.user_id == user.id))
        if data["team_id"]:
            repo.add_user_to_team(db, user.id, data["team_id"])

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def soft_delete_user(db: Session, user_id: int) -> None:
    user = repo.get_user_by_id(db, user_id)
    if not user:
        raise NotFoundException("User", user_id)
    repo.soft_delete_user(db, user)
    db.commit()


def hard_delete_user(db: Session, user_id: int) -> None:
    user = repo.get_user_by_id(db, user_id, include_deleted=True)
    if not user:
        raise NotFoundException("User", user_id)
    repo.hard_delete_user(db, user)
    db.commit()


def restore_user(db: Session, user_id: int) -> User:
    user = repo.get_user_by_id(db, user_id, include_deleted=True)
    if not user:
        raise NotFoundException("User", user_id)
    repo.restore_user(db, user)
    db.commit()
    db.refresh(user)
    return user


def activate_user(db: Session, user_id: int) -> User:
    user = repo.get_user_by_id(db, user_id)
    if not user:
        raise NotFoundException("User", user_id)
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


def deactivate_user(db: Session, user_id: int) -> User:
    user = repo.get_user_by_id(db, user_id)
    if not user:
        raise NotFoundException("User", user_id)
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user
