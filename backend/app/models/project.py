from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey, JSON, Table,
)
from sqlalchemy.orm import relationship
from app.database import Base

project_teams = Table(
    "project_teams", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE")),
    Column("team_id", Integer, ForeignKey("teams.id", ondelete="CASCADE")),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)

milestone_projects = Table(
    "milestone_projects", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("milestone_id", Integer, ForeignKey("milestones.id", ondelete="CASCADE")),
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE")),
)

stakeholder_project = Table(
    "stakeholder_project", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("stakeholder_id", Integer, ForeignKey("stakeholders.id", ondelete="CASCADE")),
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE")),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    company_name = Column(String(255))
    key = Column(String(50))
    description = Column(Text)
    avatar = Column(String(255))
    type = Column(String(50))
    classification = Column(String(50))
    presale_type = Column(String(50))
    status = Column(String(50), default="active")
    category = Column(String(100))
    color = Column(String(50), default="#4F46E5")
    owner_id = Column(Integer, ForeignKey("users.id"))
    team_id = Column(Integer, ForeignKey("teams.id"))
    start_date = Column(Date)
    end_date = Column(Date)
    settings = Column(JSON)
    notes = Column(Text)
    # Free-text contract terms, entered manually by a super-admin only (see the
    # require_roles("super-admin") guard on the update endpoint) — never auto-generated.
    contractual_terms = Column(Text)
    logo = Column(String(255))
    documents = Column(JSON)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    client_request_id = Column(Integer, ForeignKey("client_requests.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    # Relationships
    owner = relationship("User", back_populates="owned_projects", foreign_keys=[owner_id])
    team = relationship("Team", back_populates="projects", foreign_keys=[team_id])
    teams = relationship("Team", secondary=project_teams, back_populates="project_links")
    partners = relationship("Partner", secondary="project_partners", back_populates="projects")
    partner_teams = relationship("PartnerTeam", secondary="project_partner_teams", back_populates="projects")
    partner_members = relationship("PartnerMember", secondary="project_partner_members", back_populates="projects")
    members = relationship("User", secondary="project_members", back_populates="projects")
    issues = relationship("Issue", back_populates="project", cascade="all, delete-orphan")
    epics = relationship("Epic", back_populates="project", cascade="all, delete-orphan")
    stories = relationship("Story", back_populates="project", cascade="all, delete-orphan")
    boards = relationship("Board", back_populates="project", cascade="all, delete-orphan")
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")
    labels = relationship("IssueLabel", back_populates="project", cascade="all, delete-orphan")
    custom_fields = relationship("CustomField", back_populates="project", cascade="all, delete-orphan")
    statuses = relationship("IssueStatus", back_populates="project", cascade="all, delete-orphan")
    workflows = relationship("Workflow", back_populates="project", cascade="all, delete-orphan")
    automation_rules = relationship("AutomationRule", back_populates="project", cascade="all, delete-orphan")
    phases = relationship("ProjectPhase", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    milestones = relationship("Milestone", secondary=milestone_projects, back_populates="projects")
    stakeholders = relationship("Stakeholder", secondary=stakeholder_project, back_populates="projects")
    scope = relationship("Scope", back_populates="project", uselist=False)
    change_requests = relationship("ChangeRequest", back_populates="project", cascade="all, delete-orphan")
    setting = relationship("ProjectSetting", back_populates="project", uselist=False)
    expenses = relationship("Expense", back_populates="project", cascade="all, delete-orphan")
    cloud_services = relationship("CloudService", back_populates="project", cascade="all, delete-orphan")
    software_licenses = relationship("SoftwareLicense", back_populates="project", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="project", cascade="all, delete-orphan")
    validation_rules = relationship("ValidationRule", back_populates="project", cascade="all, delete-orphan")
    client = relationship("Client", back_populates="projects")
    client_request = relationship("ClientRequest", back_populates="project")
    planning_milestones = relationship("ProjectMilestone", back_populates="project", cascade="all, delete-orphan", order_by="ProjectMilestone.sort_order")
    planning_baseline = relationship("ProjectPlanningBaseline", back_populates="project", uselist=False, cascade="all, delete-orphan")
    slack_integration = relationship("SlackIntegration", back_populates="project", uselist=False)
    calendar_integration = relationship("CalendarIntegration", back_populates="project", uselist=False)
    figma_integration = relationship("FigmaIntegration", back_populates="project", uselist=False)
    jira_import = relationship("JiraImport", back_populates="project", uselist=False)

    def next_issue_key(self) -> str:
        from sqlalchemy.orm import object_session
        db = object_session(self)
        from app.models.issue import Issue
        count = db.query(Issue).filter(Issue.project_id == self.id).count() + 1
        return f"{self.key}-{count}"
