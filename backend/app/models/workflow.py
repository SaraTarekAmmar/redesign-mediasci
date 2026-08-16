from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Workflow(Base):
    __tablename__ = "workflows"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"))
    issue_type_id = Column(Integer, ForeignKey("issue_types.id"))
    is_default = Column(Boolean, default=False)
    workflow_template_id = Column(Integer, ForeignKey("workflow_templates.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="workflows")
    issue_type = relationship("IssueType")
    template = relationship("WorkflowTemplate", back_populates="workflows")
    statuses = relationship("WorkflowStatus", back_populates="workflow", cascade="all, delete-orphan")
    transitions = relationship("WorkflowTransition", back_populates="workflow", cascade="all, delete-orphan")


class WorkflowStatus(Base):
    __tablename__ = "workflow_statuses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    issue_status_id = Column(Integer, ForeignKey("issue_statuses.id"))
    position = Column(Integer, default=0)
    is_initial = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    workflow = relationship("Workflow", back_populates="statuses")
    status = relationship("IssueStatus")


class WorkflowTransition(Base):
    __tablename__ = "workflow_transitions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    name = Column(String(255))
    from_status_id = Column(Integer, ForeignKey("issue_statuses.id"))
    to_status_id = Column(Integer, ForeignKey("issue_statuses.id"))
    conditions = Column(JSON)
    post_functions = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    workflow = relationship("Workflow", back_populates="transitions")
    from_status = relationship("IssueStatus", foreign_keys=[from_status_id])
    to_status = relationship("IssueStatus", foreign_keys=[to_status_id])


class WorkflowCondition(Base):
    __tablename__ = "workflow_conditions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    transition_id = Column(Integer, ForeignKey("workflow_transitions.id"))
    type = Column(String(100))
    config = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkflowPostAction(Base):
    __tablename__ = "workflow_post_actions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    transition_id = Column(Integer, ForeignKey("workflow_transitions.id"))
    type = Column(String(100))
    config = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_global = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    workflows = relationship("Workflow", back_populates="template")
    steps = relationship("WorkflowStep", back_populates="template", cascade="all, delete-orphan")


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_template_id = Column(Integer, ForeignKey("workflow_templates.id"), nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(50))
    color = Column(String(50))
    position = Column(Integer, default=0)
    is_initial = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    template = relationship("WorkflowTemplate", back_populates="steps")


class WorkflowStage(Base):
    __tablename__ = "workflow_stages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)
    category = Column(String(50), default="todo")
    color = Column(String(50), default="#6366F1")
    position = Column(Integer, default=0)
    wip_limit = Column(Integer, nullable=True)
    is_initial = Column(Boolean, default=False)
    is_final = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project")

