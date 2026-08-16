"""Proposals router — proposals, versions, RFPs."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.pagination import paginate
from app.database import get_db
from app.dependencies import (
    _get_user_roles,
    get_current_user,
    require_any_permission,
)
from app.models.client import ClientRequest, Proposal, Rfp
from app.models.project import Project
from app.modules.proposals.schemas import ProposalCreateIn, ProposalVersionIn, RfpCreateIn
from app.modules.proposals import service, repository as repo
from app.modules.projects.access import accessible_project_ids, is_system_admin, require_project_access

router = APIRouter(tags=["Proposals"])


def _fmt_proposal(p: Proposal) -> dict:
    return {
        "id": p.id,
        "client_request_id": p.client_request_id,
        "clientRequestId": p.client_request_id,
        "project_id": p.project_id,
        "projectId": p.project_id,
        "rfp_id": p.rfp_id,
        "rfpId": p.rfp_id,
        "title": p.title,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "createdAt": p.created_at.isoformat() if p.created_at else None,
        "versionCount": len(p.versions) if p.versions else 0,
    }


def _proposal_project_id(db: Session, proposal: Proposal) -> int | None:
    if proposal.project_id is not None:
        return int(proposal.project_id)
    if proposal.client_request_id is None:
        return None
    return db.execute(
        select(Project.id).where(Project.client_request_id == proposal.client_request_id)
    ).scalar_one_or_none()


def _require_proposal_access(db: Session, current_user, proposal: Proposal) -> None:
    project_id = _proposal_project_id(db, proposal)
    if project_id is not None:
        require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), project_id)


@router.get("/proposals")
def list_proposals(
    status: str = Query(""),
    client_request_id: Optional[int] = Query(None),
    page: int = Query(1),
    per_page: int = Query(25),
    current_user=Depends(require_any_permission("view-projects", "view-clients")),
    db: Session = Depends(get_db),
):
    q = repo.get_proposals_query(db, status=status, client_request_id=client_request_id).outerjoin(
        Project,
        Project.client_request_id == Proposal.client_request_id,
    )
    roles = _get_user_roles(current_user.id, db)
    if not is_system_admin(roles):
        allowed_project_ids = sorted(accessible_project_ids(db, current_user.id, roles)) or [-1]
        project_scope = func.coalesce(Proposal.project_id, Project.id)
        q = q.filter(or_(project_scope.is_(None), project_scope.in_(allowed_project_ids)))
    return paginate(q.order_by(Proposal.created_at.desc()), page, per_page, serializer=_fmt_proposal)


@router.post("/proposals", status_code=201)
def create_proposal(
    body: ProposalCreateIn,
    current_user=Depends(require_any_permission("view-projects", "view-clients")),
    db: Session = Depends(get_db),
):
    project_id = None
    if body.client_request_id is not None:
        request = (
            db.query(ClientRequest)
            .filter(ClientRequest.id == body.client_request_id, ClientRequest.deleted_at.is_(None))
            .first()
        )
        if not request:
            raise HTTPException(404, "Client request not found.")
        linked_project_id = db.execute(
            select(Project.id).where(Project.client_request_id == request.id)
        ).scalar_one_or_none()
        if linked_project_id is not None:
            require_project_access(db, current_user.id, _get_user_roles(current_user.id, db), linked_project_id)
        project_id = linked_project_id
    proposal = service.create_proposal(db, body, current_user.id, project_id=project_id)
    return _fmt_proposal(proposal)


@router.get("/proposals/{proposal_id}")
def get_proposal(
    proposal_id: int,
    current_user=Depends(require_any_permission("view-projects", "view-clients")),
    db: Session = Depends(get_db),
):
    proposal = repo.get_proposal_by_id(db, proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found.")
    _require_proposal_access(db, current_user, proposal)
    versions = [
        {
            "id": v.id,
            "versionNumber": v.version_number,
            "summary": v.summary,
            "estimatedCost": float(v.estimated_cost) if v.estimated_cost else None,
            "createdAt": v.created_at.isoformat() if v.created_at else None,
        }
        for v in proposal.versions
    ]
    return {**_fmt_proposal(proposal), "versions": versions}


@router.put("/proposals/{proposal_id}")
def update_proposal(
    proposal_id: int,
    body: dict,
    current_user=Depends(require_any_permission("view-projects", "view-clients")),
    db: Session = Depends(get_db),
):
    proposal = repo.get_proposal_by_id(db, proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found.")
    _require_proposal_access(db, current_user, proposal)
    proposal = service.update_proposal(db, proposal, body)
    return _fmt_proposal(proposal)


@router.post("/proposals/{proposal_id}/versions", status_code=201)
def add_version(
    proposal_id: int,
    body: ProposalVersionIn,
    current_user=Depends(require_any_permission("view-projects", "view-clients")),
    db: Session = Depends(get_db),
):
    proposal = repo.get_proposal_by_id(db, proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found.")
    _require_proposal_access(db, current_user, proposal)
    version = service.add_version(db, proposal, body, current_user.id)
    return {"id": version.id, "versionNumber": version.version_number}


# ————————— RFPs —————————

@router.get("/rfps")
def list_rfps(
    status: str = Query(""),
    page: int = Query(1),
    per_page: int = Query(25),
    current_user=Depends(require_any_permission("view-projects", "view-clients")),
    db: Session = Depends(get_db),
):
    q = repo.get_rfps_query(db, status=status)
    return paginate(
        q.order_by(Rfp.created_at.desc()),
        page,
        per_page,
        serializer=lambda r: {
            "id": r.id,
            "title": r.title,
            "clientId": r.client_id,
            "status": r.status,
            "deadline": r.deadline.isoformat() if r.deadline else None,
            "budgetRange": r.budget_range,
        },
    )


@router.post("/rfps", status_code=201)
def create_rfp(
    body: RfpCreateIn,
    current_user=Depends(require_any_permission("view-projects", "view-clients")),
    db: Session = Depends(get_db),
):
    rfp = service.create_rfp(db, body, current_user.id)
    return {"id": rfp.id, "title": rfp.title}
