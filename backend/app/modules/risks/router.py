"""Risks router — risk register with status management."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.models.risk import Risk
from app.modules.risks.schemas import RiskCreateIn, RiskUpdateIn
from app.modules.risks import service, repository as repo
from app.modules.projects.access import filter_query_by_project_access, require_project_access

router = APIRouter(tags=["Risks"])


def _fmt_risk(r: Risk) -> dict:
    return {
        "id": r.id,
        "projectId": r.project_id,
        "title": r.title,
        "description": r.description,
        "category": r.category,
        "probability": r.probability,
        "impact": r.impact,
        "riskScore": r.probability * r.impact if r.probability and r.impact else 0,
        "severity": r.severity,
        "status": r.status,
        "owner": r.owner,
        "ownerUserId": r.owner_user_id,
        "responsePlan": r.response_plan,
        "contingencyPlan": r.contingency_plan,
        "dueDate": r.due_date.isoformat() if r.due_date else None,
        "closedAt": r.closed_at.isoformat() if r.closed_at else None,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/risks")
def list_risks(
    project_id: Optional[int] = Query(None),
    status: str = Query(""),
    severity: str = Query(""),
    page: int = Query(1),
    per_page: int = Query(50),
    current_user=Depends(require_permissions("view-risks")),
    db: Session = Depends(get_db),
):
    q = repo.get_risks_query(db, project_id=project_id, status=status, severity=severity)
    q = filter_query_by_project_access(q, Risk.project_id, current_user.id, _get_user_roles(current_user.id, db))
    return paginate(q.order_by(Risk.created_at.desc()), page, per_page, serializer=_fmt_risk)


@router.post("/risks", status_code=201)
def create_risk(body: RiskCreateIn, current_user=Depends(require_permissions("manage-risks")), db: Session = Depends(get_db)):
    if body.project_id is not None:
        require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), body.project_id)
    risk = service.create_risk(db, body, current_user.id)
    return _fmt_risk(risk)


@router.get("/risks/{risk_id}")
def get_risk(risk_id: int, current_user=Depends(require_permissions("view-risks")), db: Session = Depends(get_db)):
    r = repo.get_risk_by_id(db, risk_id)
    if not r:
        raise HTTPException(404, "Risk not found.")
    return _fmt_risk(r)


@router.put("/risks/{risk_id}")
def update_risk(risk_id: int, body: RiskUpdateIn, current_user=Depends(require_permissions("manage-risks")), db: Session = Depends(get_db)):
    r = repo.get_risk_by_id(db, risk_id)
    if not r:
        raise HTTPException(404, "Risk not found.")
    r = service.update_risk(db, r, body)
    return _fmt_risk(r)


@router.delete("/risks/{risk_id}", response_model=MessageResponse)
def delete_risk(risk_id: int, current_user=Depends(require_permissions("manage-risks")), db: Session = Depends(get_db)):
    r = repo.get_risk_by_id(db, risk_id)
    if not r:
        raise HTTPException(404, "Risk not found.")
    service.delete_risk(db, r)
    return MessageResponse(message="Risk archived.")


@router.patch("/risks/{risk_id}/status")
def update_risk_status(risk_id: int, body: dict, current_user=Depends(require_permissions("manage-risks")), db: Session = Depends(get_db)):
    r = repo.get_risk_by_id(db, risk_id)
    if not r:
        raise HTTPException(404, "Risk not found.")
    r = service.update_risk_status(db, r, body.get("status"))
    return _fmt_risk(r)
