import os
import uuid
from datetime import datetime, timezone
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app.models.misc import ProjectDocument
from app.config import get_settings


async def upload_document(db: Session, project_id: int, user_id: int, file: UploadFile, category: str = "general") -> ProjectDocument:
    settings = get_settings()
    upload_dir = os.path.join(settings.UPLOAD_DIR, "documents", str(project_id))
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "doc")[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(upload_dir, stored_name)

    content = await file.read()
    with open(stored_path, "wb") as f:
        f.write(content)

    doc = ProjectDocument(
        project_id=project_id,
        uploaded_by=user_id,
        name=file.filename,
        category=category,
        path=stored_path,
        size=len(content),
        mime_type=file.content_type,
        created_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def delete_document(db: Session, doc: ProjectDocument):
    if os.path.exists(doc.path):
        os.remove(doc.path)
    db.delete(doc)
    db.commit()
