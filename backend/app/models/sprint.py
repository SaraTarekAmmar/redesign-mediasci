from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.issue import sprint_issues


class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    board_id = Column(Integer, ForeignKey("boards.id"))
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    goal = Column(Text)
    notes = Column(Text)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(String(50), default="planning")
    completed_at = Column(DateTime)
    completed_by = Column(Integer, ForeignKey("users.id"))
    capacity_hours = Column(Integer)
    velocity = Column(Integer)
    acceptance_criteria = Column(Text)
    duration = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    board = relationship("Board", back_populates="sprints")
    project = relationship("Project", back_populates="sprints")
    completed_by_user = relationship("User", foreign_keys=[completed_by])
    issues = relationship("Issue", secondary=sprint_issues, back_populates="sprints")
    tasks = relationship("Task", back_populates="sprint")
    metrics = relationship("SprintMetric", back_populates="sprint", cascade="all, delete-orphan")


class SprintMetric(Base):
    __tablename__ = "sprint_metrics"
    id = Column(Integer, primary_key=True, autoincrement=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=False)
    date = Column(Date, nullable=False)
    remaining_points = Column(Integer, default=0)
    completed_points = Column(Integer, default=0)
    added_points = Column(Integer, default=0)
    scope_change = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    sprint = relationship("Sprint", back_populates="metrics")
