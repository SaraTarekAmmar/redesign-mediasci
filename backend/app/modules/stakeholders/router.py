"""Stakeholders router."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.pagination import MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.models.project import Project
from app.models.stakeholder import Stakeholder
from app.modules.stakeholders.schemas import StakeholderCreateIn, StakeholderUpdateIn, EngagementCreateIn, ImpactCreateIn
from app.modules.stakeholders import service, repository as repo
from app.modules.projects.access import (
    accessible_project_ids,
    is_system_admin,
    require_project_access,
)

router = APIRouter(tags=["Stakeholders"])


def _allowed_projects(db: Session, current_user) -> set[int] | None:
    roles = _get_user_roles(current_user.id, db)
    if is_system_admin(roles):
        return None
    return accessible_project_ids(db, current_user.id, roles)


def _fmt_stakeholder(s: Stakeholder) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "role": s.role or "",
        "organization": s.organization or "",
        "email": s.email or "",
        "phone": s.phone or "",
        "influence": s.influence_level or "Medium",
        "interest": s.interest_level or "Medium",
        "communicationPreference": s.communication_preference or "Email",
        "status": s.status or "Active",
        "notes": s.notes or "",
        "createdAt": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/stakeholders")
def list_stakeholders(
    project_id: Optional[int] = Query(None),
    q: str = Query(""),
    current_user=Depends(require_permissions("view-stakeholders")),
    db: Session = Depends(get_db),
):
    query = repo.get_stakeholders_query(db, project_id=project_id, q=q)
    allowed = _allowed_projects(db, current_user)
    if allowed is not None:
        query = query.filter(Stakeholder.projects.any(Project.id.in_(allowed or {-1})))
    stakeholders = query.order_by(Stakeholder.name).all()
    return [_fmt_stakeholder(s) for s in stakeholders]


@router.post("/stakeholders", status_code=201)
def create_stakeholder(body: StakeholderCreateIn, current_user=Depends(require_permissions("manage-stakeholders")), db: Session = Depends(get_db)):
    if body.project_id is not None:
        require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), body.project_id)
    s = service.create_stakeholder(db, body)
    return _fmt_stakeholder(s)


@router.get("/stakeholders/engagement")
def stakeholders_engagement(current_user=Depends(require_permissions("view-stakeholders")), db: Session = Depends(get_db)):
    return service.build_engagement(db, _allowed_projects(db, current_user))


@router.get("/stakeholders/analytics")
def stakeholders_analytics(current_user=Depends(require_permissions("view-stakeholders")), db: Session = Depends(get_db)):
    return service.build_analytics(db, _allowed_projects(db, current_user))


@router.get("/stakeholders/registration")
def stakeholders_registration(current_user=Depends(require_permissions("view-stakeholders")), db: Session = Depends(get_db)):
    return service.build_registration(db, _allowed_projects(db, current_user))


@router.get("/stakeholders/impact")
def stakeholders_impact(current_user=Depends(require_permissions("view-stakeholders")), db: Session = Depends(get_db)):
    return service.build_impact(db, _allowed_projects(db, current_user))


@router.get("/stakeholders/{stakeholder_id}")
def get_stakeholder(stakeholder_id: int, current_user=Depends(require_permissions("view-stakeholders")), db: Session = Depends(get_db)):
    s = repo.get_stakeholder_by_id(db, stakeholder_id)
    if not s:
        raise HTTPException(404, "Stakeholder not found.")
    engagements = [{"id": e.id, "type": e.type, "notes": e.description, "date": e.date.isoformat() if e.date else None} for e in s.engagements]
    impacts = [{"id": i.id, "area": i.area, "level": i.level, "description": i.description} for i in s.impacts]
    return {**_fmt_stakeholder(s), "engagements": engagements, "impacts": impacts}


@router.put("/stakeholders/{stakeholder_id}")
def update_stakeholder(stakeholder_id: int, body: StakeholderUpdateIn, current_user=Depends(require_permissions("manage-stakeholders")), db: Session = Depends(get_db)):
    s = repo.get_stakeholder_by_id(db, stakeholder_id)
    if not s:
        raise HTTPException(404, "Stakeholder not found.")
    s = service.update_stakeholder(db, s, body)
    return _fmt_stakeholder(s)


@router.delete("/stakeholders/{stakeholder_id}", response_model=MessageResponse)
def delete_stakeholder(stakeholder_id: int, current_user=Depends(require_permissions("manage-stakeholders")), db: Session = Depends(get_db)):
    s = repo.get_stakeholder_by_id(db, stakeholder_id)
    if not s:
        raise HTTPException(404, "Stakeholder not found.")
    service.delete_stakeholder(db, s)
    return MessageResponse(message="Stakeholder deleted.")


@router.get("/stakeholders/{stakeholder_id}/engagements")
def list_engagements(stakeholder_id: int, current_user=Depends(require_permissions("view-stakeholders")), db: Session = Depends(get_db)):
    engagements = repo.get_engagements_by_stakeholder(db, stakeholder_id)
    return [{"id": e.id, "type": e.type, "notes": e.description, "nextAction": e.outcome, "date": e.date.isoformat() if e.date else None} for e in engagements]


@router.post("/stakeholders/{stakeholder_id}/engagements", status_code=201)
def create_engagement(stakeholder_id: int, body: EngagementCreateIn, current_user=Depends(require_permissions("manage-stakeholders")), db: Session = Depends(get_db)):
    e = service.create_engagement(db, stakeholder_id, body)
    return {"id": e.id}


@router.get("/stakeholders/{stakeholder_id}/impacts")
def list_impacts(stakeholder_id: int, current_user=Depends(require_permissions("view-stakeholders")), db: Session = Depends(get_db)):
    impacts = repo.get_impacts_by_stakeholder(db, stakeholder_id)
    return [{"id": i.id, "area": i.area, "level": i.level, "description": i.description} for i in impacts]


@router.post("/stakeholders/{stakeholder_id}/impacts", status_code=201)
def create_impact(stakeholder_id: int, body: ImpactCreateIn, current_user=Depends(require_permissions("manage-stakeholders")), db: Session = Depends(get_db)):
    i = service.create_impact(db, stakeholder_id, body)
    return {"id": i.id, "area": i.area, "level": i.level}
