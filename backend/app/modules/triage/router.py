"""Triage API matching the React TriagePage contract: /api/triage*."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.modules.projects.access import accessible_project_ids
from app.modules.triage import service
from app.modules.triage.schemas import TriageUpdateIn

router = APIRouter(tags=["Triage"])


@router.get("/triage")
def list_triage(
    project_id: Optional[int] = Query(None),
    triage_status: Optional[str] = Query(None),
    current_user=Depends(require_permissions("view-issues")),
    db: Session = Depends(get_db),
):
    data = service.list_triage_issues(
        db,
        project_id=project_id,
        triage_status=triage_status,
        allowed_project_ids=accessible_project_ids(
            db,
            current_user.id,
            _get_user_roles(current_user.id, db),
        ),
    )
    return {"data": data}


@router.post("/triage/{issue_id}/confirm")
def confirm_triage(
    issue_id: int,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    return service.confirm_issue(db, issue_id, actor_id=current_user.id)


@router.post("/triage/{issue_id}/dismiss")
def dismiss_triage(
    issue_id: int,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    return service.dismiss_issue(db, issue_id, actor_id=current_user.id)


@router.post("/triage/{issue_id}/revert")
def revert_triage(
    issue_id: int,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    return service.revert_issue(db, issue_id, actor_id=current_user.id)


@router.post("/triage/{issue_id}/triage")
def update_triage_notes(
    issue_id: int,
    body: TriageUpdateIn,
    current_user=Depends(require_permissions("edit-issues")),
    db: Session = Depends(get_db),
):
    status = body.triage_status or body.status
    notes = body.triage_notes if body.triage_notes is not None else body.notes
    return service.update_triage(
        db,
        issue_id,
        actor_id=current_user.id,
        triage_status=status,
        triage_notes=notes,
    )
