from typing import Optional
from sqlalchemy.orm import Session, joinedload
from app.models.client import ClientRequest


def get_requests_query(db: Session, client_id: Optional[int] = None, status: str = ""):
    q = db.query(ClientRequest).filter(ClientRequest.deleted_at.is_(None))
    if client_id:
        q = q.filter(ClientRequest.client_id == client_id)
    if status:
        q = q.filter(ClientRequest.status == status)
    return q


def get_request_by_id(db: Session, req_id: int) -> Optional[ClientRequest]:
    return (
        db.query(ClientRequest)
        .options(joinedload(ClientRequest.client))
        .filter(ClientRequest.id == req_id)
        .first()
    )
