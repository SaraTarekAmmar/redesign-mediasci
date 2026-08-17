"""Team Tasks — per-member workload summary. Aggregates issues by assignee across the
projects the requesting user can see, matching the shape frontend/src/pages/TeamTasksPage.tsx
already expects (it was calling this endpoint before it existed)."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, _get_user_roles
from app.models.issue import Issue, IssueStatus
from app.models.project import Project
from app.models.resource import Resource
from app.models.user import User
from app.modules.projects.access import accessible_project_ids_query, is_system_admin

router = APIRouter(tags=["Team Tasks"])


def _hours(value) -> float:
    return float(value) if value is not None else 0.0


@router.get("/team-tasks/summary")
def team_tasks_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role_names = _get_user_roles(current_user.id, db)
    if is_system_admin(role_names):
        project_ids = {row[0] for row in db.execute(select(Project.id).where(Project.deleted_at.is_(None)))}
    else:
        project_ids = {int(pid) for pid in db.execute(accessible_project_ids_query(current_user.id)).scalars().all()}

    if not project_ids:
        return {"members": []}

    issues = (
        db.execute(
            select(Issue)
            .options(joinedload(Issue.status), joinedload(Issue.type), joinedload(Issue.priority), joinedload(Issue.project))
            .where(Issue.project_id.in_(project_ids), Issue.deleted_at.is_(None), Issue.assignee_id.isnot(None))
        )
        .unique()
        .scalars()
        .all()
    )

    resources = (
        db.execute(
            select(Resource)
            .options(joinedload(Resource.linked_user).joinedload(User.skills))
            .where(Resource.user_id.in_({i.assignee_id for i in issues}), Resource.is_active != 0)
        )
        .unique()
        .scalars()
        .all()
    )
    resource_by_user_id = {r.user_id: r for r in resources}

    now = datetime.now(timezone.utc)
    by_user: dict[int, dict] = {}
    for issue in issues:
        uid = issue.assignee_id
        if uid not in by_user:
            resource = resource_by_user_id.get(uid)
            user = resource.linked_user if resource else None
            by_user[uid] = {
                "user": {
                    "id": str(uid),
                    "name": (user.name if user else None) or f"User {uid}",
                    "avatar": getattr(user, "avatar_url", None) if user else None,
                    "role": resource.role if resource else None,
                },
                "capacity_hours": _hours(resource.weekly_capacity) if resource else 40.0,
                "skills": [
                    {"id": str(s.id), "name": s.name, "proficiency": "expert"}
                    for s in (getattr(user, "skills", None) or [])
                ] if user else [],
                "total": 0, "done": 0, "in_progress": 0, "todo": 0, "overdue": 0,
                "estimated_hours": 0.0, "actual_hours": 0.0, "open_hours": 0.0,
                "tasks": [],
            }
        entry = by_user[uid]
        category = (issue.status.category if issue.status else "todo") or "todo"
        is_done = category == "done"
        due = issue.due_date
        if due and due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        overdue = bool(due and due < now and not is_done)

        entry["total"] += 1
        if is_done:
            entry["done"] += 1
        elif category == "in_progress":
            entry["in_progress"] += 1
        else:
            entry["todo"] += 1
        if overdue:
            entry["overdue"] += 1
        entry["estimated_hours"] += _hours(issue.estimated_hours)
        entry["actual_hours"] += _hours(issue.actual_hours)
        if not is_done:
            entry["open_hours"] += _hours(issue.remaining_hours) or _hours(issue.estimated_hours)

        entry["tasks"].append({
            "id": str(issue.id),
            "key": issue.key,
            "title": issue.title,
            "project": issue.project.name if issue.project else "",
            "type": issue.type.name if issue.type else "Task",
            "status": issue.status.name if issue.status else "",
            "category": category,
            "priority": issue.priority.name if issue.priority else "Medium",
            "due_date": issue.due_date.isoformat() if issue.due_date else None,
            "overdue": overdue,
            "estimated_hours": _hours(issue.estimated_hours) or None,
            "remaining_hours": _hours(issue.remaining_hours) or None,
            "workstream": None,
        })

    members = []
    for entry in by_user.values():
        capacity = entry["capacity_hours"] or 40.0
        entry["load_pct"] = round(min(200, (entry["open_hours"] / capacity) * 100)) if capacity else 0
        members.append(entry)
    members.sort(key=lambda m: m["user"]["name"])

    return {"members": members}
