from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.client import Proposal, ProposalVersion, Rfp
from app.modules.proposals.schemas import ProposalCreateIn, ProposalVersionIn, RfpCreateIn


def create_proposal(
    db: Session,
    body: ProposalCreateIn,
    user_id: int,
    project_id: int | None = None,
) -> Proposal:
    proposal = Proposal(
        client_request_id=body.client_request_id,
        project_id=project_id,
        rfp_id=body.rfp_id,
        title=body.title,
        status=body.status,
        created_by=user_id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


def update_proposal(db: Session, proposal: Proposal, body: dict) -> Proposal:
    for field in ("title", "status"):
        if field in body:
            setattr(proposal, field, body[field])
    proposal.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(proposal)
    return proposal


def add_version(db: Session, proposal: Proposal, body: ProposalVersionIn, user_id: int) -> ProposalVersion:
    next_num = len(proposal.versions) + 1 if proposal.versions else 1
    version = ProposalVersion(
        proposal_id=proposal.id,
        version_number=next_num,
        content=body.content,
        summary=body.summary,
        estimated_hours=body.estimated_hours,
        estimated_cost=body.estimated_cost,
        changes=body.changes,
        created_by=user_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


def create_rfp(db: Session, body: RfpCreateIn, user_id: int) -> Rfp:
    rfp = Rfp(
        title=body.title,
        content=body.content,
        client_id=body.client_id,
        deadline=datetime.fromisoformat(body.deadline) if body.deadline else None,
        budget_range=body.budget_range,
        requirements=body.requirements,
        status=body.status,
        created_by=user_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(rfp)
    db.commit()
    db.refresh(rfp)
    return rfp
