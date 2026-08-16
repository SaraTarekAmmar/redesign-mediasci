from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class ChangeRequest(Base):
    __tablename__ = "change_requests"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    justification = Column(Text)
    type = Column(String(50))
    impact = Column(Text)
    priority = Column(String(50))
    status = Column(String(50), default="Draft")
    requested_by = Column(Integer, ForeignKey("users.id"))
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime)
    implemented_by = Column(Integer, ForeignKey("users.id"))
    implemented_at = Column(DateTime)
    cost_impact = Column(Numeric(10, 2))
    schedule_impact_days = Column(Integer)
    extra_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    project = relationship("Project", back_populates="change_requests")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
    implementer = relationship("User", foreign_keys=[implemented_by])
    files = relationship("ChangeRequestFile", back_populates="change_request", cascade="all, delete-orphan")


class ChangeRequestFile(Base):
    __tablename__ = "change_request_files"
    id = Column(Integer, primary_key=True, autoincrement=True)
    change_request_id = Column(Integer, ForeignKey("change_requests.id"), nullable=False)
    name = Column(String(255))
    path = Column(String(1000))
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    change_request = relationship("ChangeRequest", back_populates="files")
