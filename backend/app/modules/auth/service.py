"""
Auth Service — all authentication business logic lives here.
Routers call this service; this service does NOT know about HTTP.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import (
    InvalidCredentialsException,
    PasswordMismatchException,
)
from app.dependencies import _fallback_permissions_for_roles
from app.models.team import Team
from app.models.user import Permission, Role, User, model_has_permissions, role_has_permissions, team_user, user_roles_table
from app.security import create_access_token, hash_password, verify_password

logger = logging.getLogger("operation_hub.auth")


def get_user_roles(user_id: int, db: Session) -> list[str]:
    """Return role names for a user."""
    rows = db.execute(
        select(Role.name)
        .select_from(user_roles_table.join(Role, user_roles_table.c.role_id == Role.id))
        .where(
            user_roles_table.c.model_id == user_id,
            user_roles_table.c.model_type.like("%User"),
        )
    ).scalars().all()
    return list(rows)


def get_user_permissions(user_id: int, db: Session) -> list[str]:
    """Return all permission names (via roles + direct) for a user."""
    # Via roles
    role_perms = db.execute(
        select(Permission.name)
        .select_from(
            user_roles_table
            .join(Role, user_roles_table.c.role_id == Role.id)
            .join(role_has_permissions, role_has_permissions.c.role_id == Role.id)
            .join(Permission, role_has_permissions.c.permission_id == Permission.id)
        )
        .where(
            user_roles_table.c.model_id == user_id,
            user_roles_table.c.model_type.like("%User"),
        )
    ).scalars().all()

    # Direct
    direct_perms = db.execute(
        select(Permission.name)
        .select_from(
            model_has_permissions
            .join(Permission, model_has_permissions.c.permission_id == Permission.id)
        )
        .where(
            model_has_permissions.c.model_id == user_id,
            model_has_permissions.c.model_type.like("%User"),
        )
    ).scalars().all()

    role_names = get_user_roles(user_id, db)
    return sorted(set(list(role_perms) + list(direct_perms) + list(_fallback_permissions_for_roles(set(role_names)))))


def serialize_user(user: User, db: Session) -> dict:
    """Convert a User ORM object to the dict shape expected by UserOut."""
    roles = get_user_roles(user.id, db)
    permissions = get_user_permissions(user.id, db)
    teams = db.execute(
        select(Team.__table__.c.id, Team.__table__.c.name)
        .select_from(Team.__table__)
        .join(team_user, team_user.c.team_id == Team.__table__.c.id)
        .where(team_user.c.user_id == user.id)
        .order_by(Team.__table__.c.name)
    ).all()
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "bio": user.bio,
        "phone": user.phone,
        "job_title": user.job_title,
        "timezone": user.timezone,
        "avatar": user.avatar,
        "avatar_url": user.avatar_url,
        "is_active": bool(user.is_active),
        "last_active_at": user.last_active_at.isoformat() if user.last_active_at else None,
        "roles": [{"name": r} for r in roles],
        "permissions": permissions,
        "teams": [{"id": int(team.id), "name": team.name} for team in teams],
        "department_id": user.department_id,
    }


def login_user(db: Session, email: str, password: str) -> tuple[User, str]:
    """Authenticate a user by email/password. Returns (user, jwt_token)."""
    user = db.query(User).filter(
        User.email == email,
        User.deleted_at.is_(None),
    ).first()

    if user is None or not verify_password(password, user.password):
        raise InvalidCredentialsException()

    if not user.is_active:
        raise InvalidCredentialsException()

    user.last_active_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    logger.info("User %d logged in: %s", user.id, user.email)
    return user, token


def update_profile(db: Session, user: User, payload: dict) -> User:
    """Update a user's own profile fields."""
    password = payload.pop("password", None)
    password_confirmation = payload.pop("password_confirmation", None)

    if password:
        if password != password_confirmation:
            raise PasswordMismatchException()
        user.password = hash_password(password)

    allowed_fields = {"name", "bio", "phone", "job_title", "timezone", "dark_mode"}
    for key, value in payload.items():
        if key in allowed_fields and value is not None and hasattr(user, key):
            setattr(user, key, value)

    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
