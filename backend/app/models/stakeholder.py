from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Numeric, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Stakeholder(Base):
    __tablename__ = "stakeholders"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    organization = Column(String(255))
    role = Column(String(100))
    department = Column(String(100))
    influence_level = Column(String(50))
    interest_level = Column(String(50))
    support_level = Column(String(50))
    communication_preference = Column(String(100))
    status = Column(String(50), default="Active")
    notes = Column(Text)
    photo = Column(String(255))
    type = Column(String(50), default="External")
    category = Column(String(100))
    preferred_contact_frequency = Column(Integer, default=7)
    last_interaction_at = Column(DateTime)
    engagement_score = Column(Numeric(5, 2))
    avg_response_time = Column(Numeric(5, 2), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    projects = relationship("Project", secondary="stakeholder_project", back_populates="stakeholders")
    engagements = relationship("StakeholderEngagement", back_populates="stakeholder", cascade="all, delete-orphan")
    impacts = relationship("StakeholderImpact", back_populates="stakeholder", cascade="all, delete-orphan")
    interactions = relationship("StakeholderInteraction", back_populates="stakeholder", cascade="all, delete-orphan")
    messages = relationship("StakeholderMessage", back_populates="stakeholder", cascade="all, delete-orphan")

    @property
    def avatar(self) -> str | None:
        return self.photo


class StakeholderEngagement(Base):
    __tablename__ = "stakeholder_engagements"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stakeholder_id = Column(Integer, ForeignKey("stakeholders.id"), nullable=False)
    type = Column(String(100))
    description = Column(Text)
    outcome = Column(Text)
    date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    stakeholder = relationship("Stakeholder", back_populates="engagements")


class StakeholderImpact(Base):
    __tablename__ = "stakeholder_impacts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stakeholder_id = Column(Integer, ForeignKey("stakeholders.id"), nullable=False)
    area = Column(String(100))
    level = Column(String(50))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    stakeholder = relationship("Stakeholder", back_populates="impacts")


class StakeholderInteraction(Base):
    __tablename__ = "stakeholder_interactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stakeholder_id = Column(Integer, ForeignKey("stakeholders.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String(100))
    subject = Column(String(255))
    notes = Column(Text)
    outcome = Column(Text)
    interaction_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    stakeholder = relationship("Stakeholder", back_populates="interactions")


class StakeholderMessage(Base):
    __tablename__ = "stakeholder_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    stakeholder_id = Column(Integer, ForeignKey("stakeholders.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    subject = Column(String(255))
    body = Column(Text)
    channel = Column(String(50))
    status = Column(String(50))
    sent_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    stakeholder = relationship("Stakeholder", back_populates="messages")
