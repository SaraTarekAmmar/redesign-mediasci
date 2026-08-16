"""Requests router — client requests CRUD."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.models.client import ClientRequest
from app.models.project import Project
from app.modules.projects.access import accessible_project_ids_query, is_system_admin, require_project_access
from app.modules.requests.schemas import RequestCreateIn, RequestUpdateIn
from app.modules.requests import service, repository as repo

router = APIRouter(tags=["Client Requests"])


def _require_linked_project_access(db: Session, current_user, request_id: int) -> None:
    project_id = db.execute(
        select(Project.id).where(
            Project.client_request_id == request_id,
            Project.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if project_id:
        require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), project_id)


def _fmt(r: ClientRequest) -> dict:
    """Serialize for the SPA (snake_case + nested client)."""
    client = getattr(r, "client", None)
    return {
        "id": str(r.id),
        "client_id": str(r.client_id) if r.client_id is not None else None,
        "clientId": r.client_id,
        "title": r.title,
        "description": r.description,
        "type": r.type,
        "status": r.status,
        "priority": r.priority,
        "estimated_hours": float(r.estimated_hours) if r.estimated_hours is not None else None,
        "estimatedHours": float(r.estimated_hours) if r.estimated_hours is not None else None,
        "estimated_cost": float(r.estimated_cost) if r.estimated_cost is not None else None,
        "estimatedCost": float(r.estimated_cost) if r.estimated_cost is not None else None,
        "due_date": r.due_date.isoformat() if r.due_date else None,
        "dueDate": r.due_date.isoformat() if r.due_date else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
        "client": (
            {
                "id": str(client.id),
                "name": client.name,
                "company": getattr(client, "company_name", None),
                "status": getattr(client, "status", None),
            }
            if client
            else None
        ),
    }


@router.get("/requests")
def list_requests(
    client_id: Optional[int] = Query(None),
    status: str = Query(""),
    page: int = Query(1),
    per_page: int = Query(25),
    current_user=Depends(require_permissions("view-clients")),
    db: Session = Depends(get_db),
):
    q = repo.get_requests_query(db, client_id=client_id, status=status).options(
        joinedload(ClientRequest.client)
    )
    roles = _get_user_roles(current_user.id, db)
    if not is_system_admin(roles):
        q = q.outerjoin(Project, Project.client_request_id == ClientRequest.id).filter(or_(
            Project.id.is_(None),
            Project.id.in_(accessible_project_ids_query(current_user.id)),
        ))
    return paginate(q.order_by(ClientRequest.created_at.desc()), page, per_page, serializer=_fmt)


@router.post("/requests", status_code=201)
def create_request(body: RequestCreateIn, current_user=Depends(require_permissions("manage-clients")), db: Session = Depends(get_db)):
    req = service.create_request(db, body, current_user.id)
    req = repo.get_request_by_id(db, req.id)
    return _fmt(req)


@router.get("/requests/{req_id}")
def get_request(req_id: int, current_user=Depends(require_permissions("view-clients")), db: Session = Depends(get_db)):
    req = repo.get_request_by_id(db, req_id)
    if not req or req.deleted_at:
        raise HTTPException(404, "Request not found.")
    _require_linked_project_access(db, current_user, req.id)
    return _fmt(req)


@router.put("/requests/{req_id}")
def update_request(req_id: int, body: RequestUpdateIn, current_user=Depends(require_permissions("manage-clients")), db: Session = Depends(get_db)):
    req = repo.get_request_by_id(db, req_id)
    if not req or req.deleted_at:
        raise HTTPException(404, "Request not found.")
    _require_linked_project_access(db, current_user, req.id)
    req = service.update_request(db, req, body)
    req = repo.get_request_by_id(db, req.id)
    return _fmt(req)


@router.patch("/requests/{req_id}/status", response_model=MessageResponse)
def update_status(req_id: int, body: dict, current_user=Depends(require_permissions("manage-clients")), db: Session = Depends(get_db)):
    req = repo.get_request_by_id(db, req_id)
    if not req or req.deleted_at:
        raise HTTPException(404, "Request not found.")
    _require_linked_project_access(db, current_user, req.id)
    new_status = body.get("status", req.status)
    service.update_status(db, req, new_status)
    return MessageResponse(message=f"Status updated to {req.status}.")


@router.delete("/requests/{req_id}", response_model=MessageResponse)
def delete_request(req_id: int, current_user=Depends(require_permissions("manage-clients")), db: Session = Depends(get_db)):
    req = repo.get_request_by_id(db, req_id)
    if not req or req.deleted_at:
        raise HTTPException(404, "Request not found.")
    _require_linked_project_access(db, current_user, req.id)
    service.delete_request(db, req)
    return MessageResponse(message="Request deleted.")
