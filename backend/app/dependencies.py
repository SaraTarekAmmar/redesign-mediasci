"""
Operation Hub — FastAPI Dependencies

Provides reusable dependency injection functions for:
- get_current_user: validates JWT and returns the authenticated User
- require_roles(*roles): enforces role-based access
- require_permissions(*perms): enforces permission-based access
"""

import logging
import re
from typing import Callable

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import decode_access_token

logger = logging.getLogger("operation_hub.auth")
bearer_scheme = HTTPBearer(auto_error=False)

WORKFORCE_PERMISSION_FALLBACKS: dict[str, set[str]] = {
    "super-admin": {
        "view-users",
        "manage-users",
        "view-departments",
        "manage-departments",
        "view-teams",
        "manage-teams",
        "view-resources",
        "allocate-resources",
        "manage-project-members",
        "manage-skills",
    },
    "admin": {
        "view-users",
        "manage-users",
        "view-departments",
        "manage-departments",
        "view-teams",
        "manage-teams",
        "view-resources",
        "allocate-resources",
        "manage-project-members",
        "manage-skills",
    },
    "project-manager": {
        "view-departments",
        "manage-departments",
        "view-teams",
        "manage-teams",
        "view-resources",
        "allocate-resources",
        "manage-project-members",
        "manage-skills",
    },
    "team-leader": {
        "view-departments",
        "view-teams",
        "manage-teams",
        "view-resources",
        "allocate-resources",
        "manage-project-members",
        "manage-skills",
    },
    "department-manager": {
        "view-departments",
        "manage-departments",
        "view-teams",
        "manage-teams",
        "view-resources",
        "allocate-resources",
    },
    "hr-manager": {
        "view-users",
        "manage-users",
    },
}


def _fallback_permissions_for_roles(role_names: set[str]) -> set[str]:
    permissions: set[str] = set()
    for role_name in role_names:
        permissions.update(WORKFORCE_PERMISSION_FALLBACKS.get(role_name, set()))
    return permissions


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    auth_cookie: str | None = Cookie(default=None, alias="taskflow_token"),
    db: Session = Depends(get_db),
):
    """
    Extract and validate the JWT from either the Authorization header or the
    taskflow_token httponly cookie.  Returns the authenticated User ORM object.
    """
    from app.models.user import User

    token = (credentials.credentials if credentials else None) or auth_cookie
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
        )

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
        )

    user = db.query(User).filter(
        User.id == int(user_id),
        User.deleted_at.is_(None),
        User.is_active != False,  # noqa: E712 — handles boolean AND tinyint storage
    ).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is inactive.",
        )

    role_names = _get_user_roles(user.id, db)

    # Routes under /admin are the backend surface of the Administration control
    # plane.  Keep the long-standing self-profile lookup available, but do not
    # let a permission granted to a non-admin role expose administrative APIs.
    path = re.sub(
        r"^/(?:api(?:/(?:ops|v1))?|ops(?:/api)?)(?=/)",
        "",
        request.url.path,
    )
    is_admin_surface = (
        path == "/admin"
        or path.startswith("/admin/")
        or path == "/admin-tasks"
        or path.startswith("/admin-tasks/")
    )
    is_self_profile = (
        request.method == "GET"
        and path == f"/admin/users/{user.id}"
    )
    if is_admin_surface and not is_self_profile and not {"super-admin", "admin"}.intersection(role_names):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administration access requires an admin role.",
        )

    # Project access is enforced centrally for every authenticated endpoint
    # carrying a project, issue, or sprint scope.  Capability checks continue
    # to be handled independently by require_permissions/require_roles.
    from app.modules.projects.access import enforce_request_project_access

    enforce_request_project_access(
        db,
        user.id,
        role_names,
        request.path_params,
        request.query_params,
    )
    return user


def _get_user_roles(user_id: int, db: Session) -> set[str]:
    """Return the set of role names for a user."""
    from app.models.user import Role, user_roles_table

    rows = db.execute(
        select(Role.name)
        .select_from(user_roles_table.join(Role, user_roles_table.c.role_id == Role.id))
        .where(
            user_roles_table.c.model_id == user_id,
            user_roles_table.c.model_type.like("%User"),
        )
    ).scalars().all()
    return set(rows)


def _get_user_permissions(user_id: int, role_names: set[str], db: Session) -> set[str]:
    """Return the union of all permission names the user holds via their roles."""
    from app.models.user import Role, Permission, role_has_permissions, user_roles_table

    # Permissions inherited via roles
    role_perm_rows = db.execute(
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

    # Direct user permissions
    from app.models.user import model_has_permissions
    direct_perm_rows = db.execute(
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

    return set(role_perm_rows) | set(direct_perm_rows) | _fallback_permissions_for_roles(role_names)


# Roles that bypass all permission checks
SUPER_ROLES = {"super-admin"}


def require_roles(*allowed_roles: str) -> Callable:
    """
    Dependency factory: the requesting user must hold at least one of the
    specified roles. super-admin always passes.
    """
    def role_checker(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        role_names = _get_user_roles(current_user.id, db)
        if SUPER_ROLES.intersection(role_names):
            return current_user
        if not role_names.intersection(set(allowed_roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker


def require_permissions(*required_permissions: str) -> Callable:
    """
    Dependency factory: the requesting user must hold ALL of the specified
    permissions (through their roles or direct assignment). super-admin passes.
    """
    def permission_checker(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        role_names = _get_user_roles(current_user.id, db)
        if SUPER_ROLES.intersection(role_names):
            return current_user

        user_permissions = _get_user_permissions(current_user.id, role_names, db)
        missing = set(required_permissions) - user_permissions
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {', '.join(sorted(missing))}",
            )
        return current_user

    return permission_checker


def require_issue_creation(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ensures that the requesting user has the privilege to create issues.
    Allowed roles: super-admin, admin, project-manager, team-leader, developer.
    Or any user with the 'create-issues' permission.
    """
    role_names = _get_user_roles(current_user.id, db)
    allowed_roles = {"super-admin", "admin", "project-manager", "team-leader", "developer"}
    if allowed_roles.intersection(role_names):
        return current_user

    user_permissions = _get_user_permissions(current_user.id, role_names, db)
    if "create-issues" in user_permissions:
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Requires issue creation privileges.",
    )


def require_any_permission(*any_permissions: str) -> Callable:
    """
    Dependency factory: the user must hold AT LEAST ONE of the specified
    permissions. super-admin always passes.
    """
    def checker(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        role_names = _get_user_roles(current_user.id, db)
        if SUPER_ROLES.intersection(role_names):
            return current_user

        user_permissions = _get_user_permissions(current_user.id, role_names, db)
        if not set(any_permissions).intersection(user_permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(any_permissions)}",
            )
        return current_user

    return checker
