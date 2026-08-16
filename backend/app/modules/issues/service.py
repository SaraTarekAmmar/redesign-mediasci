from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.modules.issues import repository as repo
from app.modules.issues.schemas import (
    IssueCreateIn, IssueUpdateIn, TimeLogCreateIn, DependencyCreateIn,
    ChecklistCreateIn, ChecklistUpdateIn
)


def get_issue_details(db: Session, issue_id: int):
    issue = repo.get_issue_by_id(db, issue_id)
    if not issue:
        return None
    return repo.format_issue_detailed(issue, db)


def update_issue_execution_fields(db: Session, issue_id: int, body: IssueUpdateIn, user_id: int):
    issue = repo.get_issue_by_id(db, issue_id)
    if not issue:
        return None

    data = body.model_dump(exclude_unset=True)

    # Log field history diffs
    for field_name, new_val in data.items():
        if hasattr(issue, field_name):
            old_val = getattr(issue, field_name)
            if old_val != new_val:
                repo.log_field_history(db, issue_id, user_id, field_name, old_val, new_val)
                setattr(issue, field_name, new_val)

    repo.log_task_activity(db, issue_id, user_id, "task_updated", f"Updated task attributes: {', '.join(data.keys())}")
    db.commit()
    db.refresh(issue)
    return repo.format_issue_detailed(issue, db)


# Checklist Service Wrappers
def get_task_checklists(db: Session, issue_id: int):
    items = repo.get_checklists(db, issue_id)
    return [
        {
            "id": c.id,
            "issue_id": c.issue_id,
            "title": c.title,
            "completed": c.completed,
            "completed_by": c.completed_by,
            "completed_at": c.completed_at.isoformat() if c.completed_at else None,
            "position": c.position,
        }
        for c in items
    ]


def create_task_checklist(db: Session, issue_id: int, body: ChecklistCreateIn, user_id: int):
    item = repo.create_checklist_item(db, issue_id, body.title, user_id)
    return {
        "id": item.id,
        "issue_id": item.issue_id,
        "title": item.title,
        "completed": item.completed,
        "position": item.position,
    }


def update_task_checklist(db: Session, checklist_id: int, body: ChecklistUpdateIn, user_id: int):
    item = repo.update_checklist_item(db, checklist_id, body.model_dump(exclude_unset=True), user_id)
    if not item:
        return None
    return {
        "id": item.id,
        "issue_id": item.issue_id,
        "title": item.title,
        "completed": item.completed,
        "completed_by": item.completed_by,
        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
        "position": item.position,
    }


def delete_task_checklist(db: Session, checklist_id: int, user_id: int):
    return repo.delete_checklist_item(db, checklist_id, user_id)


# Dependency Service Wrappers
def get_task_dependencies(db: Session, issue_id: int):
    return repo.get_dependencies(db, issue_id)


def add_task_dependency(db: Session, issue_id: int, body: DependencyCreateIn, user_id: int):
    return repo.add_dependency(
        db,
        issue_id,
        body.depends_on_id,
        body.relationship or "blocks",
        body.dependency_type or "finish_to_start",
        user_id,
    )


def remove_task_dependency(db: Session, dependency_id: int, user_id: int):
    return repo.remove_dependency(db, dependency_id, user_id)


# Time Tracking Service Wrappers
def get_task_time_logs(db: Session, issue_id: int):
    return repo.get_time_logs(db, issue_id)


def create_task_time_log(db: Session, issue_id: int, body: TimeLogCreateIn, user_id: int):
    return repo.log_time(db, issue_id, user_id, body.hours, body.description, body.date, body.billable or False)


# Activity & History Service Wrappers
def get_task_activities(db: Session, issue_id: int):
    return repo.get_activities(db, issue_id)


def get_task_history(db: Session, issue_id: int):
    return repo.get_history(db, issue_id)
