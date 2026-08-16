from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class SlackIntegration(Base):
    __tablename__ = "slack_integrations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    webhook_url = Column(String(500))
    channel = Column(String(100))
    is_active = Column(Integer, default=1)
    events = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="slack_integration")


class CalendarIntegration(Base):
    __tablename__ = "calendar_integrations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    provider = Column(String(50))
    calendar_id = Column(String(255))
    access_token = Column(Text)
    refresh_token = Column(Text)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="calendar_integration")


class FigmaIntegration(Base):
    __tablename__ = "figma_integrations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    file_key = Column(String(255))
    file_name = Column(String(255))
    access_token = Column(Text)
    is_active = Column(Integer, default=1)
    last_synced_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="figma_integration")


class GithubIntegration(Base):
    __tablename__ = "github_integrations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    repo_owner = Column(String(255))
    repo_name = Column(String(255))
    access_token = Column(Text)
    webhook_secret = Column(String(255))
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GithubLink(Base):
    __tablename__ = "github_links"
    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id"))
    github_integration_id = Column(Integer, ForeignKey("github_integrations.id"))
    pr_number = Column(Integer)
    pr_url = Column(String(500))
    pr_title = Column(String(500))
    pr_state = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class JiraImport(Base):
    __tablename__ = "jira_imports"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    jira_url = Column(String(500))
    jira_project_key = Column(String(50))
    api_token = Column(Text)
    email = Column(String(255))
    status = Column(String(50))
    imported_count = Column(Integer, default=0)
    last_synced_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project = relationship("Project", back_populates="jira_import")
