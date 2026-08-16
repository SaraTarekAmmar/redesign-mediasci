"""Triage workflow: new → triaging → confirmed (backlog) | dismissed, with revert."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.enums import TriageStatus
from app.models.issue import Issue, IssueStatus, sprint_issues

ACTIVE_STATUSES = {TriageStatus.NEW.value, TriageStatus.TRIAGING.value, "new", "triaging"}
TERMINAL_STATUSES = {TriageStatus.CONFIRMED.value, TriageStatus.DISMISSED.value, "confirmed", "dismissed"}
VALID_STATUSES = ACTIVE_STATUSES | TERMINAL_STATUSES


def _iso(dt) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _user_brief(user) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id,
        "name": user.name,
        "avatar": getattr(user, "avatar", None),
    }


def _project_brief(project) -> dict | None:
    if not project:
        return None
    return {
        "id": project.id,
        "name": project.name,
        "key": project.key,
    }


def _type_brief(issue_type) -> dict | None:
    if not issue_type:
        return None
    return {
        "id": issue_type.id,
        "name": issue_type.name,
        "color": issue_type.color or "#666",
    }


def format_triage_issue(issue: Issue) -> dict:
    status = issue.triage_status or TriageStatus.NEW.value
    return {
        "id": issue.id,
        "key": issue.key,
        "title": issue.title,
        "description": issue.description,
        "triage_status": status,
        "triage_notes": issue.triage_notes,
        "created_at": _iso(issue.created_at) or "",
        "project": _project_brief(issue.project),
        "reporter": _user_brief(issue.reporter),
        "assignee": _user_brief(issue.assignee),
        "type": _type_brief(issue.type),
    }


def _load_issue(db: Session, issue_id: int) -> Issue:
    issue = (
        db.query(Issue)
        .options(
            joinedload(Issue.project),
            joinedload(Issue.reporter),
            joinedload(Issue.assignee),
            joinedload(Issue.type),
        )
        .filter(Issue.id == issue_id, Issue.deleted_at.is_(None))
        .first()
    )
    if not issue:
        raise HTTPException(404, "Issue not found.")
    return issue


def list_triage_issues(
    db: Session,
    project_id: int | None = None,
    triage_status: str | None = None,
    allowed_project_ids: set[int] | None = None,
) -> list[dict]:
    query = (
        db.query(Issue)
        .options(
            joinedload(Issue.project),
            joinedload(Issue.reporter),
            joinedload(Issue.assignee),
            joinedload(Issue.type),
        )
        .filter(Issue.deleted_at.is_(None))
    )

    if project_id is not None:
        query = query.filter(Issue.project_id == project_id)
    if allowed_project_ids is not None:
        query = query.filter(Issue.project_id.in_(allowed_project_ids or {-1}))

    # Default "active" (frontend omits triage_status): awaiting triage
    if not triage_status or triage_status == "active":
        query = query.filter(
            (Issue.triage_status.in_(list(ACTIVE_STATUSES)))
            | (Issue.triage_status.is_(None))
        )
    else:
        if triage_status not in VALID_STATUSES:
            raise HTTPException(422, f"Invalid triage_status: {triage_status}")
        if triage_status == TriageStatus.NEW.value:
            query = query.filter(
                (Issue.triage_status == TriageStatus.NEW.value)
                | (Issue.triage_status.is_(None))
            )
        else:
            query = query.filter(Issue.triage_status == triage_status)

    issues = query.order_by(Issue.created_at.desc(), Issue.id.desc()).all()
    return [format_triage_issue(i) for i in issues]


def _remove_from_sprints(db: Session, issue_id: int) -> None:
    """Confirmed triage items belong in the backlog (no sprint membership)."""
    db.execute(sprint_issues.delete().where(sprint_issues.c.issue_id == issue_id))


def _ensure_backlog_status(db: Session, issue: Issue) -> None:
    """Prefer a todo/backlog status so confirmed items appear in the project backlog."""
    if issue.issue_status_id and issue.status and (issue.status.category or "").lower() == "todo":
        return

    status = (
        db.query(IssueStatus)
        .filter(
            IssueStatus.project_id == issue.project_id,
            IssueStatus.category == "todo",
        )
        .order_by(IssueStatus.position, IssueStatus.id)
        .first()
    )
    if not status:
        status = (
            db.query(IssueStatus)
            .filter(IssueStatus.project_id == issue.project_id)
            .order_by(IssueStatus.position, IssueStatus.id)
            .first()
        )
    if status:
        if issue.triage_previous_issue_status_id is None:
            issue.triage_previous_issue_status_id = issue.issue_status_id
        issue.issue_status_id = status.id


def confirm_issue(db: Session, issue_id: int, actor_id: int) -> dict:
    issue = _load_issue(db, issue_id)
    if issue.triage_status != TriageStatus.CONFIRMED.value:
        issue.triage_previous_triage_status = issue.triage_status or TriageStatus.NEW.value
        issue.triage_status = TriageStatus.CONFIRMED.value
        issue.triaged_by = actor_id
        issue.triaged_at = datetime.now(timezone.utc)
        issue.updated_at = datetime.now(timezone.utc)
        _remove_from_sprints(db, issue.id)
        _ensure_backlog_status(db, issue)
        db.commit()
    return format_triage_issue(_load_issue(db, issue_id))


def dismiss_issue(db: Session, issue_id: int, actor_id: int) -> dict:
    issue = _load_issue(db, issue_id)
    issue.triage_previous_triage_status = issue.triage_status or TriageStatus.NEW.value
    issue.triage_status = TriageStatus.DISMISSED.value
    issue.triaged_by = actor_id
    issue.triaged_at = datetime.now(timezone.utc)
    issue.updated_at = datetime.now(timezone.utc)
    db.commit()
    return format_triage_issue(_load_issue(db, issue_id))


def revert_issue(db: Session, issue_id: int, actor_id: int) -> dict:
    issue = _load_issue(db, issue_id)
    previous = issue.triage_previous_triage_status or TriageStatus.NEW.value
    if previous in TERMINAL_STATUSES:
        previous = TriageStatus.NEW.value

    restored_status_id = issue.triage_previous_issue_status_id
    issue.triage_status = previous
    issue.triage_previous_triage_status = None
    if restored_status_id is not None:
        issue.issue_status_id = restored_status_id
        issue.triage_previous_issue_status_id = None
    issue.triaged_by = actor_id
    issue.triaged_at = datetime.now(timezone.utc)
    issue.updated_at = datetime.now(timezone.utc)
    db.commit()
    return format_triage_issue(_load_issue(db, issue_id))


def update_triage(db: Session, issue_id: int, actor_id: int, triage_status: str | None, triage_notes: str | None) -> dict:
    issue = _load_issue(db, issue_id)
    if triage_status is not None:
        if triage_status not in VALID_STATUSES:
            raise HTTPException(422, f"Invalid triage_status: {triage_status}")
        issue.triage_status = triage_status
    if triage_notes is not None:
        issue.triage_notes = triage_notes
    issue.triaged_by = actor_id
    issue.triaged_at = datetime.now(timezone.utc)
    issue.updated_at = datetime.now(timezone.utc)
    db.commit()
    return format_triage_issue(_load_issue(db, issue_id))
