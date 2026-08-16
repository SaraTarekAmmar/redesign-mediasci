from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.database import Base

department_team = Table(
    "department_team", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("department_id", Integer, ForeignKey("departments.id", ondelete="CASCADE")),
    Column("team_id", Integer, ForeignKey("teams.id", ondelete="CASCADE")),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)

team_resources = Table(
    "team_resources", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("team_id", Integer, ForeignKey("teams.id", ondelete="CASCADE")),
    Column("resource_id", Integer, ForeignKey("resources.id", ondelete="CASCADE")),
    Column("role", String(50), default="member"),
    Column("role_in_team", String(50), default="member"),
    Column("joined_at", DateTime, default=datetime.utcnow),
    Column("left_at", DateTime, nullable=True),
    Column("is_primary_team", Boolean, default=True),
    Column("created_at", DateTime, default=datetime.utcnow),
    Column("updated_at", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),
)



class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255))
    description = Column(Text)
    avatar = Column(String(255))
    owner_id = Column(Integer, ForeignKey("users.id"))
    label = Column(String(100))
    color = Column(String(50))
    avatar_url = Column(String(500))
    department_id = Column(Integer, ForeignKey("departments.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    owner = relationship("User", foreign_keys=[owner_id])
    members = relationship("User", secondary="team_user", back_populates="teams")
    resources = relationship("Resource", secondary="team_resources", back_populates="teams")
    department = relationship("Department", back_populates="teams", foreign_keys=[department_id])
    projects = relationship("Project", back_populates="team", foreign_keys="Project.team_id")
    project_links = relationship("Project", secondary="project_teams", back_populates="teams")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    color = Column(String(50))
    image = Column(String(255))
    type = Column(String(50))
    team_leader_id = Column(Integer, ForeignKey("users.id", use_alter=True, name="fk_departments_team_leader_id_users"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    leader = relationship("User", foreign_keys=[team_leader_id])
    users = relationship("User", back_populates="department", foreign_keys="User.department_id")
    teams = relationship("Team", back_populates="department", foreign_keys="Team.department_id")
