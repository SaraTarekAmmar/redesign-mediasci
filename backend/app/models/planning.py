from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class ProjectPlanningBaseline(Base):
    __tablename__ = "project_planning_baselines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    planned_duration_days = Column(Integer, default=0)
    planned_budget = Column(Numeric(12, 2), default=0)
    planned_hours = Column(Numeric(10, 2), default=0)
    planned_resources_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="planning_baseline")


class ProjectMilestone(Base):
    __tablename__ = "project_milestones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    planned_start_date = Column(Date)
    planned_end_date = Column(Date)
    actual_start_date = Column(Date)
    actual_end_date = Column(Date)
    planned_hours = Column(Numeric(10, 2), default=0)
    planned_budget = Column(Numeric(12, 2), default=0)
    planned_progress = Column(Numeric(5, 2), default=0)
    status = Column(String(50), default="pending")
    owner_resource_id = Column(Integer, ForeignKey("resources.id", ondelete="SET NULL"), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="planning_milestones")
    owner_resource = relationship("Resource")
    issues = relationship("Issue", back_populates="milestone")
    deliverables = relationship(
        "ProjectDeliverable",
        back_populates="milestone",
        cascade="all, delete-orphan",
        order_by="ProjectDeliverable.id",
    )
    outgoing_dependencies = relationship(
        "ProjectMilestoneDependency",
        foreign_keys="ProjectMilestoneDependency.predecessor_milestone_id",
        back_populates="predecessor_milestone",
        cascade="all, delete-orphan",
    )
    incoming_dependencies = relationship(
        "ProjectMilestoneDependency",
        foreign_keys="ProjectMilestoneDependency.successor_milestone_id",
        back_populates="successor_milestone",
        cascade="all, delete-orphan",
    )


class ProjectDeliverable(Base):
    __tablename__ = "project_deliverables"

    id = Column(Integer, primary_key=True, autoincrement=True)
    milestone_id = Column(Integer, ForeignKey("project_milestones.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    acceptance_criteria = Column(Text)
    planned_completion_date = Column(Date)
    actual_completion_date = Column(Date)
    status = Column(String(50), default="pending")
    owner_resource_id = Column(Integer, ForeignKey("resources.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    milestone = relationship("ProjectMilestone", back_populates="deliverables")
    owner_resource = relationship("Resource")
    issues = relationship("Issue", back_populates="deliverable")


class ProjectMilestoneDependency(Base):
    __tablename__ = "project_milestone_dependencies"
    __table_args__ = (
        UniqueConstraint("predecessor_milestone_id", "successor_milestone_id", name="uq_project_milestone_dependencies_pair"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    predecessor_milestone_id = Column(Integer, ForeignKey("project_milestones.id", ondelete="CASCADE"), nullable=False)
    successor_milestone_id = Column(Integer, ForeignKey("project_milestones.id", ondelete="CASCADE"), nullable=False)
    dependency_type = Column(String(50), default="finish_to_start", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    predecessor_milestone = relationship(
        "ProjectMilestone",
        foreign_keys=[predecessor_milestone_id],
        back_populates="outgoing_dependencies",
    )
    successor_milestone = relationship(
        "ProjectMilestone",
        foreign_keys=[successor_milestone_id],
        back_populates="incoming_dependencies",
    )
