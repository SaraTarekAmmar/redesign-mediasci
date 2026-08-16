from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.change_request import ChangeRequest
from app.modules.change_requests.schemas import CRCreateIn, CRUpdateIn


def create_cr(db: Session, body: CRCreateIn, user_id: int) -> ChangeRequest:
    cr = ChangeRequest(
        project_id=body.project_id,
        title=body.title,
        description=body.description,
        type=body.type,
        impact=body.impact,
        justification=body.justification,
        cost_impact=body.estimated_cost,
        requested_by=user_id,
        status="Draft",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(cr)
    db.commit()
    db.refresh(cr)
    return cr


def update_cr(db: Session, cr: ChangeRequest, body: CRUpdateIn) -> ChangeRequest:
    for field, value in body.model_dump(exclude_unset=True).items():
        if hasattr(cr, field):
            setattr(cr, field, value)
    cr.updated_at = datetime.now(timezone.utc)
    db.commit()
    return cr


def approve_cr(db: Session, cr: ChangeRequest, reviewer_id: int) -> ChangeRequest:
    cr.status = "Approved"
    cr.approved_by = reviewer_id
    cr.approved_at = datetime.now(timezone.utc)
    cr.updated_at = datetime.now(timezone.utc)
    db.commit()
    return cr


def reject_cr(db: Session, cr: ChangeRequest, reviewer_id: int, reason: str = None) -> ChangeRequest:
    cr.status = "Rejected"
    cr.approved_by = reviewer_id
    cr.extra_notes = reason
    cr.updated_at = datetime.now(timezone.utc)
    db.commit()
    return cr


def delete_cr(db: Session, cr: ChangeRequest):
    cr.deleted_at = datetime.now(timezone.utc)
    db.commit()

