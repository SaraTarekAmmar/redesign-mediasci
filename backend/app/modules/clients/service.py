from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.client import Client, ClientContact
from app.models.project import Project
from app.modules.clients.schemas import ClientCreateIn, ClientUpdateIn, ContactCreateIn


def create_client(db: Session, body: ClientCreateIn) -> Client:
    client = Client(**body.model_dump(), created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc))
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def update_client(db: Session, client: Client, body: ClientUpdateIn) -> Client:
    for field, value in body.model_dump(exclude_unset=True).items():
        if hasattr(client, field):
            setattr(client, field, value)
    client.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(client)
    return client


def delete_client(db: Session, client: Client):
    project_count = (
        db.query(Project)
        .filter(Project.client_id == client.id)
        .count()
    )
    if project_count:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this client because one or more projects still belong to it.",
        )
    db.delete(client)
    db.commit()


def add_contact(db: Session, client_id: int, body: ContactCreateIn) -> ClientContact:
    contact = ClientContact(
        client_id=client_id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        role=body.role,
        is_primary=int(body.is_primary),
        created_at=datetime.now(timezone.utc),
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def remove_contact(db: Session, contact: ClientContact):
    db.delete(contact)
    db.commit()
