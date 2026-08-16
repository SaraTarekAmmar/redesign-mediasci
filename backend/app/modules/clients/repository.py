from typing import Optional
from sqlalchemy.orm import Session
from app.models.client import Client, ClientContact


def get_clients_query(db: Session, q: str = "", status: str = ""):
    query = db.query(Client).filter(Client.deleted_at.is_(None))
    if q:
        query = query.filter(Client.name.ilike(f"%{q}%"))
    if status:
        query = query.filter(Client.status == status)
    return query


def get_client_by_id(db: Session, client_id: int) -> Optional[Client]:
    return db.query(Client).filter(Client.id == client_id, Client.deleted_at.is_(None)).first()


def get_contact_by_id(db: Session, client_id: int, contact_id: int) -> Optional[ClientContact]:
    return db.query(ClientContact).filter(ClientContact.id == contact_id, ClientContact.client_id == client_id).first()
