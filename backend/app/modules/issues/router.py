"""Issues router — board, backlog, triage, comments, attachments, time logs, dependencies."""
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any


from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, require_issue_creation, _get_user_roles
from app.models.attachment import IssueAttachment
from app.models.comment import IssueComment
from app.models.time_tracking import TimeLog
from app.models.issue import (
    Issue, IssueHistory, IssueLabel,
    IssuePriority, IssueStatus, IssueType, TaskDependency, sprint_issues,
)
from app.modules.issues.schemas import (
    CommentCreateIn, CommentUpdateIn, DependencyCreateIn,
    IssueCreateIn, IssueReorderIn, IssueTriageIn, IssueUpdateIn,
    TimeLogCreateIn, TimeLogUpdateIn, ChecklistCreateIn, ChecklistUpdateIn,
    AttachmentCreateIn, SubtaskCreateIn,
)



router = APIRouter(tags=["Issues"])
settings = get_settings()
logger = logging.getLogger("operation_hub.issues")


def _validate_workforce_assignees(
    db: Session,
    project_id: int,
    assignee_id: Optional[int],
    external_assignee_id: Optional[int],
) -> None:
    """Backend enforcement: only members of the project workforce are assignable."""
    from app.modules.projects import workforce as workforce_service

    if assignee_id is not None and external_assignee_id is not None:
        raise HTTPException(422, "A task may have an internal or external assignee, not both.")
    if assignee_id is not None and not workforce_service.is_user_eligible_for_project(db, project_id, assignee_id):
        raise HTTPException(
            422,
            "Assignee is not part of this project's workforce. "
            "Assign one of the project's teams (or add the user as a project member) first.",
        )
    if external_assignee_id is not None and not workforce_service.is_partner_member_eligible_for_project(
        db, project_id, external_assignee_id
    ):
        raise HTTPException(
            422,
            "External assignee is not part of this project's workforce. "
            "Assign their partner to the project first.",
        )


def _iso(dt) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _fmt_issue(issue: Issue, db: Session) -> dict:
    label_ids = [l.id for l in issue.labels] if issue.labels else []
    sprint_row = db.execute(
        select(sprint_issues.c.sprint_id, sprint_issues.c.position)
        .where(sprint_issues.c.issue_id == issue.id)
    ).first()
    return {
        "id": issue.id,
        "key": issue.key,
        "title": issue.title,
        "description": issue.description,
        "projectId": issue.project_id,
        "typeKey": issue.type.name.lower().replace(" ", "-") if issue.type else "task",
        "issue_type_id": issue.issue_type_id,
        "statusId": issue.issue_status_id,
        "priorityId": issue.issue_priority_id,
        "assigneeId": issue.assignee_id,
        "externalAssigneeId": issue.external_assignee_id,
        "reporterId": issue.reporter_id,
        "reportedTo": issue.reported_to or [],
        "epicId": issue.epic_id,
        "milestoneId": issue.milestone_id,
        "deliverableId": issue.deliverable_id,
        "sprintId": sprint_row.sprint_id if sprint_row else None,
        "labelIds": label_ids,
        "storyPoints": issue.story_points,
        "dueDate": issue.due_date.isoformat() if issue.due_date else None,
        "customFields": issue.custom_fields or {},
        "position": sprint_row.position if sprint_row else issue.position,
        "deletedAt": _iso(issue.deleted_at),
        "createdAt": _iso(issue.created_at),
        "updatedAt": _iso(issue.updated_at),
    }


# ── Issue CRUD ─────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/issues")
def list_project_issues(
    project_id: int,
    sprint_id: Optional[int] = Query(None),
    status_id: Optional[int] = Query(None),
    assignee_id: Optional[int] = Query(None),
    q: str = Query(""),
    include_deleted: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Issue)
        .options(joinedload(Issue.type), joinedload(Issue.labels))
        .filter(Issue.project_id == project_id)
    )
    if not include_deleted:
        query = query.filter(Issue.deleted_at.is_(None))
    if status_id:
        query = query.filter(Issue.issue_status_id == status_id)
    if assignee_id:
        query = query.filter(Issue.assignee_id == assignee_id)
    if q:
        query = query.filter(Issue.title.ilike(f"%{q}%") | Issue.key.ilike(f"%{q}%"))
    if sprint_id is not None:
        if sprint_id == 0:  # backlog
            sprint_sub = select(sprint_issues.c.issue_id).scalar_subquery()
            query = query.filter(Issue.id.notin_(sprint_sub))
        else:
            sprint_sub = select(sprint_issues.c.issue_id).where(
                sprint_issues.c.sprint_id == sprint_id
            ).scalar_subquery()
            query = query.filter(Issue.id.in_(sprint_sub))

    return paginate(query.order_by(Issue.position, Issue.id), page, per_page, serializer=lambda i: _fmt_issue(i, db))


@router.post("/projects/{project_id}/issues", status_code=201)
def create_issue(
    project_id: int,
    body: IssueCreateIn,
    current_user=Depends(require_issue_creation),
    db: Session = Depends(get_db),
):
    from app.models.project import Project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found.")

    # Generate issue key
    count = db.query(Issue).filter(Issue.project_id == project_id).count()
    key = f"{project.key}-{count + 1}"

    # Get default status if not provided
    _validate_workforce_assignees(db, project_id, body.assignee_id, body.external_assignee_id)

    status_id = body.issue_status_id
    if not status_id:
        default_status = db.query(IssueStatus).filter(IssueStatus.project_id == project_id).order_by(IssueStatus.position, IssueStatus.id).first()
        if not default_status:
            default_status = db.query(IssueStatus).order_by(IssueStatus.position, IssueStatus.id).first()
        status_id = default_status.id if default_status else None

    issue = Issue(
        title=body.title,
        description=body.description,
        project_id=project_id,
        issue_type_id=body.issue_type_id,
        issue_status_id=status_id,
        issue_priority_id=body.issue_priority_id,
        assignee_id=body.assignee_id,
        external_assignee_id=body.external_assignee_id,
        reporter_id=body.reporter_id or current_user.id,
        reported_to=body.reported_to or [],
        epic_id=body.epic_id,
        milestone_id=body.milestone_id,
        deliverable_id=body.deliverable_id,
        story_points=body.story_points,
        due_date=datetime.fromisoformat(body.due_date).date() if body.due_date else None,
        custom_fields=body.custom_fields or {},
        position=body.position or 0,
        # New intake goes through Triage; sprint-bound creates skip the queue.
        triage_status=None if body.sprint_id else "new",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(issue)
    db.flush()

    # Attach labels
    if body.label_ids:
        labels = db.query(IssueLabel).filter(IssueLabel.id.in_(body.label_ids)).all()
        issue.labels = labels

    # Add to sprint if specified
    if body.sprint_id:
        existing_pos = db.execute(
            select(sprint_issues.c.position)
            .where(sprint_issues.c.sprint_id == body.sprint_id)
        ).scalars().all()
        next_pos = max(existing_pos, default=-1) + 1
        db.execute(
            sprint_issues.insert().values(
                issue_id=issue.id,
                sprint_id=body.sprint_id,
                position=next_pos,
            )
        )

    db.commit()
    db.refresh(issue)
    logger.info("Issue created: %s (project_id=%d)", key, project_id)
    return _fmt_issue(issue, db)


@router.post("/projects/{project_id}/issues/reorder")
def reorder_issues(
    project_id: int,
    body: IssueReorderIn,
    current_user=Depends(require_permissions("transition-issues")),
    db: Session = Depends(get_db),
):
    for item in body.positions:
        issue_id = item.get("id")
        position = item.get("position", 0)
        status_id = item.get("status_id")

        issue = db.query(Issue).filter(Issue.id == issue_id, Issue.project_id == project_id).first()
        if not issue:
            continue

        if status_id and issue.issue_status_id != status_id:
            issue.issue_status_id = status_id

        # Update sprint_issues position
        existing = db.execute(
            select(sprint_issues).where(sprint_issues.c.issue_id == issue_id)
        ).first()
        if existing:
            db.execute(
                sprint_issues.update()
                .where(sprint_issues.c.issue_id == issue_id)
                .values(position=position)
            )
        else:
            issue.position = position

        issue.updated_at = datetime.now(timezone.utc)

    db.commit()
    return {"success": True, "message": "Issues reordered."}


@router.get("/issues/{issue_id}")
def get_issue(issue_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    issue = db.query(Issue).options(joinedload(Issue.type), joinedload(Issue.labels)).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(404, "Issue not found.")
    return _fmt_issue(issue, db)


@router.put("/issues/{issue_id}")
def update_issue(
    issue_id: int,
    body: IssueUpdateIn,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(404, "Issue not found.")

    data = body.model_dump(exclude_unset=True)
    label_ids = data.pop("label_ids", None)
    sprint_id = data.pop("sprint_id", ...)

    # Enforce workforce eligibility only for assignments being changed now;
    # historical assignments on the issue are left untouched.
    candidate_assignee = data.get("assignee_id", issue.assignee_id)
    candidate_external = data.get("external_assignee_id", issue.external_assignee_id)
    if candidate_assignee is not None and candidate_external is not None:
        raise HTTPException(422, "A task may have an internal or external assignee, not both.")
    _validate_workforce_assignees(
        db,
        issue.project_id,
        data.get("assignee_id") if "assignee_id" in data else None,
        data.get("external_assignee_id") if "external_assignee_id" in data else None,
    )

    # Record history for status change
    if "issue_status_id" in data and data["issue_status_id"] != issue.issue_status_id:
        history = IssueHistory(
            issue_id=issue.id,
            user_id=current_user.id,
            field="status",
            old_value=str(issue.issue_status_id),
            new_value=str(data["issue_status_id"]),
            created_at=datetime.now(timezone.utc),
        )
        db.add(history)

    # Apply scalar fields
    for field, value in data.items():
        if field == "due_date" and value:
            issue.due_date = datetime.fromisoformat(value).date()
        elif hasattr(issue, field):
            setattr(issue, field, value)

    # Update labels
    if label_ids is not None:
        labels = db.query(IssueLabel).filter(IssueLabel.id.in_(label_ids)).all()
        issue.labels = labels

    # Handle sprint assignment
    if sprint_id is not ...:
        db.execute(sprint_issues.delete().where(sprint_issues.c.issue_id == issue.id))
        if sprint_id:
            existing_pos = db.execute(
                select(sprint_issues.c.position)
                .where(sprint_issues.c.sprint_id == sprint_id)
            ).scalars().all()
            db.execute(
                sprint_issues.insert().values(
                    issue_id=issue.id,
                    sprint_id=sprint_id,
                    position=max(existing_pos, default=-1) + 1,
                )
            )

    issue.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(issue)
    return _fmt_issue(issue, db)


@router.delete("/issues/{issue_id}", response_model=MessageResponse)
def delete_issue(
    issue_id: int,
    current_user=Depends(require_permissions("delete-issues")),
    db: Session = Depends(get_db),
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(404, "Issue not found.")
    issue.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return MessageResponse(message="Issue moved to trash. Can be restored by admin.")


# ── Global Issue list (for triage, admin views) ────────────────────────────

@router.get("/issues")
def list_all_issues(
    project_id: Optional[int] = Query(None),
    status_id: Optional[int] = Query(None),
    assignee_id: Optional[int] = Query(None),
    triage_status: Optional[str] = Query(None),
    q: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Issue).options(joinedload(Issue.type), joinedload(Issue.labels)).filter(Issue.deleted_at.is_(None))
    from app.modules.projects.access import filter_query_by_project_access
    roles = _get_user_roles(current_user.id, db)
    query = filter_query_by_project_access(query, Issue.project_id, current_user.id, roles)
    if project_id:
        query = query.filter(Issue.project_id == project_id)
    if status_id:
        query = query.filter(Issue.issue_status_id == status_id)
    if assignee_id:
        query = query.filter(Issue.assignee_id == assignee_id)
    if triage_status:
        query = query.filter(Issue.triage_status == triage_status)
    if q:
        query = query.filter(Issue.title.ilike(f"%{q}%") | Issue.key.ilike(f"%{q}%"))
    return paginate(query.order_by(Issue.id.desc()), page, per_page, serializer=lambda i: _fmt_issue(i, db))


# ── Triage ─────────────────────────────────────────────────────────────────

@router.patch("/issues/{issue_id}/triage")
def triage_issue(
    issue_id: int,
    body: IssueTriageIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(404, "Issue not found.")
    issue.triage_status = body.status
    if body.priority_id:
        issue.issue_priority_id = body.priority_id
    issue.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": issue.id, "triage_status": issue.triage_status}


# ── Comments ───────────────────────────────────────────────────────────────

@router.get("/issues/{issue_id}/comments")
def list_comments(issue_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    comments = db.query(IssueComment).filter(
        IssueComment.issue_id == issue_id,
        IssueComment.deleted_at.is_(None),
    ).order_by(IssueComment.created_at.asc()).all()
    return [
        {
            "id": c.id,
            "body": c.body,
            "authorId": c.user_id,
            "parentId": c.parent_id,
            "createdAt": _iso(c.created_at),
            "updatedAt": _iso(c.updated_at),
        }
        for c in comments
    ]


@router.post("/issues/{issue_id}/comments", status_code=201)
def create_comment(
    issue_id: int,
    body: CommentCreateIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    issue = db.query(Issue).filter(Issue.id == issue_id, Issue.deleted_at.is_(None)).first()
    if not issue:
        raise HTTPException(404, "Issue not found.")
    comment = IssueComment(
        issue_id=issue_id,
        user_id=current_user.id,
        body=body.body,
        parent_id=body.parent_id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {"id": comment.id, "body": comment.body, "authorId": comment.user_id, "issue_id": comment.issue_id, "createdAt": _iso(comment.created_at)}


@router.put("/issues/{issue_id}/comments/{comment_id}")
def update_comment(
    issue_id: int,
    comment_id: int,
    body: CommentUpdateIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(IssueComment).filter(IssueComment.id == comment_id, IssueComment.issue_id == issue_id).first()
    if not comment:
        raise HTTPException(404, "Comment not found.")
    if comment.user_id != current_user.id:
        from app.dependencies import _get_user_roles
        roles = _get_user_roles(current_user.id, db)
        if not {"super-admin", "admin"}.intersection(roles):
            raise HTTPException(403, "You can only edit your own comments.")
    comment.body = body.body
    comment.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": comment.id, "body": comment.body}


@router.delete("/issues/{issue_id}/comments/{comment_id}", response_model=MessageResponse)
def delete_comment(
    issue_id: int,
    comment_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(IssueComment).filter(IssueComment.id == comment_id, IssueComment.issue_id == issue_id).first()
    if not comment:
        raise HTTPException(404, "Comment not found.")
    if comment.user_id != current_user.id:
        from app.dependencies import _get_user_roles
        roles = _get_user_roles(current_user.id, db)
        if not {"super-admin", "admin"}.intersection(roles):
            raise HTTPException(403, "You can only delete your own comments.")
    comment.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return MessageResponse(message="Comment deleted.")


# ── Attachments ────────────────────────────────────────────────────────────

@router.get("/issues/{issue_id}/attachments")
def list_attachments(issue_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.modules.issues import repository as issue_repo
    return issue_repo.get_attachments(db, issue_id)


@router.post("/issues/{issue_id}/attachments", status_code=201)
async def upload_attachment(
    issue_id: int,
    file: Optional[UploadFile] = File(None),
    body: Optional[AttachmentCreateIn] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.modules.issues import repository as issue_repo
    if file:
        upload_dir = os.path.join(settings.UPLOAD_DIR, "issues", str(issue_id))
        os.makedirs(upload_dir, exist_ok=True)
        ext = os.path.splitext(file.filename or "file")[1]
        stored_name = f"{uuid.uuid4().hex}{ext}"
        stored_path = os.path.join(upload_dir, stored_name)

        content = await file.read()
        with open(stored_path, "wb") as f:
            f.write(content)

        attachment = issue_repo.create_attachment(
            db, issue_id, current_user.id, stored_name, file.filename or "file", file.content_type or "application/octet-stream", len(content), stored_path
        )
        return {"id": attachment.id, "original_filename": attachment.original_filename, "mime_type": attachment.mime_type}
    else:
        fname = body.original_filename if body else "attachment.pdf"
        mtype = body.mime_type if body else "application/octet-stream"
        fsize = body.file_size if body else 0
        spath = body.storage_path if body else ""
        filename = fname.lower().replace(" ", "_")
        attachment = issue_repo.create_attachment(db, issue_id, current_user.id, filename, fname, mtype, fsize, spath)
        return {"id": attachment.id, "original_filename": fname, "mime_type": mtype}


@router.delete("/issues/{issue_id}/attachments/{attachment_id}", response_model=MessageResponse)
def delete_attachment(
    issue_id: int,
    attachment_id: int,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    from app.modules.issues import repository as issue_repo
    success = issue_repo.delete_attachment(db, attachment_id, current_user.id)
    if not success:
        raise HTTPException(404, "Attachment not found.")
    return MessageResponse(message="Attachment deleted.")



# ── History ────────────────────────────────────────────────────────────────

@router.get("/issues/{issue_id}/history")
def issue_history(issue_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    history = db.query(IssueHistory).filter(IssueHistory.issue_id == issue_id).order_by(IssueHistory.created_at.desc()).all()
    return [{"id": h.id, "userId": h.user_id, "field": h.field, "oldValue": h.old_value, "newValue": h.new_value, "createdAt": _iso(h.created_at)} for h in history]


# ── Time Logs ──────────────────────────────────────────────────────────────

@router.get("/time-logs")
def list_time_logs(
    project_id: Optional[int] = Query(None),
    issue_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50),
    current_user=Depends(require_permissions("view-time-logs")),
    db: Session = Depends(get_db),
):
    query = db.query(TimeLog).outerjoin(Issue, Issue.id == TimeLog.issue_id)
    roles = _get_user_roles(current_user.id, db)
    if not {"super-admin", "admin"}.intersection(roles):
        from app.modules.projects.access import accessible_project_ids_query
        query = query.filter(
            Issue.project_id.in_(accessible_project_ids_query(current_user.id))
            | ((TimeLog.issue_id.is_(None)) & (TimeLog.user_id == current_user.id))
        )
    if project_id:
        query = query.filter(Issue.project_id == project_id)
    if issue_id:
        query = query.filter(TimeLog.issue_id == issue_id)
    if user_id:
        query = query.filter(TimeLog.user_id == user_id)
    return paginate(query.order_by(TimeLog.logged_at.desc()), page, per_page, serializer=lambda t: {
        "id": t.id,
        "issueId": t.issue_id,
        "userId": t.user_id,
        "hours": float(t.hours),
        "description": t.description,
        "date": t.logged_at.isoformat() if t.logged_at else None,
        "createdAt": _iso(t.created_at),
    })


@router.post("/time-logs", status_code=201)
def create_time_log(
    body: TimeLogCreateIn,
    current_user=Depends(require_permissions("log-time")),
    db: Session = Depends(get_db),
):
    from datetime import date as date_cls
    log = TimeLog(
        user_id=current_user.id,
        duration_minutes=int(body.hours * 60),
        description=body.description,
        logged_at=datetime.fromisoformat(body.date).date() if body.date else date_cls.today(),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"id": log.id, "hours": float(log.hours)}


@router.put("/time-logs/{log_id}")
def update_time_log(
    log_id: int,
    body: TimeLogUpdateIn,
    current_user=Depends(require_permissions("log-time")),
    db: Session = Depends(get_db),
):
    log = db.query(TimeLog).filter(TimeLog.id == log_id).first()
    if not log:
        raise HTTPException(404, "Time log not found.")
    if log.user_id != current_user.id:
        from app.dependencies import _get_user_roles
        roles = _get_user_roles(current_user.id, db)
        if not {"super-admin", "admin"}.intersection(roles):
            raise HTTPException(403, "You can only edit your own time logs.")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "date" and value:
            log.date = datetime.fromisoformat(value).date()
        elif hasattr(log, field):
            setattr(log, field, value)
    log.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": log.id, "hours": float(log.hours)}


@router.delete("/time-logs/{log_id}", response_model=MessageResponse)
def delete_time_log(
    log_id: int,
    current_user=Depends(require_permissions("log-time")),
    db: Session = Depends(get_db),
):
    log = db.query(TimeLog).filter(TimeLog.id == log_id).first()
    if not log:
        raise HTTPException(404, "Time log not found.")
    db.delete(log)
    db.commit()
    return MessageResponse(message="Time log deleted.")


# ── Dependencies ───────────────────────────────────────────────────────────

@router.get("/issues/{issue_id}/dependencies")
def list_dependencies(issue_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    deps = db.query(TaskDependency).filter(TaskDependency.issue_id == issue_id).all()
    return [{"id": d.id, "dependsOnId": d.depends_on_id, "type": d.type} for d in deps]


@router.post("/issues/{issue_id}/dependencies", status_code=201)
def create_dependency(
    issue_id: int,
    body: DependencyCreateIn,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    source_issue = db.query(Issue).filter(Issue.id == issue_id, Issue.deleted_at.is_(None)).first()
    target_issue = db.query(Issue).filter(Issue.id == body.depends_on_id, Issue.deleted_at.is_(None)).first()
    if not source_issue or not target_issue:
        raise HTTPException(404, "Issue not found.")
    if source_issue.id == target_issue.id or source_issue.project_id != target_issue.project_id:
        raise HTTPException(422, "Issue dependencies must stay within one project.")
    dep = TaskDependency(
        issue_id=issue_id,
        depends_on_id=body.depends_on_id,
        type=body.type,
        created_at=datetime.now(timezone.utc),
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return {"id": dep.id, "dependsOnId": dep.depends_on_id, "type": dep.type}


@router.delete("/issues/{issue_id}/dependencies/{dep_id}", response_model=MessageResponse)
def delete_dependency(
    issue_id: int,
    dep_id: int,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    dep = db.query(TaskDependency).filter(TaskDependency.id == dep_id, TaskDependency.issue_id == issue_id).first()
    if not dep:
        raise HTTPException(404, "Dependency not found.")
    db.delete(dep)
    db.commit()
    return MessageResponse(message="Dependency removed.")


# ── Sprint 6 Task Execution Engine Endpoints ────────────────────────────

@router.get("/issues/{issue_id}/details")
def get_issue_execution_details(issue_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.modules.issues import service as issue_service
    details = issue_service.get_issue_details(db, issue_id)
    if not details:
        raise HTTPException(404, "Issue not found")
    return details


@router.put("/issues/{issue_id}/execution")
def update_issue_execution(
    issue_id: int,
    body: IssueUpdateIn,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    from app.modules.issues import service as issue_service
    updated = issue_service.update_issue_execution_fields(db, issue_id, body, current_user.id)
    if not updated:
        raise HTTPException(404, "Issue not found")
    return updated


# Checklists
@router.get("/issues/{issue_id}/checklists")
def list_task_checklists(issue_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.modules.issues import service as issue_service
    return issue_service.get_task_checklists(db, issue_id)


@router.post("/issues/{issue_id}/checklists", status_code=201)
def create_task_checklist(
    issue_id: int,
    body: ChecklistCreateIn,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    from app.modules.issues import service as issue_service
    return issue_service.create_task_checklist(db, issue_id, body, current_user.id)


@router.put("/issues/{issue_id}/checklists/{checklist_id}")
def update_task_checklist(
    issue_id: int,
    checklist_id: int,
    body: ChecklistUpdateIn,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    from app.modules.issues import service as issue_service
    res = issue_service.update_task_checklist(db, checklist_id, body, current_user.id)
    if not res:
        raise HTTPException(404, "Checklist item not found")
    return res


@router.delete("/issues/{issue_id}/checklists/{checklist_id}")
def delete_task_checklist(
    issue_id: int,
    checklist_id: int,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    from app.modules.issues import service as issue_service
    success = issue_service.delete_task_checklist(db, checklist_id, current_user.id)
    if not success:
        raise HTTPException(404, "Checklist item not found")
    return {"message": "Checklist item deleted"}


# Issue Time Logs
@router.get("/issues/{issue_id}/time-logs")
def get_issue_time_logs(issue_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.modules.issues import service as issue_service
    return issue_service.get_task_time_logs(db, issue_id)


@router.post("/issues/{issue_id}/time-logs", status_code=201)
def add_issue_time_log(
    issue_id: int,
    body: TimeLogCreateIn,
    current_user=Depends(require_permissions("log-time")),
    db: Session = Depends(get_db),
):
    from app.modules.issues import service as issue_service
    log = issue_service.create_task_time_log(db, issue_id, body, current_user.id)
    return {"id": log.id, "hours": float(log.hours)}


# Activity & History
@router.get("/issues/{issue_id}/activities")
def get_issue_activities(
    issue_id: int,
    activity_type: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.modules.issues import repository as issue_repo
    return issue_repo.get_activities(db, issue_id, activity_type=activity_type)


@router.get("/issues/{issue_id}/history-audit")
def get_issue_history_audit(issue_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.modules.issues import service as issue_service
    return issue_service.get_task_history(db, issue_id)


# Subtasks Endpoints
@router.get("/issues/{issue_id}/subtasks")
def list_issue_subtasks(issue_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.modules.issues import repository as issue_repo
    return issue_repo.get_subtasks(db, issue_id)


@router.post("/issues/{issue_id}/subtasks", status_code=201)
def create_issue_subtask(
    issue_id: int,
    body: SubtaskCreateIn,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    from app.modules.issues import repository as issue_repo
    st = issue_repo.create_subtask(db, issue_id, body.title, current_user.id, float(body.estimated_hours or 0.0))
    return {"id": st.id, "key": st.key, "title": st.title}


