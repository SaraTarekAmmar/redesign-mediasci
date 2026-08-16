from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Numeric, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    company = Column(String(255))          # alias for bootstrap compatibility
    industry = Column(String(100))
    website = Column(String(500))
    email = Column(String(255))
    phone = Column(String(50))
    address = Column(Text)
    status = Column(String(50), default="active")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)
    contacts = relationship("ClientContact", back_populates="client", cascade="all, delete-orphan")
    requests = relationship("ClientRequest", back_populates="client", cascade="all, delete-orphan")
    rfps = relationship("Rfp", back_populates="client", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="client")


class ClientContact(Base):
    __tablename__ = "client_contacts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    role = Column(String(100))
    is_primary = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    client = relationship("Client", back_populates="contacts")


class ClientRequest(Base):
    __tablename__ = "client_requests"
    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))        # who submitted the request
    title = Column(String(500), nullable=False)
    description = Column(Text)
    type = Column(String(100))
    status = Column(String(50), default="pending")
    priority = Column(String(50), default="medium")
    estimated_hours = Column(Numeric(12, 2))
    estimated_cost = Column(Numeric(12, 2))
    due_date = Column(Date)
    attachments = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)
    client = relationship("Client", back_populates="requests")
    proposals = relationship("Proposal", back_populates="client_request", cascade="all, delete-orphan")
    submitted_by = relationship("User", foreign_keys=[user_id])
    project = relationship("Project", back_populates="client_request", uselist=False)


class Proposal(Base):
    __tablename__ = "proposals"
    id = Column(Integer, primary_key=True, autoincrement=True)
    client_request_id = Column(Integer, ForeignKey("client_requests.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    rfp_id = Column(Integer, ForeignKey("rfps.id"))
    title = Column(String(500), nullable=False)
    status = Column(String(50), default="draft")    # draft, sent, accepted, declined
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    versions = relationship("ProposalVersion", back_populates="proposal", cascade="all, delete-orphan")
    client_request = relationship("ClientRequest", back_populates="proposals")
    author = relationship("User", foreign_keys=[created_by])


class ProposalVersion(Base):
    __tablename__ = "proposal_versions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    version_number = Column(Integer, default=1)     # FIXED: was 'version', routers expected 'version_number'
    content = Column(Text)
    summary = Column(Text)
    estimated_hours = Column(Numeric(12, 2))
    estimated_cost = Column(Numeric(12, 2))
    file_path = Column(String(1000))
    changes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    proposal = relationship("Proposal", back_populates="versions")
    author = relationship("User", foreign_keys=[created_by])


class Rfp(Base):
    __tablename__ = "rfps"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False)
    content = Column(Text)
    client_id = Column(Integer, ForeignKey("clients.id"))
    status = Column(String(50), default="open")     # open, in_review, closed, awarded
    deadline = Column(DateTime)
    budget_range = Column(String(100))
    requirements = Column(Text)
    file_path = Column(String(1000))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    client = relationship("Client", back_populates="rfps")
    author = relationship("User", foreign_keys=[created_by])
