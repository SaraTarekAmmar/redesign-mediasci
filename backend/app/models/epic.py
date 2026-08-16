from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Epic(Base):
    __tablename__ = "epics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    goal = Column(Text)
    color = Column(String(50))
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(50), default="open")
    owner_id = Column(Integer, ForeignKey("users.id"))
    position = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    project = relationship("Project", back_populates="epics")
    owner = relationship("User", foreign_keys=[owner_id])
    issues = relationship("Issue", back_populates="epic")
    stories = relationship("Story", back_populates="epic")


class Story(Base):
    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    epic_id = Column(Integer, ForeignKey("epics.id"))
    title = Column(String(500), nullable=False)
    description = Column(Text)
    color = Column(String(50))
    status = Column(String(50), default="open")
    position = Column(Integer, default=0)
    priority = Column(String(50))
    start_date = Column(Date)
    end_date = Column(Date)
    duration = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    project = relationship("Project", back_populates="stories")
    epic = relationship("Epic", back_populates="stories")
    issues = relationship("Issue", back_populates="story")
