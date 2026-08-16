"""Clients router — client CRUD and contacts."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions
from app.models.client import Client, ClientContact
from app.modules.clients.schemas import ClientCreateIn, ClientUpdateIn, ContactCreateIn
from app.modules.clients import service, repository as repo

router = APIRouter(tags=["Clients"])


def _fmt_client(c: Client) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "company": c.company or c.name,
        "industry": c.industry or "",
        "website": c.website or "",
        "email": c.email or "",
        "phone": c.phone or "",
        "address": c.address or "",
        "notes": c.notes or "",
        "status": c.status or "active",
        "contacts": [
            {
                "id": str(ct.id),
                "name": ct.name,
                "email": ct.email or "",
                "phone": ct.phone or "",
                "role": ct.role or "",
                "isPrimary": bool(ct.is_primary),
            }
            for ct in (c.contacts or [])
        ],
        "createdAt": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/clients")
def list_clients(
    q: str = Query(""),
    status: str = Query(""),
    current_user=Depends(require_permissions("view-clients")),
    db: Session = Depends(get_db),
):
    query = repo.get_clients_query(db, q=q, status=status)
    clients = query.order_by(Client.name).all()
    return [_fmt_client(c) for c in clients]


@router.post("/clients", status_code=201)
def create_client(body: ClientCreateIn, current_user=Depends(require_permissions("manage-clients")), db: Session = Depends(get_db)):
    client = service.create_client(db, body)
    return _fmt_client(client)


@router.get("/clients/{client_id}")
def get_client(client_id: int, current_user=Depends(require_permissions("view-clients")), db: Session = Depends(get_db)):
    client = repo.get_client_by_id(db, client_id)
    if not client:
        raise HTTPException(404, "Client not found.")
    contacts = [{"id": c.id, "name": c.name, "email": c.email, "phone": c.phone, "role": c.role, "isPrimary": bool(c.is_primary)} for c in client.contacts]
    return {**_fmt_client(client), "contacts": contacts}


@router.put("/clients/{client_id}")
def update_client(client_id: int, body: ClientUpdateIn, current_user=Depends(require_permissions("manage-clients")), db: Session = Depends(get_db)):
    client = repo.get_client_by_id(db, client_id)
    if not client:
        raise HTTPException(404, "Client not found.")
    client = service.update_client(db, client, body)
    return _fmt_client(client)


@router.delete("/clients/{client_id}", response_model=MessageResponse)
def delete_client(client_id: int, current_user=Depends(require_permissions("manage-clients")), db: Session = Depends(get_db)):
    client = repo.get_client_by_id(db, client_id)
    if not client:
        raise HTTPException(404, "Client not found.")
    service.delete_client(db, client)
    return MessageResponse(message="Client deleted.")


@router.post("/clients/{client_id}/contacts", status_code=201)
def add_contact(client_id: int, body: ContactCreateIn, current_user=Depends(require_permissions("manage-clients")), db: Session = Depends(get_db)):
    contact = service.add_contact(db, client_id, body)
    return {"id": contact.id, "name": contact.name, "email": contact.email}


@router.delete("/clients/{client_id}/contacts/{contact_id}", response_model=MessageResponse)
def remove_contact(client_id: int, contact_id: int, current_user=Depends(require_permissions("manage-clients")), db: Session = Depends(get_db)):
    contact = repo.get_contact_by_id(db, client_id, contact_id)
    if not contact:
        raise HTTPException(404, "Contact not found.")
    service.remove_contact(db, contact)
    return MessageResponse(message="Contact removed.")
