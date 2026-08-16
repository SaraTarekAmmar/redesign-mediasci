from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class RiskCategory(Base):
    __tablename__ = "risk_categories"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RiskImpact(Base):
    __tablename__ = "risk_impacts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    score = Column(Integer, default=1)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Risk(Base):
    __tablename__ = "risks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    created_by = Column(Integer, ForeignKey("users.id"))
    owner_user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    probability = Column(Integer, default=1)            # 1-5
    impact = Column(Integer, default=1)                 # 1-5
    risk_score = Column(Integer)                        # probability * impact
    severity = Column(String(50))                       # low, medium, high, critical
    status = Column(String(50), default="identified")   # identified, mitigated, accepted, closed
    owner = Column(String(255))
    response_plan = Column(Text)
    contingency_plan = Column(Text)
    due_date = Column(Date)
    closed_at = Column(DateTime)
    deleted_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reporter = relationship("User", foreign_keys=[created_by])
    owner_user = relationship("User", foreign_keys=[owner_user_id])
    mitigations = relationship("RiskMitigation", back_populates="risk", cascade="all, delete-orphan")

    @property
    def mitigation_plan(self) -> str | None:
        return self.response_plan


class RiskMitigation(Base):
    __tablename__ = "risk_mitigations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    risk_id = Column(Integer, ForeignKey("risks.id", ondelete="CASCADE"), nullable=False)
    action = Column(Text, nullable=False)
    status = Column(String(50), default="planned")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    target_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    risk = relationship("Risk", back_populates="mitigations")
    owner = relationship("User", foreign_keys=[owner_id])
