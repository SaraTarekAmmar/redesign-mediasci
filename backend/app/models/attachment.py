from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class IssueAttachment(Base):
    __tablename__ = "issue_attachments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500))
    path = Column(String(1000), nullable=False)
    mime_type = Column(String(255))
    size = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    issue = relationship("Issue", back_populates="attachments")
    user = relationship("User")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    attachable_type = Column(String(255))
    attachable_id = Column(Integer)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500))
    path = Column(String(1000), nullable=False)
    disk = Column(String(50), default="public")
    mime_type = Column(String(255))
    size = Column(Integer)
    metadata_json = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    user = relationship("User")


class AttachmentVersion(Base):
    __tablename__ = "attachment_versions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    attachment_id = Column(Integer, ForeignKey("attachments.id"), nullable=False)
    version = Column(Integer, default=1)
    path = Column(String(1000), nullable=False)
    size = Column(Integer)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ImageAnnotation(Base):
    __tablename__ = "image_annotations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    attachment_id = Column(Integer, ForeignKey("attachments.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    x = Column(Integer)
    y = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    comment = Column(Text)
    color = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
