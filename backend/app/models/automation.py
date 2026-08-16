from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class AutomationRule(Base):
    __tablename__ = "automation_rules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger_type = Column(String(100))
    trigger_config = Column(JSON)
    action_type = Column(String(100))
    action_config = Column(JSON)
    conditions = Column(JSON)
    is_active = Column(Boolean, default=True)
    run_count = Column(Integer, default=0)
    last_run_at = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="automation_rules")
    logs = relationship("AutomationLog", back_populates="rule", cascade="all, delete-orphan")


class AutomationTrigger(Base):
    __tablename__ = "automation_triggers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_id = Column(Integer, ForeignKey("automation_rules.id"))
    type = Column(String(100))
    config = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AutomationAction(Base):
    __tablename__ = "automation_actions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_id = Column(Integer, ForeignKey("automation_rules.id"))
    type = Column(String(100))
    config = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AutomationLog(Base):
    __tablename__ = "automation_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_id = Column(Integer, ForeignKey("automation_rules.id"))
    trigger_data = Column(JSON)
    action_result = Column(JSON)
    status = Column(String(50))
    error_message = Column(Text)
    executed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    rule = relationship("AutomationRule", back_populates="logs")
