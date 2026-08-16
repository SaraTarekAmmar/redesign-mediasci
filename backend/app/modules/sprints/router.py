"""Sprints router — sprint CRUD, board epics, stories."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.pagination import MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.models.issue import Issue
from app.models.sprint import Sprint
from app.modules.sprints.schemas import SprintCreateIn, SprintUpdateIn, CompleteSprintIn
from app.modules.sprints import service, repository as repo
from app.modules.projects.access import filter_query_by_project_access

router = APIRouter(tags=["Sprints"])


def _fmt_sprint(s: Sprint) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "projectId": s.project_id,
        "goal": s.goal,
        "status": s.status,
        "startDate": s.start_date.isoformat() if s.start_date else None,
        "endDate": s.end_date.isoformat() if s.end_date else None,
        "createdAt": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/projects/{project_id}/sprints")
def list_sprints(project_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    sprints = repo.get_sprints_query(db, project_id=project_id).order_by(Sprint.id).all()
    return [_fmt_sprint(s) for s in sprints]


@router.post("/projects/{project_id}/sprints", status_code=201)
def create_sprint(
    project_id: int,
    body: SprintCreateIn,
    current_user=Depends(require_permissions("create-sprints")),
    db: Session = Depends(get_db),
):
    sprint = service.create_sprint(db, project_id, body)
    return _fmt_sprint(sprint)


@router.get("/sprints/{sprint_id}")
def get_sprint(sprint_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    sprint = repo.get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise HTTPException(404, "Sprint not found.")
    return _fmt_sprint(sprint)


@router.put("/sprints/{sprint_id}")
def update_sprint(
    sprint_id: int,
    body: SprintUpdateIn,
    current_user=Depends(require_permissions("edit-sprints")),
    db: Session = Depends(get_db),
):
    sprint = repo.get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise HTTPException(404, "Sprint not found.")
    sprint = service.update_sprint(db, sprint, body)
    return _fmt_sprint(sprint)


@router.delete("/sprints/{sprint_id}", response_model=MessageResponse)
def delete_sprint(
    sprint_id: int,
    current_user=Depends(require_permissions("edit-sprints")),
    db: Session = Depends(get_db),
):
    sprint = repo.get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise HTTPException(404, "Sprint not found.")
    if sprint.status == "active":
        raise HTTPException(422, "Cannot delete an active sprint. Complete it first.")
    service.delete_sprint(db, sprint)
    return MessageResponse(message="Sprint deleted.")


@router.post("/sprints/{sprint_id}/complete")
def complete_sprint(
    sprint_id: int,
    body: CompleteSprintIn,
    current_user=Depends(require_permissions("manage-sprint-issues")),
    db: Session = Depends(get_db),
):
    sprint = repo.get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise HTTPException(404, "Sprint not found.")
    if sprint.status != "active":
        raise HTTPException(422, "Only active sprints can be completed.")
    if body.move_incomplete_to:
        target = repo.get_sprint_by_id(db, body.move_incomplete_to)
        if not target:
            raise HTTPException(404, "Target sprint not found.")
        if target.id == sprint.id or target.project_id != sprint.project_id:
            raise HTTPException(422, "Incomplete issues can only move to another sprint in the same project.")
    moved_count = service.complete_sprint(db, sprint, body)
    return {
        "message": f"Sprint completed. {moved_count} incomplete issues moved.",
        "moved_count": moved_count,
        "sprint": _fmt_sprint(sprint),
    }


@router.post("/sprints/{sprint_id}/issues", status_code=201)
def add_issue_to_sprint(
    sprint_id: int,
    body: dict,
    current_user=Depends(require_permissions("manage-sprint-issues")),
    db: Session = Depends(get_db),
):
    issue_id = body.get("issue_id")
    sprint = repo.get_sprint_by_id(db, sprint_id)
    if not sprint:
        raise HTTPException(404, "Sprint not found.")
    issue = db.query(Issue).filter(Issue.id == issue_id, Issue.deleted_at.is_(None)).first()
    if not issue or issue.project_id != sprint.project_id:
        raise HTTPException(422, "The issue and sprint must belong to the same project.")
    service.add_issue_to_sprint(db, sprint_id, issue_id)
    return {"success": True}


@router.delete("/sprints/{sprint_id}/issues/{issue_id}", response_model=MessageResponse)
def remove_issue_from_sprint(
    sprint_id: int,
    issue_id: int,
    current_user=Depends(require_permissions("manage-sprint-issues")),
    db: Session = Depends(get_db),
):
    service.remove_issue_from_sprint(db, sprint_id, issue_id)
    return MessageResponse(message="Issue removed from sprint (moved to backlog).")


@router.get("/sprints")
def list_all_sprints(
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = repo.get_sprints_query(db, project_id=project_id, status=status)
    q = filter_query_by_project_access(q, Sprint.project_id, current_user.id, _get_user_roles(current_user.id, db))
    return [_fmt_sprint(s) for s in q.order_by(Sprint.project_id, Sprint.id).all()]
