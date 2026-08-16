from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func
from sqlalchemy.orm import Session, joinedload

from app.models.issue import (
    Issue, IssueHistory, IssuePriority, IssueStatus, IssueType, TaskDependency, sprint_issues
)
from app.models.task_activity import TaskActivity
from app.models.task_checklist import TaskChecklist
from app.models.comment import IssueComment
from app.models.attachment import IssueAttachment
from app.models.time_tracking import TimeLog
from app.models.user import User


def log_task_activity(db: Session, issue_id: int, user_id: Optional[int], activity_type: str, description: str, extra_data: Optional[Dict[str, Any]] = None):
    act = TaskActivity(
        issue_id=issue_id,
        user_id=user_id,
        activity_type=activity_type,
        description=description,
        extra_data=extra_data or {},
    )
    db.add(act)


def log_field_history(db: Session, issue_id: int, user_id: Optional[int], field: str, old_val: Any, new_val: Any, action: str = "update"):
    if str(old_val or "") == str(new_val or ""):
        return
    hist = IssueHistory(
        issue_id=issue_id,
        user_id=user_id,
        field=field,
        old_value=str(old_val) if old_val is not None else None,
        new_value=str(new_val) if new_val is not None else None,
        action=action,
    )
    db.add(hist)


def format_issue_detailed(issue: Issue, db: Session) -> dict:
    label_ids = [l.id for l in issue.labels] if issue.labels else []
    sprint_row = db.execute(
        select(sprint_issues.c.sprint_id, sprint_issues.c.position)
        .where(sprint_issues.c.issue_id == issue.id)
    ).first()

    # Subtasks calculation
    subtasks = db.query(Issue).filter(Issue.parent_id == issue.id, Issue.deleted_at.is_(None)).all()
    subtask_count = len(subtasks)
    subtask_completed_count = sum(1 for st in subtasks if st.status and st.status.category == "done")
    subtask_progress_percentage = round((subtask_completed_count / subtask_count * 100), 1) if subtask_count > 0 else 0.0

    # Time summary calculations
    total_logged_minutes = sum(tl.duration_minutes or 0 for tl in issue.time_logs) if issue.time_logs else 0
    actual_hrs = round(total_logged_minutes / 60.0, 2)
    est_hrs = float(issue.estimated_hours) if issue.estimated_hours is not None else (float(issue.estimate_minutes or 0) / 60.0)
    rem_hrs = float(issue.remaining_hours) if issue.remaining_hours is not None else max(0.0, est_hrs - actual_hrs)

    return {
        "id": issue.id,
        "key": issue.key,
        "title": issue.title,
        "description": issue.description,
        "projectId": issue.project_id,
        "parent_id": issue.parent_id,
        "milestone_id": issue.milestone_id,
        "deliverable_id": issue.deliverable_id,
        "typeKey": issue.type.name.lower().replace(" ", "-") if issue.type else "task",
        "issue_type_id": issue.issue_type_id,
        "statusId": issue.issue_status_id,
        "statusName": issue.status.name if issue.status else "Todo",
        "statusCategory": issue.status.category if issue.status else "todo",
        "priorityId": issue.issue_priority_id,
        "priorityName": issue.priority.name if issue.priority else "Medium",
        "assigneeId": issue.assignee_id,
        "assignee": {"id": issue.assignee.id, "name": issue.assignee.name, "email": issue.assignee.email, "avatar_url": issue.assignee.avatar_url} if issue.assignee else None,
        "reporterId": issue.reporter_id,
        "reporter": {"id": issue.reporter.id, "name": issue.reporter.name, "email": issue.reporter.email} if issue.reporter else None,
        "epicId": issue.epic_id,
        "sprintId": sprint_row.sprint_id if sprint_row else None,
        "labelIds": label_ids,
        "storyPoints": issue.story_points,
        "dueDate": issue.due_date.isoformat() if issue.due_date else None,
        "position": sprint_row.position if sprint_row else issue.position,

        # Subtask rollup
        "subtask_count": subtask_count,
        "subtask_completed_count": subtask_completed_count,
        "subtask_progress_percentage": subtask_progress_percentage,

        # Sprint 6 Execution Engine Fields
        "acceptance_criteria": issue.acceptance_criteria,
        "definition_of_ready": issue.definition_of_ready,
        "definition_of_done": issue.definition_of_done,
        "estimated_hours": est_hrs,
        "actual_hours": actual_hrs,
        "remaining_hours": rem_hrs,
        "completion_percentage": issue.completion_percentage or (100 if issue.status and issue.status.category == "done" else (50 if issue.status and issue.status.category == "in_progress" else 0)),

        # AI Preparation Fields (Nullable columns directly on Issue)
        "ai_estimated_hours": float(issue.ai_estimated_hours) if issue.ai_estimated_hours is not None else None,
        "ai_priority": issue.ai_priority,
        "ai_risk": issue.ai_risk,
        "ai_suggested_resource_id": issue.ai_suggested_resource_id,
        "ai_similar_tasks": issue.ai_similar_tasks or [],
        "ai_confidence_score": float(issue.ai_confidence_score) if issue.ai_confidence_score is not None else None,
        "milestone": {
            "id": issue.milestone.id,
            "name": issue.milestone.name,
            "status": issue.milestone.status,
        } if getattr(issue, "milestone", None) else None,
        "deliverable": {
            "id": issue.deliverable.id,
            "title": issue.deliverable.title,
            "status": issue.deliverable.status,
        } if getattr(issue, "deliverable", None) else None,

        "createdAt": issue.created_at.isoformat() if issue.created_at else None,
        "updatedAt": issue.updated_at.isoformat() if issue.updated_at else None,
    }



def get_issue_by_id(db: Session, issue_id: int) -> Optional[Issue]:
    return (
        db.query(Issue)
        .options(
            joinedload(Issue.type),
            joinedload(Issue.status),
            joinedload(Issue.priority),
            joinedload(Issue.assignee),
            joinedload(Issue.reporter),
            joinedload(Issue.milestone),
            joinedload(Issue.deliverable),
            joinedload(Issue.labels),
            joinedload(Issue.time_logs),
            joinedload(Issue.checklists),
            joinedload(Issue.dependencies),
        )
        .filter(Issue.id == issue_id, Issue.deleted_at.is_(None))
        .first()
    )


# ── Checklists ────────────────────────────────────────────────────────────

def get_checklists(db: Session, issue_id: int) -> List[TaskChecklist]:
    return (
        db.query(TaskChecklist)
        .filter(TaskChecklist.issue_id == issue_id)
        .order_by(TaskChecklist.position.asc(), TaskChecklist.id.asc())
        .all()
    )


def create_checklist_item(db: Session, issue_id: int, title: str, user_id: int) -> TaskChecklist:
    max_pos = db.query(func.max(TaskChecklist.position)).filter(TaskChecklist.issue_id == issue_id).scalar() or 0
    chk = TaskChecklist(
        issue_id=issue_id,
        title=title,
        completed=False,
        position=max_pos + 1,
    )
    db.add(chk)
    log_task_activity(db, issue_id, user_id, "checklist_created", f"Added checklist item: {title}")
    db.commit()
    db.refresh(chk)
    return chk


def update_checklist_item(db: Session, checklist_id: int, data: dict, user_id: int) -> Optional[TaskChecklist]:
    chk = db.query(TaskChecklist).filter(TaskChecklist.id == checklist_id).first()
    if not chk:
        return None

    if "title" in data and data["title"] is not None:
        chk.title = data["title"]
    if "completed" in data and data["completed"] is not None:
        chk.completed = data["completed"]
        if chk.completed:
            chk.completed_by = user_id
            chk.completed_at = datetime.utcnow()
            log_task_activity(db, chk.issue_id, user_id, "checklist_completed", f"Completed checklist item: {chk.title}")
        else:
            chk.completed_by = None
            chk.completed_at = None

    db.commit()
    db.refresh(chk)
    return chk


def delete_checklist_item(db: Session, checklist_id: int, user_id: int) -> bool:
    chk = db.query(TaskChecklist).filter(TaskChecklist.id == checklist_id).first()
    if not chk:
        return False
    log_task_activity(db, chk.issue_id, user_id, "checklist_deleted", f"Removed checklist item: {chk.title}")
    db.delete(chk)
    db.commit()
    return True


# ── Dependencies ──────────────────────────────────────────────────────────

def get_dependencies(db: Session, issue_id: int):
    deps = (
        db.query(TaskDependency)
        .options(joinedload(TaskDependency.depends_on))
        .filter(TaskDependency.issue_id == issue_id)
        .all()
    )
    res = []
    for d in deps:
        target = d.depends_on
        res.append({
            "id": d.id,
            "issue_id": d.issue_id,
            "depends_on_id": d.depends_on_id,
            "relationship": getattr(d, "relationship", None) or d.type or "blocks",
            "dependency_type": getattr(d, "dependency_type", None) or "finish_to_start",
            "created_by": d.created_by,
            "target_issue": {
                "id": target.id,
                "key": target.key if target else f"ISS-{d.depends_on_id}",
                "title": target.title if target else "",
                "status": target.status.name if target and target.status else "Todo",
            } if target else None
        })
    return res


def add_dependency(db: Session, issue_id: int, depends_on_id: int, relationship_type: str, dep_type: str, user_id: int) -> dict:
    dep = TaskDependency(
        issue_id=issue_id,
        depends_on_id=depends_on_id,
        type=relationship_type,
        created_by=user_id,
    )
    db.add(dep)
    log_task_activity(db, issue_id, user_id, "dependency_added", f"Added dependency on issue #{depends_on_id} ({relationship_type})")
    db.commit()
    db.refresh(dep)
    return {
        "id": dep.id,
        "issue_id": dep.issue_id,
        "depends_on_id": dep.depends_on_id,
        "relationship": relationship_type,
        "dependency_type": dep_type,
    }


def remove_dependency(db: Session, dependency_id: int, user_id: int) -> bool:
    dep = db.query(TaskDependency).filter(TaskDependency.id == dependency_id).first()
    if not dep:
        return False
    log_task_activity(db, dep.issue_id, user_id, "dependency_removed", f"Removed dependency #{dependency_id}")
    db.delete(dep)
    db.commit()
    return True


# ── Time Logs ─────────────────────────────────────────────────────────────

def get_time_logs(db: Session, issue_id: int):
    logs = (
        db.query(TimeLog)
        .options(joinedload(TimeLog.user))
        .filter(TimeLog.issue_id == issue_id)
        .order_by(TimeLog.logged_at.desc(), TimeLog.id.desc())
        .all()
    )
    return [
        {
            "id": l.id,
            "issue_id": l.issue_id,
            "user_id": l.user_id,
            "user_name": l.user.name if l.user else "Unknown",
            "hours": l.hours,
            "duration_minutes": l.duration_minutes,
            "description": l.description,
            "logged_at": l.logged_at.isoformat() if l.logged_at else None,
            "billable": bool(l.billable),
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


def log_time(db: Session, issue_id: int, user_id: int, hours: float, description: Optional[str], date_str: Optional[str], billable: bool) -> TimeLog:
    duration_min = int(hours * 60)
    logged_date = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else datetime.utcnow().date()
    tl = TimeLog(
        issue_id=issue_id,
        user_id=user_id,
        duration_minutes=duration_min,
        description=description,
        logged_at=logged_date,
        billable=1 if billable else 0,
    )
    db.add(tl)
    log_task_activity(db, issue_id, user_id, "time_logged", f"Logged {hours} hours ({'Billable' if billable else 'Non-billable'})")

    # Update Issue actual_hours summary
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if issue:
        total_min = sum(t.duration_minutes or 0 for t in issue.time_logs) + duration_min
        issue.actual_hours = round(total_min / 60.0, 2)
        est = float(issue.estimated_hours) if issue.estimated_hours is not None else 0.0
        issue.remaining_hours = max(0.0, est - float(issue.actual_hours))

    db.commit()
    db.refresh(tl)
    return tl


# ── Subtasks ──────────────────────────────────────────────────────────────

def get_subtasks(db: Session, parent_id: int):
    subtasks = (
        db.query(Issue)
        .options(joinedload(Issue.status), joinedload(Issue.assignee), joinedload(Issue.priority))
        .filter(Issue.parent_id == parent_id, Issue.deleted_at.is_(None))
        .order_by(Issue.id.asc())
        .all()
    )
    return [
        {
            "id": st.id,
            "key": st.key,
            "title": st.title,
            "statusId": st.issue_status_id,
            "statusName": st.status.name if st.status else "Todo",
            "statusCategory": st.status.category if st.status else "todo",
            "priorityId": st.issue_priority_id,
            "priorityName": st.priority.name if st.priority else "Medium",
            "assigneeId": st.assignee_id,
            "assigneeName": st.assignee.name if st.assignee else None,
            "estimated_hours": float(st.estimated_hours) if st.estimated_hours is not None else 0,
        }
        for st in subtasks
    ]


def create_subtask(db: Session, parent_id: int, title: str, user_id: int, estimated_hours: float = 0.0) -> Issue:
    parent = db.query(Issue).filter(Issue.id == parent_id).first()
    if not parent:
        raise ValueError("Parent task not found")
    st = Issue(
        title=title,
        project_id=parent.project_id,
        parent_id=parent.id,
        reporter_id=user_id,
        assignee_id=user_id,
        issue_status_id=parent.issue_status_id,
        issue_type_id=parent.issue_type_id,
        issue_priority_id=parent.issue_priority_id,
        estimated_hours=estimated_hours,
    )
    db.add(st)
    log_task_activity(db, parent_id, user_id, "subtask_created", f"Created subtask: {title}")
    db.commit()
    db.refresh(st)
    return st


# ── Attachments ───────────────────────────────────────────────────────────

def get_attachments(db: Session, issue_id: int):
    atts = (
        db.query(IssueAttachment)
        .options(joinedload(IssueAttachment.user))
        .filter(IssueAttachment.issue_id == issue_id)
        .order_by(IssueAttachment.created_at.desc())
        .all()
    )
    return [
        {
            "id": a.id,
            "issue_id": a.issue_id,
            "user_id": a.user_id,
            "uploader_name": a.user.name if a.user else "Unknown",
            "filename": getattr(a, "filename", None) or getattr(a, "original_filename", "file"),
            "original_filename": getattr(a, "original_filename", None) or getattr(a, "filename", "file"),
            "mime_type": getattr(a, "mime_type", "application/octet-stream"),
            "file_size": getattr(a, "size", 0) or getattr(a, "file_size", 0),
            "storage_path": getattr(a, "path", "") or getattr(a, "storage_path", ""),
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in atts
    ]


def create_attachment(db: Session, issue_id: int, user_id: int, filename: str, original_filename: str, mime_type: str, file_size: int, storage_path: str) -> IssueAttachment:
    att = IssueAttachment(
        issue_id=issue_id,
        user_id=user_id,
        filename=filename,
        original_filename=original_filename,
        mime_type=mime_type,
        size=file_size,
        path=storage_path,
    )
    db.add(att)
    log_task_activity(db, issue_id, user_id, "attachment_uploaded", f"Uploaded attachment: {original_filename}")
    db.commit()
    db.refresh(att)
    return att


def delete_attachment(db: Session, attachment_id: int, user_id: int) -> bool:
    att = db.query(IssueAttachment).filter(IssueAttachment.id == attachment_id).first()
    if not att:
        return False
    log_task_activity(db, att.issue_id, user_id, "attachment_deleted", f"Deleted attachment #{attachment_id}")
    db.delete(att)
    db.commit()
    return True


# ── Activities & History ──────────────────────────────────────────────────

def get_activities(db: Session, issue_id: int, activity_type: Optional[str] = None):
    query = db.query(TaskActivity).options(joinedload(TaskActivity.user)).filter(TaskActivity.issue_id == issue_id)
    if activity_type and activity_type.lower() != "all":
        query = query.filter(TaskActivity.activity_type.ilike(f"%{activity_type}%"))
    acts = query.order_by(TaskActivity.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "issue_id": a.issue_id,
            "user_id": a.user_id,
            "user_name": a.user.name if a.user else "System",
            "activity_type": a.activity_type,
            "description": a.description,
            "extra_data": a.extra_data,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in acts
    ]


def get_history(db: Session, issue_id: int):
    hists = (
        db.query(IssueHistory)
        .filter(IssueHistory.issue_id == issue_id)
        .order_by(IssueHistory.created_at.desc())
        .all()
    )
    return [
        {
            "id": h.id,
            "issue_id": h.issue_id,
            "user_id": h.user_id,
            "field": h.field,
            "old_value": h.old_value,
            "new_value": h.new_value,
            "action": h.action,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h in hists
    ]
