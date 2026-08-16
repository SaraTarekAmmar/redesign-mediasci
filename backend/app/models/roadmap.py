from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Numeric, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Plan(Base):
    __tablename__ = "plans"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="draft")
    type = Column(String(100))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"))
    owner_id = Column(Integer, ForeignKey("users.id"))
    start_date = Column(Date)
    end_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    tasks = relationship("PlanTask", back_populates="plan", cascade="all, delete-orphan")
    project = relationship("Project", foreign_keys=[project_id])


class PlanTask(Base):
    __tablename__ = "plan_tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    title = Column(String(500), nullable=False)
    description = Column(Text)
    assigned_to = Column(Integer, ForeignKey("users.id"))
    status = Column(String(50), default="pending")
    priority = Column(String(50))
    type = Column(String(50), default="task")
    is_milestone = Column(Integer, default=0)
    start_date = Column(Date)
    end_date = Column(Date)
    duration = Column(Integer)
    progress = Column(Integer, default=0)
    wbs_code = Column(String(50))
    parent_id = Column(Integer, ForeignKey("plan_tasks.id"))
    milestone_id = Column(Integer, ForeignKey("milestones.id"))
    sprint_id = Column(Integer, ForeignKey("sprints.id"))
    story_points = Column(Integer)
    depends_on = Column(Integer)
    actual_start = Column(Date)
    actual_end = Column(Date)
    cost = Column(Numeric(10, 2))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan = relationship("Plan", back_populates="tasks")
    project = relationship("Project")
    assignee = relationship("User", foreign_keys=[assigned_to])
    parent = relationship("PlanTask", remote_side=[id])
    comments = relationship("PlanTaskComment", back_populates="task", cascade="all, delete-orphan")
    attachments = relationship("PlanTaskAttachment", back_populates="task", cascade="all, delete-orphan")
    baselines = relationship("PlanTaskBaseline", back_populates="task", cascade="all, delete-orphan")
    resources = relationship("PlanTaskResource", back_populates="task", cascade="all, delete-orphan")


class PlanTaskComment(Base):
    __tablename__ = "plan_task_comments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_task_id = Column(Integer, ForeignKey("plan_tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    body = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    task = relationship("PlanTask", back_populates="comments")


class PlanTaskAttachment(Base):
    __tablename__ = "plan_task_attachments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_task_id = Column(Integer, ForeignKey("plan_tasks.id"), nullable=False)
    path = Column(String(1000))
    filename = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    task = relationship("PlanTask", back_populates="attachments")


class PlanTaskBaseline(Base):
    __tablename__ = "plan_task_baselines"
    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_task_id = Column(Integer, ForeignKey("plan_tasks.id"), nullable=False)
    baseline_start = Column(Date)
    baseline_end = Column(Date)
    baseline_cost = Column(Numeric(10, 2))
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    task = relationship("PlanTask", back_populates="baselines")


class PlanTaskResource(Base):
    __tablename__ = "plan_task_resources"
    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_task_id = Column(Integer, ForeignKey("plan_tasks.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"))
    allocation_pct = Column(Integer, default=100)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    task = relationship("PlanTask", back_populates="resources")


class PlanTaskDependency(Base):
    __tablename__ = "plan_task_dependencies"
    id = Column(Integer, primary_key=True, autoincrement=True)
    predecessor_id = Column(Integer, ForeignKey("plan_tasks.id"), nullable=False)
    successor_id = Column(Integer, ForeignKey("plan_tasks.id"), nullable=False)
    type = Column(String(10), default="FS")
    lag = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Milestone(Base):
    __tablename__ = "milestones"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    date = Column(Date)
    status = Column(String(50), default="pending")
    priority = Column(String(50))
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    projects = relationship("Project", secondary="milestone_projects", back_populates="milestones")


class Roadmap(Base):
    __tablename__ = "roadmaps"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255))
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Task(Base):
    """Gantt tasks (distinct from Issues and PlanTasks)"""
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    sprint_id = Column(Integer, ForeignKey("sprints.id"))
    title = Column(String(500), nullable=False)
    description = Column(Text)
    assigned_to = Column(Integer, ForeignKey("users.id"))
    status = Column(String(50), default="pending")
    priority = Column(String(50))
    start_date = Column(Date)
    end_date = Column(Date)
    duration = Column(Integer)
    progress = Column(Integer, default=0)
    wbs_code = Column(String(50))
    parent_id = Column(Integer, ForeignKey("tasks.id"))
    depends_on = Column(Integer)
    is_milestone = Column(Integer, default=0)
    cost = Column(Numeric(10, 2))
    actual_start = Column(Date)
    actual_end = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="tasks")
    sprint = relationship("Sprint", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assigned_to])
    parent = relationship("Task", remote_side=[id])
