from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey, Numeric, Float, JSON, Table
)
from sqlalchemy.orm import relationship
from app.database import Base


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    category = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resources = relationship("ResourceSkill", back_populates="skill", cascade="all, delete-orphan")
    users = relationship("User", secondary="skill_user", back_populates="skills")



class ResourceSkill(Base):
    __tablename__ = "resource_skills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    proficiency = Column(String(50), default="mid")
    years_of_experience = Column(Float, default=1.0)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resource = relationship("Resource", back_populates="resource_skills")
    skill = relationship("Skill", back_populates="resources")


class Certification(Base):
    __tablename__ = "certifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    provider = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resources = relationship("ResourceCertification", back_populates="certification", cascade="all, delete-orphan")


class ResourceCertification(Base):
    __tablename__ = "resource_certifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    certification_id = Column(Integer, ForeignKey("certifications.id", ondelete="CASCADE"), nullable=False)
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    credential_id = Column(String(100), nullable=True)
    url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resource = relationship("Resource", back_populates="resource_certifications")
    certification = relationship("Certification", back_populates="resources")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    employee_number = Column(String(50))
    department_id = Column(Integer, ForeignKey("departments.id"))
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    role = Column(String(100))
    position = Column(String(100), default="Team Member")
    seniority = Column(String(50), default="mid")
    salary = Column(Numeric(12, 2), default=0)
    currency = Column(String(10), default="USD")
    cost_per_hour = Column(Numeric(10, 2), default=0)
    weekly_capacity = Column(Numeric(10, 2), default=40)
    daily_capacity_hours = Column(Numeric(10, 2), default=8)
    availability_status = Column(String(50), default="available")
    availability_start = Column(Date)
    availability_end = Column(Date)
    availability_pct = Column(Integer, default=100)
    contract_type = Column(String(50), default="full_time")
    experience_years = Column(Float, default=0)
    manager_id = Column(Integer, ForeignKey("resources.id"), nullable=True)
    hire_date = Column(Date, nullable=True)
    color = Column(String(50), default="#4F46E5")
    avatar = Column(String(255))
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    linked_user = relationship("User", back_populates="resource", foreign_keys=[user_id])
    department = relationship("Department", foreign_keys=[department_id])
    teams = relationship("Team", secondary="team_resources", back_populates="resources")
    allocations = relationship("ResourceAllocation", back_populates="resource", cascade="all, delete-orphan")
    availabilities = relationship("ResourceAvailability", back_populates="resource", cascade="all, delete-orphan")
    resource_skills = relationship("ResourceSkill", back_populates="resource", cascade="all, delete-orphan")
    resource_certifications = relationship("ResourceCertification", back_populates="resource", cascade="all, delete-orphan")
    manager = relationship("Resource", remote_side=[id], foreign_keys=[manager_id])


class ResourceAllocation(Base):
    __tablename__ = "resource_allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    task_id = Column(Integer, ForeignKey("issues.id", ondelete="SET NULL"), nullable=True)
    allocation_pct = Column(Integer, default=100)
    allocated_hours = Column(Numeric(10, 2), default=0)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    role = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resource = relationship("Resource", back_populates="allocations")
    project = relationship("Project")
    task = relationship("Issue")


class ResourceAvailability(Base):
    __tablename__ = "resource_availabilities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    available_hours = Column(Numeric(5, 2), default=8)
    reason = Column(String(255))
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resource = relationship("Resource", back_populates="availabilities")
