"""Projects repository - DB access only."""
from datetime import datetime, timezone
import re
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.issue import IssueLabel, IssuePriority, IssueStatus, IssueType
from app.models.misc import CustomField
from app.models.project import Project
from app.models.user import User, project_members

_ISSUE_TYPE_ORDER = ("task", "bug", "story", "epic", "subtask")


def _issue_type_key(name: str | None) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-")
    if slug in {"feature", "features"}:
        return "story"
    if slug in {"sub-task", "sub task"}:
        return "subtask"
    return slug


def _canonical_issue_types(rows: list[IssueType]) -> list[IssueType]:
    deduped: dict[str, IssueType] = {}
    for row in rows:
        key = _issue_type_key(row.name)
        if key in _ISSUE_TYPE_ORDER and key not in deduped:
            deduped[key] = row
    return [deduped[key] for key in _ISSUE_TYPE_ORDER if key in deduped]


def get_projects_query(db: Session, user_id: int, role_names: set, q: str = "", status: str = ""):
    from app.modules.projects.access import accessible_project_ids_query, is_system_admin

    query = db.query(Project).filter(Project.deleted_at.is_(None))
    if not is_system_admin(role_names):
        query = query.filter(Project.id.in_(accessible_project_ids_query(user_id)))
    if q:
        query = query.filter(Project.name.ilike(f"%{q}%") | Project.key.ilike(f"%{q}%"))
    if status:
        query = query.filter(Project.status == status)
    return query.options(joinedload(Project.client)).order_by(Project.created_at.desc())


def get_project_by_id(db: Session, project_id: int) -> Optional[Project]:
    return (
        db.query(Project)
        .options(joinedload(Project.client))
        .filter(Project.id == project_id, Project.deleted_at.is_(None))
        .first()
    )


get_project = get_project_by_id


def create_project(db: Session, **kwargs) -> Project:
    p = Project(**kwargs)
    db.add(p)
    db.flush()
    return p


def add_member(db: Session, project_id: int, user_id: int, role: str = "member") -> None:
    existing = db.execute(
        project_members.select().where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
    ).first()
    if not existing:
        db.execute(
            project_members.insert().values(
                project_id=project_id,
                user_id=user_id,
                role=role,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        )


def remove_member(db: Session, project_id: int, user_id: int) -> None:
    db.execute(
        project_members.delete().where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
    )


def update_member_role(db: Session, project_id: int, user_id: int, role: str) -> int:
    result = db.execute(
        project_members.update().where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        ).values(
            role=role,
            updated_at=datetime.now(timezone.utc),
        )
    )
    return int(getattr(result, "rowcount", 0) or 0)


def get_project_members(db: Session, project_id: int) -> list:
    from app.models.resource import Resource

    rows = db.execute(
        project_members.select().where(project_members.c.project_id == project_id)
    ).all()
    user_ids = [r.user_id for r in rows]
    role_map = {r.user_id: r.role for r in rows}
    users = db.query(User).filter(User.id.in_(user_ids)).all()

    result = []
    for u in users:
        role = role_map.get(u.id, "member")
        # Enrich with Resource profile when one exists (Resource = workforce entity)
        resource: Resource | None = db.query(Resource).filter(Resource.user_id == u.id).first()
        member = {
            "user_id": u.id,
            "name": u.name,
            "email": u.email,
            "avatar_url": u.avatar_url,
            "role": role,
            # Resource fields (None when no linked resource profile)
            "resource_id": resource.id if resource else None,
            "employee_number": resource.employee_number if resource else None,
            "position": resource.position if resource else u.position,
            "seniority": resource.seniority if resource else u.seniority,
            "availability_status": resource.availability_status if resource else None,
            "department_id": resource.department_id if resource else u.department_id,
        }
        result.append((u, role, member))
    return result


def get_project_statuses(db: Session, project_id: int) -> list[IssueStatus]:
    """Return global defaults plus statuses belonging to the requested project."""
    return db.query(IssueStatus).filter(
        (IssueStatus.project_id == project_id) | (IssueStatus.project_id.is_(None))
    ).order_by(IssueStatus.position, IssueStatus.id).all()


def get_project_types(db: Session) -> list[IssueType]:
    rows = db.query(IssueType).order_by(IssueType.id).all()
    return _canonical_issue_types(rows)


def get_project_priorities(db: Session) -> list[IssuePriority]:
    return db.query(IssuePriority).order_by(IssuePriority.level).all()


def get_project_labels(db: Session, project_id: int) -> list[IssueLabel]:
    return db.query(IssueLabel).filter(
        (IssueLabel.project_id == project_id) | (IssueLabel.project_id.is_(None))
    ).order_by(IssueLabel.id).all()


def get_custom_fields(db: Session, project_id: int) -> list[CustomField]:
    return db.query(CustomField).filter(
        (CustomField.project_id == project_id) | (CustomField.project_id.is_(None))
    ).all()
