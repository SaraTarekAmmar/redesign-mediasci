from typing import Optional
from sqlalchemy.orm import Session
from app.models.client import Proposal, Rfp


def get_proposals_query(db: Session, status: str = "", client_request_id: Optional[int] = None):
    q = db.query(Proposal)
    if status:
        q = q.filter(Proposal.status == status)
    if client_request_id:
        q = q.filter(Proposal.client_request_id == client_request_id)
    return q


def get_proposal_by_id(db: Session, proposal_id: int) -> Optional[Proposal]:
    return db.query(Proposal).filter(Proposal.id == proposal_id).first()


def get_rfps_query(db: Session, status: str = ""):
    q = db.query(Rfp)
    if status:
        q = q.filter(Rfp.status == status)
    return q
