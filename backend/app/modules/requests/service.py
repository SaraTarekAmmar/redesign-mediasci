from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.client import ClientRequest
from app.modules.requests.schemas import RequestCreateIn, RequestUpdateIn


def create_request(db: Session, body: RequestCreateIn, user_id: int) -> ClientRequest:
    req = ClientRequest(
        client_id=body.client_id,
        user_id=user_id,
        title=body.title,
        description=body.description,
        type=body.type,
        priority=body.priority,
        estimated_hours=body.estimated_hours,
        estimated_cost=body.estimated_cost,
        due_date=datetime.fromisoformat(body.due_date).date() if body.due_date else None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def update_request(db: Session, req: ClientRequest, body: RequestUpdateIn) -> ClientRequest:
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "due_date" and value:
            req.due_date = datetime.fromisoformat(value).date()
        elif hasattr(req, field):
            setattr(req, field, value)
    req.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    return req


def update_status(db: Session, req: ClientRequest, status: str) -> ClientRequest:
    req.status = status
    db.commit()
    return req


def delete_request(db: Session, req: ClientRequest):
    """Permanently remove a client request from the database."""
    db.delete(req)
    db.commit()
