from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Scope(Base):
    __tablename__ = "scopes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(255))
    description = Column(Text)
    in_scope = Column(Text)
    out_of_scope = Column(Text)
    assumptions = Column(Text)
    constraints = Column(Text)
    acceptance_criteria = Column(Text)
    status = Column(String(50), default="draft")
    version = Column(Integer, default=1)
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="scope")
    objectives = relationship("ScopeObjective", back_populates="scope", cascade="all, delete-orphan")
    deliverables = relationship("ScopeDeliverable", back_populates="scope", cascade="all, delete-orphan")
    documents = relationship("ScopeDocument", back_populates="scope", cascade="all, delete-orphan")
    versions = relationship("ScopeVersion", back_populates="scope", cascade="all, delete-orphan")
    comments = relationship("ScopeComment", back_populates="scope", cascade="all, delete-orphan")


class ScopeObjective(Base):
    __tablename__ = "scope_objectives"
    id = Column(Integer, primary_key=True, autoincrement=True)
    scope_id = Column(Integer, ForeignKey("scopes.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    priority = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    scope = relationship("Scope", back_populates="objectives")


class ScopeDeliverable(Base):
    __tablename__ = "scope_deliverables"
    id = Column(Integer, primary_key=True, autoincrement=True)
    scope_id = Column(Integer, ForeignKey("scopes.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="pending")
    due_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    scope = relationship("Scope", back_populates="deliverables")


class ScopeDocument(Base):
    __tablename__ = "scope_documents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    scope_id = Column(Integer, ForeignKey("scopes.id"), nullable=False)
    name = Column(String(255))
    path = Column(String(1000))
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    scope = relationship("Scope", back_populates="documents")


class ScopeVersion(Base):
    __tablename__ = "scope_versions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    scope_id = Column(Integer, ForeignKey("scopes.id"), nullable=False)
    version = Column(Integer)
    snapshot = Column(JSON)
    changed_by = Column(Integer, ForeignKey("users.id"))
    change_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    scope = relationship("Scope", back_populates="versions")


class ScopeComment(Base):
    __tablename__ = "scope_comments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    scope_id = Column(Integer, ForeignKey("scopes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    body = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    scope = relationship("Scope", back_populates="comments")
