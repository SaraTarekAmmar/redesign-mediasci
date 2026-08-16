from typing import Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.change_request import ChangeRequest

# Statuses that are no longer awaiting an approval decision.
RESOLVED_STATUSES = ("approved", "rejected", "implemented")


def get_change_requests_query(db: Session, project_id: Optional[int] = None, status: str = ""):
    q = db.query(ChangeRequest).filter(ChangeRequest.deleted_at.is_(None))
    if project_id:
        q = q.filter(ChangeRequest.project_id == project_id)
    if status:
        q = q.filter(ChangeRequest.status == status)
    return q


def get_my_change_requests_query(db: Session, user_id: int):
    """Change requests submitted by the given user."""
    return (
        db.query(ChangeRequest)
        .filter(
            ChangeRequest.deleted_at.is_(None),
            ChangeRequest.requested_by == user_id,
        )
    )


def get_pending_approvals_query(db: Session):
    """Change requests still awaiting an approval decision."""
    return (
        db.query(ChangeRequest)
        .filter(
            ChangeRequest.deleted_at.is_(None),
            func.lower(ChangeRequest.status).notin_(RESOLVED_STATUSES),
        )
    )


def get_cr_by_id(db: Session, cr_id: int) -> Optional[ChangeRequest]:
    return db.query(ChangeRequest).filter(ChangeRequest.id == cr_id).first()
