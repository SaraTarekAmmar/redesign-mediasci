"""Documents router — project document uploads and versions."""
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.models.misc import ProjectDocument
from app.modules.documents import service, repository as repo
from app.modules.projects.access import filter_query_by_project_access

router = APIRouter(tags=["Documents"])


def _fmt(doc: ProjectDocument) -> dict:
    return {
        "id": doc.id,
        "projectId": doc.project_id,
        "name": doc.name,
        "category": doc.category,
        "path": doc.path,
        "size": doc.size,
        "mimeType": doc.mime_type,
        "uploadedById": doc.uploaded_by,
        "createdAt": doc.created_at.isoformat() if doc.created_at else None,
    }


@router.get("/documents")
def list_documents(
    project_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1),
    per_page: int = Query(25),
    current_user=Depends(require_permissions("view-documents")),
    db: Session = Depends(get_db),
):
    q = repo.get_documents_query(db, project_id=project_id, category=category)
    q = filter_query_by_project_access(
        q,
        ProjectDocument.project_id,
        current_user.id,
        _get_user_roles(current_user.id, db),
    )
    return paginate(q.order_by(ProjectDocument.created_at.desc()), page, per_page, serializer=_fmt)


@router.post("/documents", status_code=201)
async def upload_document(
    project_id: int,
    category: Optional[str] = Query("general"),
    file: UploadFile = File(...),
    current_user=Depends(require_permissions("manage-documents")),
    db: Session = Depends(get_db),
):
    doc = await service.upload_document(db, project_id, current_user.id, file, category)
    return _fmt(doc)


@router.delete("/documents/{doc_id}", response_model=MessageResponse)
def delete_document(
    doc_id: int,
    current_user=Depends(require_permissions("manage-documents")),
    db: Session = Depends(get_db),
):
    doc = repo.get_document_by_id(db, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found.")
    service.delete_document(db, doc)
    return MessageResponse(message="Document deleted.")
