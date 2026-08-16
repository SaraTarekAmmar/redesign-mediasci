"""Change Requests router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.models.change_request import ChangeRequest
from app.modules.change_requests.schemas import CRCreateIn, CRUpdateIn
from app.modules.change_requests import service, repository as repo
from app.modules.projects.access import filter_query_by_project_access, require_project_access

router = APIRouter(tags=["Change Requests"])


def _user_brief(user) -> Optional[dict]:
    if not user:
        return None
    return {"id": user.id, "name": user.name, "email": user.email}


def _project_brief(project) -> Optional[dict]:
    if not project:
        return None
    return {"id": project.id, "name": project.name, "key": getattr(project, "key", None)}


def _fmt(cr: ChangeRequest) -> dict:
    """Serialize a change request to the contract the frontend consumes."""
    status = (cr.status or "draft").lower()
    if status == "draft":
        status = "pending"
    return {
        "id": cr.id,
        "project_id": cr.project_id,
        "title": cr.title,
        "description": cr.description,
        "type": cr.type,
        "priority": cr.priority,
        "impact": cr.impact,
        "business_justification": cr.justification,
        "rollback_plan": None,
        "rejection_reason": cr.extra_notes if status == "rejected" else None,
        "requested_by": cr.requested_by,
        "date": cr.created_at.isoformat() if cr.created_at else None,
        "status": status,
        "approved_by": cr.approved_by,
        "assigned_to": None,
        "notes": cr.extra_notes,
        "created_at": cr.created_at.isoformat() if cr.created_at else None,
        "requestedBy": _user_brief(cr.requester),
        "approvedBy": _user_brief(cr.approver),
        "project": _project_brief(cr.project),
    }


@router.get("/change-requests")
def list_change_requests(
    project_id: Optional[int] = Query(None),
    status: str = Query(""),
    page: int = Query(1),
    per_page: int = Query(25),
    current_user=Depends(require_permissions("view-change-requests")),
    db: Session = Depends(get_db),
):
    q = repo.get_change_requests_query(db, project_id=project_id, status=status)
    roles = _get_user_roles(current_user.id, db)
    q = filter_query_by_project_access(q, ChangeRequest.project_id, current_user.id, roles)
    return paginate(q.order_by(ChangeRequest.created_at.desc()), page, per_page, serializer=_fmt)


@router.post("/change-requests", status_code=201)
def create_change_request(body: CRCreateIn, current_user=Depends(require_permissions("create-change-requests")), db: Session = Depends(get_db)):
    require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), body.project_id)
    cr = service.create_cr(db, body, current_user.id)
    return _fmt(cr)


@router.get("/change-requests/my-requests")
def list_my_change_requests(
    page: int = Query(1),
    per_page: int = Query(25),
    current_user=Depends(require_permissions("view-change-requests")),
    db: Session = Depends(get_db),
):
    """Change requests submitted by the authenticated user."""
    q = repo.get_my_change_requests_query(db, current_user.id)
    q = filter_query_by_project_access(q, ChangeRequest.project_id, current_user.id, _get_user_roles(current_user.id, db))
    return paginate(q.order_by(ChangeRequest.created_at.desc()), page, per_page, serializer=_fmt)


@router.get("/change-requests/pending-approvals")
def list_pending_approvals(
    page: int = Query(1),
    per_page: int = Query(25),
    current_user=Depends(require_permissions("approve-change-requests")),
    db: Session = Depends(get_db),
):
    """Change requests awaiting a decision, visible to approvers only."""
    q = repo.get_pending_approvals_query(db)
    q = filter_query_by_project_access(q, ChangeRequest.project_id, current_user.id, _get_user_roles(current_user.id, db))
    return paginate(q.order_by(ChangeRequest.created_at.desc()), page, per_page, serializer=_fmt)


@router.get("/change-requests/{cr_id}")
def get_cr(cr_id: int, current_user=Depends(require_permissions("view-change-requests")), db: Session = Depends(get_db)):
    cr = repo.get_cr_by_id(db, cr_id)
    if not cr:
        raise HTTPException(404, "Change request not found.")
    return _fmt(cr)


@router.put("/change-requests/{cr_id}")
def update_cr(cr_id: int, body: CRUpdateIn, current_user=Depends(require_permissions("manage-change-requests")), db: Session = Depends(get_db)):
    cr = repo.get_cr_by_id(db, cr_id)
    if not cr:
        raise HTTPException(404, "Change request not found.")
    cr = service.update_cr(db, cr, body)
    return _fmt(cr)


@router.patch("/change-requests/{cr_id}/approve")
def approve_cr(cr_id: int, body: dict = {}, current_user=Depends(require_permissions("approve-change-requests")), db: Session = Depends(get_db)):
    cr = repo.get_cr_by_id(db, cr_id)
    if not cr:
        raise HTTPException(404, "Change request not found.")
    cr = service.approve_cr(db, cr, current_user.id)
    return _fmt(cr)


@router.post("/change-requests/{cr_id}/approve")
def approve_cr_post(cr_id: int, body: dict = {}, current_user=Depends(require_permissions("approve-change-requests")), db: Session = Depends(get_db)):
    return approve_cr(cr_id, body, current_user, db)


@router.post("/change-requests/{cr_id}/reject")
def reject_cr_post(cr_id: int, body: dict = {}, current_user=Depends(require_permissions("approve-change-requests")), db: Session = Depends(get_db)):
    return reject_cr(cr_id, body, current_user, db)


@router.patch("/change-requests/{cr_id}/reject")
def reject_cr(cr_id: int, body: dict = {}, current_user=Depends(require_permissions("approve-change-requests")), db: Session = Depends(get_db)):
    cr = repo.get_cr_by_id(db, cr_id)
    if not cr:
        raise HTTPException(404, "Change request not found.")
    cr = service.reject_cr(db, cr, current_user.id, reason=body.get("reason"))
    return _fmt(cr)


@router.delete("/change-requests/{cr_id}", response_model=MessageResponse)
def delete_cr(cr_id: int, current_user=Depends(require_permissions("manage-change-requests")), db: Session = Depends(get_db)):
    cr = repo.get_cr_by_id(db, cr_id)
    if not cr:
        raise HTTPException(404, "Change request not found.")
    service.delete_cr(db, cr)
    return MessageResponse(message="Change request archived.")
