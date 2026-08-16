from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey, JSON, Table, Numeric,
)

from sqlalchemy.orm import relationship
from app.database import Base

sprint_issues = Table(
    "sprint_issues", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("sprint_id", Integer, ForeignKey("sprints.id", ondelete="CASCADE")),
    Column("issue_id", Integer, ForeignKey("issues.id", ondelete="CASCADE")),
    Column("position", Integer, default=0),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)

issue_label = Table(
    "issue_label", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("issue_id", Integer, ForeignKey("issues.id", ondelete="CASCADE")),
    Column("issue_label_id", Integer, ForeignKey("issue_labels.id", ondelete="CASCADE")),
)

issue_watchers = Table(
    "issue_watchers", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("issue_id", Integer, ForeignKey("issues.id", ondelete="CASCADE")),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE")),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)

task_assignees = Table(
    "task_assignees", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("issue_id", Integer, ForeignKey("issues.id", ondelete="CASCADE")),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE")),
    Column("assigned_by", Integer),
    Column("assigned_at", DateTime),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)


class IssueType(Base):
    __tablename__ = "issue_types"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    icon = Column(String(50))
    color = Column(String(50))
    is_subtask = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    issues = relationship("Issue", back_populates="type")


class IssueStatus(Base):
    __tablename__ = "issue_statuses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(255), nullable=False)
    category = Column(String(50), default="todo")
    color = Column(String(50))
    position = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="statuses")
    issues = relationship("Issue", back_populates="status")


class IssuePriority(Base):
    __tablename__ = "issue_priorities"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    icon = Column(String(50))
    color = Column(String(50))
    level = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    issues = relationship("Issue", back_populates="priority")

    @property
    def weight(self) -> int:
        return self.level or 0


class IssueLabel(Base):
    __tablename__ = "issue_labels"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(255), nullable=False)
    color = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="labels")
    issues = relationship("Issue", secondary=issue_label, back_populates="labels")


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    issue_type_id = Column(Integer, ForeignKey("issue_types.id"))
    issue_status_id = Column(Integer, ForeignKey("issue_statuses.id"))
    issue_priority_id = Column(Integer, ForeignKey("issue_priorities.id"))
    assignee_id = Column(Integer, ForeignKey("users.id"))
    # External workforce: a partner member assigned to this task (mutually exclusive with assignee_id in practice)
    external_assignee_id = Column(Integer, ForeignKey("partner_members.id", ondelete="SET NULL"), nullable=True)
    reporter_id = Column(Integer, ForeignKey("users.id"))
    epic_id = Column(Integer, ForeignKey("epics.id"))
    story_id = Column(Integer, ForeignKey("stories.id"))
    parent_id = Column(Integer, ForeignKey("issues.id"))
    milestone_id = Column(Integer, ForeignKey("project_milestones.id", ondelete="SET NULL"), nullable=True)
    deliverable_id = Column(Integer, ForeignKey("project_deliverables.id", ondelete="SET NULL"), nullable=True)
    story_points = Column(Integer)
    estimate_minutes = Column(Integer)
    remaining_minutes = Column(Integer)
    # ponytail: legacy rows carry midnight timestamps here, so DateTime keeps bootstrap and detail views aligned.
    due_date = Column(DateTime)
    start_date = Column(DateTime)
    position = Column(Integer, default=0)
    acceptance_criteria = Column(Text)
    definition_of_ready = Column(Text)
    definition_of_done = Column(Text)
    estimated_hours = Column(Numeric(10, 2))
    actual_hours = Column(Numeric(10, 2))
    remaining_hours = Column(Numeric(10, 2))
    completion_percentage = Column(Integer, default=0)

    # AI Preparation Fields (Nullable)
    ai_estimated_hours = Column(Numeric(10, 2))
    ai_priority = Column(String(50))
    ai_risk = Column(String(50))
    ai_suggested_resource_id = Column(Integer, ForeignKey("users.id"))
    ai_similar_tasks = Column(JSON)
    ai_confidence_score = Column(Numeric(5, 2))

    custom_fields = Column(JSON)
    reported_to = Column(JSON)
    color = Column(String(50))
    triage_status = Column(String(50))
    triage_notes = Column(Text)
    triaged_by = Column(Integer, ForeignKey("users.id"))
    triaged_at = Column(DateTime)
    triage_previous_issue_status_id = Column(Integer)
    triage_previous_triage_status = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    # Relationships
    project = relationship("Project", back_populates="issues")
    type = relationship("IssueType", back_populates="issues")
    status = relationship("IssueStatus", back_populates="issues")
    priority = relationship("IssuePriority", back_populates="issues")
    assignee = relationship("User", back_populates="assigned_issues", foreign_keys=[assignee_id])
    external_assignee = relationship("PartnerMember", foreign_keys=[external_assignee_id])
    reporter = relationship("User", back_populates="reported_issues", foreign_keys=[reporter_id])
    epic = relationship("Epic", back_populates="issues")
    story = relationship("Story", back_populates="issues")
    parent = relationship("Issue", remote_side=[id], back_populates="children")
    children = relationship("Issue", back_populates="parent")
    milestone = relationship("ProjectMilestone", back_populates="issues")
    deliverable = relationship("ProjectDeliverable", back_populates="issues")
    labels = relationship("IssueLabel", secondary=issue_label, back_populates="issues")
    watchers = relationship("User", secondary=issue_watchers)
    assignees = relationship("User", secondary=task_assignees)
    comments = relationship("IssueComment", back_populates="issue", cascade="all, delete-orphan")
    attachments = relationship("IssueAttachment", back_populates="issue", cascade="all, delete-orphan")
    history = relationship("IssueHistory", back_populates="issue", cascade="all, delete-orphan")
    time_logs = relationship("TimeLog", back_populates="issue", cascade="all, delete-orphan")
    checklists = relationship("TaskChecklist", back_populates="issue", cascade="all, delete-orphan")
    activities = relationship("TaskActivity", back_populates="issue", cascade="all, delete-orphan")
    sprints = relationship("Sprint", secondary=sprint_issues, back_populates="issues")
    dependencies = relationship("TaskDependency", back_populates="issue", foreign_keys="TaskDependency.issue_id")
    blockers = relationship("TaskDependency", foreign_keys="TaskDependency.depends_on_id", overlaps="depends_on")
    custom_field_values = relationship("IssueCustomFieldValue", back_populates="issue", cascade="all, delete-orphan")
    triaged_by_user = relationship("User", foreign_keys=[triaged_by])
    ai_suggested_resource = relationship("User", foreign_keys=[ai_suggested_resource_id])




    chat = relationship(
        "Chat",
        primaryjoin="and_(foreign(Chat.chatable_id) == Issue.id, Chat.chatable_type == 'App\\\\Models\\\\Issue')",
        uselist=False,
        viewonly=True,
    )

    @property
    def key(self) -> str:
        project_key = self.project.key if self.project else "TF"
        return f"{project_key}-{self.id}"

    @property
    def logged_minutes(self) -> int:
        return sum(tl.duration_minutes or 0 for tl in self.time_logs)

    @property
    def progress(self) -> int:
        if self.children:
            total = len(self.children)
            if total > 0:
                done = sum(1 for c in self.children if c.status and c.status.category == "done")
                return round(done / total * 100)
        cat = self.status.category if self.status else "todo"
        return {"done": 100, "in_progress": 50, "review": 75}.get(cat, 0)

    @property
    def resolved_color(self) -> str:
        if self.color:
            return self.color
        if self.story and self.story.color:
            return self.story.color
        if self.epic and self.epic.color:
            return self.epic.color
        return self.type.color if self.type else "#666"


class IssueHistory(Base):
    __tablename__ = "issue_histories"
    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))
    field = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    action = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    issue = relationship("Issue", back_populates="history")


class IssueLink(Base):
    __tablename__ = "issue_links"
    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id"))
    linked_issue_id = Column(Integer, ForeignKey("issues.id"))
    link_type = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    depends_on_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    type = Column(String(50), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    issue = relationship("Issue", foreign_keys=[issue_id], back_populates="dependencies")
    depends_on = relationship("Issue", foreign_keys=[depends_on_id], overlaps="blockers")
