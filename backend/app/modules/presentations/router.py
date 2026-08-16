"""Presentation Bank — a reusable, org-wide library of decks, distinct from per-project
Documents and from the structured Proposal Bank. Deliberately thin: it's the same
ProjectDocument model, filtered to category="presentation:*", with project_id optional
(most presentations aren't tied to one project — that's the point, they get reused)."""
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.models.misc import ProjectDocument
from app.modules.documents import service as documents_service
from app.modules.documents.repository import get_document_by_id
from app.modules.projects.access import accessible_project_ids_query, is_system_admin

router = APIRouter(tags=["Presentations"])

CATEGORY_PREFIX = "presentation:"
PRESENTATION_CATEGORIES = [
    "company-overview",
    "case-study",
    "sales-deck",
    "kickoff-deck",
    "capability-deck",
    "qbr",
]


def _fmt(doc: ProjectDocument) -> dict:
    return {
        "id": doc.id,
        "projectId": doc.project_id,
        "name": doc.name,
        "category": (doc.category or "").removeprefix(CATEGORY_PREFIX),
        "path": doc.path,
        "size": doc.size,
        "mimeType": doc.mime_type,
        "uploadedById": doc.uploaded_by,
        "createdAt": doc.created_at.isoformat() if doc.created_at else None,
    }


@router.get("/presentations")
def list_presentations(
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    current_user=Depends(require_permissions("view-documents")),
    db: Session = Depends(get_db),
):
    query = db.query(ProjectDocument).filter(ProjectDocument.category.like(f"{CATEGORY_PREFIX}%"))
    if category:
        query = query.filter(ProjectDocument.category == f"{CATEGORY_PREFIX}{category}")
    if q:
        query = query.filter(ProjectDocument.name.ilike(f"%{q}%"))

    role_names = _get_user_roles(current_user.id, db)
    if not is_system_admin(role_names):
        # Org-wide decks (no project) are visible to anyone who can view documents;
        # project-tied ones still respect normal project access.
        query = query.filter(
            or_(
                ProjectDocument.project_id.is_(None),
                ProjectDocument.project_id.in_(accessible_project_ids_query(current_user.id)),
            )
        )
    return [_fmt(doc) for doc in query.order_by(ProjectDocument.created_at.desc()).all()]


@router.get("/presentations/categories")
def list_presentation_categories(current_user=Depends(get_current_user)):
    return PRESENTATION_CATEGORIES


@router.post("/presentations", status_code=201)
async def upload_presentation(
    category: str = Query(...),
    project_id: Optional[int] = Query(None),
    file: UploadFile = File(...),
    current_user=Depends(require_permissions("manage-documents")),
    db: Session = Depends(get_db),
):
    if category not in PRESENTATION_CATEGORIES:
        raise HTTPException(400, f"Unknown category. Use one of: {', '.join(PRESENTATION_CATEGORIES)}")
    doc = await documents_service.upload_document(
        db, project_id, current_user.id, file, f"{CATEGORY_PREFIX}{category}"
    )
    return _fmt(doc)


@router.delete("/presentations/{doc_id}", response_model=MessageResponse)
def delete_presentation(
    doc_id: int,
    current_user=Depends(require_permissions("manage-documents")),
    db: Session = Depends(get_db),
):
    doc = get_document_by_id(db, doc_id)
    if not doc or not (doc.category or "").startswith(CATEGORY_PREFIX):
        raise HTTPException(404, "Presentation not found.")
    documents_service.delete_document(db, doc)
    return MessageResponse(message="Presentation deleted.")
