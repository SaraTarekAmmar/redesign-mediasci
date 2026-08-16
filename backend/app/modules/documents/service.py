import os
import uuid
from datetime import datetime, timezone
from fastapi import UploadFile
from sqlalchemy.orm import Session
from app.models.misc import ProjectDocument
from app.config import get_settings


async def upload_document(db: Session, project_id: int | None, user_id: int, file: UploadFile, category: str = "general") -> ProjectDocument:
    settings = get_settings()
    # file_path is stored relative to UPLOAD_DIR with forward slashes — it doubles as the
    # /storage/{file_path} URL suffix (see the StaticFiles mount in main.py), so it must
    # never contain OS-specific separators (Windows os.path.join gives backslashes, which
    # break as a URL path).
    relative_dir = "/".join(["documents", str(project_id) if project_id else "org-wide"])
    ext = os.path.splitext(file.filename or "doc")[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    relative_path = f"{relative_dir}/{stored_name}"

    absolute_dir = os.path.join(settings.UPLOAD_DIR, *relative_dir.split("/"))
    os.makedirs(absolute_dir, exist_ok=True)
    content = await file.read()
    with open(os.path.join(absolute_dir, stored_name), "wb") as f:
        f.write(content)

    doc = ProjectDocument(
        project_id=project_id,
        uploaded_by=user_id,
        name=file.filename,
        original_name=file.filename,
        category=category,
        file_path=relative_path,
        file_size=len(content),
        mime_type=file.content_type,
        created_at=datetime.now(timezone.utc),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def delete_document(db: Session, doc: ProjectDocument):
    absolute_path = os.path.join(get_settings().UPLOAD_DIR, *doc.path.split("/"))
    if os.path.exists(absolute_path):
        os.remove(absolute_path)
    db.delete(doc)
    db.commit()
