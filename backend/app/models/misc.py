from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, JSON, Numeric
from sqlalchemy.orm import relationship
from app.database import Base


class AdminTask(Base):
    __tablename__ = "admin_tasks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    priority = Column(String(50))
    status = Column(String(50), default="pending")
    assigned_to = Column(Integer, ForeignKey("users.id"))
    due_date = Column(Date)
    completed_at = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CustomField(Base):
    __tablename__ = "custom_fields"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    options = Column(JSON)
    is_required = Column(Integer, default=0)
    position = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="custom_fields")


class IssueCustomFieldValue(Base):
    __tablename__ = "issue_custom_field_values"
    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    custom_field_id = Column(Integer, ForeignKey("custom_fields.id"), nullable=False)
    value = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    issue = relationship("Issue", back_populates="custom_field_values")
    field = relationship("CustomField")


class ProjectSetting(Base):
    __tablename__ = "project_settings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    working_days = Column(JSON)
    working_hours_per_day = Column(Integer, default=8)
    sprint_duration_weeks = Column(Integer, default=2)
    default_priority = Column(String(50))
    auto_assign = Column(Integer, default=0)
    budget_baseline = Column(Numeric(12, 2))
    risk_threshold = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="setting")


class ProjectPhase(Base):
    __tablename__ = "project_phases"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(50), default="pending")
    position = Column(Integer, default=0)
    color = Column(String(50))
    progress = Column(Integer, default=0)
    deliverables = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="phases")


class ProjectDocument(Base):
    __tablename__ = "project_documents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    documentable_type = Column(String(255))
    documentable_id = Column(Integer)
    name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_path = Column(String(255), nullable=False)
    mime_type = Column(String(255))
    file_size = Column(Integer, default=0)
    category = Column(String(100))
    visibility = Column(String(255), default="project")
    deleted_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def path(self) -> str:
        return self.file_path

    @property
    def size(self) -> int:
        return self.file_size


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("project_documents.id"), nullable=False)
    version = Column(Integer, default=1)
    path = Column(String(1000), nullable=False)
    size = Column(Integer)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    changes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_log"
    id = Column(Integer, primary_key=True, autoincrement=True)
    log_name = Column(String(255))
    description = Column(Text)
    subject_type = Column(String(255))
    subject_id = Column(Integer)
    causer_type = Column(String(255))
    causer_id = Column(Integer)
    properties = Column(JSON)
    event = Column(String(100))
    batch_uuid = Column(String(36))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(100))
    entity_type = Column(String(100))
    entity_id = Column(Integer)
    old_values = Column(JSON)
    new_values = Column(JSON)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Skill model is defined in app.models.resource



class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    start = Column(DateTime)
    end = Column(DateTime)
    all_day = Column(Integer, default=0)
    color = Column(String(50))
    project_id = Column(Integer, ForeignKey("projects.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String(50))
    recurrence = Column(String(100))
    location = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AiRecommendation(Base):
    __tablename__ = "ai_recommendations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(100))                          # smart_assign, resource_recommend, etc.
    # Polymorphic subject (what entity the recommendation is about)
    subject_type = Column(String(255))                  # e.g. "Issue", "Project"
    subject_id = Column(Integer)
    # Legacy flat fields (kept for backward compat)
    entity_type = Column(String(100))
    entity_id = Column(Integer)
    # Structured payload fields
    input_data = Column(JSON)                           # the context sent to AI
    suggestion_data = Column(JSON)                      # the AI response payload
    recommendation = Column(Text)                       # human-readable summary
    confidence = Column(Numeric(5, 2))
    status = Column(String(50), default="pending")      # pending, accepted, overridden, dismissed
    decided_by = Column(Integer, ForeignKey("users.id"))
    decided_at = Column(DateTime)
    override_reason = Column(Text)                      # why human overrode the recommendation
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    decider = relationship("User", foreign_keys=[decided_by])


class ValidationRule(Base):
    __tablename__ = "validation_rules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    rule_type = Column(String(100), nullable=False)
    parameters = Column(Text)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="validation_rules")

    @property
    def type(self) -> str:
        return self.rule_type

    @property
    def status(self) -> str:
        return "active" if self.is_active else "inactive"


class ValidationResult(Base):
    __tablename__ = "validation_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_id = Column(Integer, ForeignKey("validation_rules.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    passed = Column(Integer)
    details = Column(JSON)
    verified_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExecutiveSnapshot(Base):
    __tablename__ = "executive_snapshots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    data = Column(JSON)
    period = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserWorkload(Base):
    __tablename__ = "user_workloads"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    week_start = Column(Date)
    allocated_hours = Column(Numeric(6, 1))
    actual_hours = Column(Numeric(6, 1))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
