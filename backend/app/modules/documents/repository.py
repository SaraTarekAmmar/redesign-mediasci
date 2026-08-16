from typing import Optional
from sqlalchemy.orm import Session
from app.models.misc import ProjectDocument


def get_documents_query(db: Session, project_id: Optional[int] = None, category: Optional[str] = None):
    q = db.query(ProjectDocument)
    if project_id:
        q = q.filter(ProjectDocument.project_id == project_id)
    if category:
        q = q.filter(ProjectDocument.category == category)
    return q


def get_document_by_id(db: Session, doc_id: int) -> Optional[ProjectDocument]:
    return db.query(ProjectDocument).filter(ProjectDocument.id == doc_id).first()
