"""External partner organizations, teams, members, and project assignments."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

project_partners = Table(
    "project_partners", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE")),
    Column("partner_id", Integer, ForeignKey("partners.id", ondelete="CASCADE")),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
)

partner_team_members = Table(
    "partner_team_members", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("partner_team_id", Integer, ForeignKey("partner_teams.id", ondelete="CASCADE"), nullable=False),
    Column("partner_member_id", Integer, ForeignKey("partner_members.id", ondelete="CASCADE"), nullable=False),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
    UniqueConstraint("partner_team_id", "partner_member_id", name="uq_partner_team_member"),
)

project_partner_teams = Table(
    "project_partner_teams", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
    Column("partner_team_id", Integer, ForeignKey("partner_teams.id", ondelete="CASCADE"), nullable=False),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
    UniqueConstraint("project_id", "partner_team_id", name="uq_project_partner_team"),
)

project_partner_members = Table(
    "project_partner_members", Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
    Column("partner_member_id", Integer, ForeignKey("partner_members.id", ondelete="CASCADE"), nullable=False),
    Column("created_at", DateTime),
    Column("updated_at", DateTime),
    UniqueConstraint("project_id", "partner_member_id", name="uq_project_partner_member"),
)


class Partner(Base):
    """An external company/consultant collaborating on projects (not an internal team)."""
    __tablename__ = "partners"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    company = Column(String(255))
    specialty = Column(String(255))
    email = Column(String(255))
    phone = Column(String(50))
    website = Column(String(500))
    status = Column(String(50), default="active")
    notes = Column(Text)
    color = Column(String(50), default="#F59E0B")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    members = relationship("PartnerMember", back_populates="partner", cascade="all, delete-orphan")
    teams = relationship("PartnerTeam", back_populates="partner", cascade="all, delete-orphan")
    projects = relationship("Project", secondary=project_partners, back_populates="partners")


class PartnerTeam(Base):
    """A delivery team owned by an external partner organization."""
    __tablename__ = "partner_teams"

    id = Column(Integer, primary_key=True, autoincrement=True)
    partner_id = Column(Integer, ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    partner = relationship("Partner", back_populates="teams")
    members = relationship("PartnerMember", secondary=partner_team_members, back_populates="teams")
    projects = relationship("Project", secondary=project_partner_teams, back_populates="partner_teams")


class PartnerMember(Base):
    """A person working for an external partner; eligible for project tasks when their partner is assigned."""
    __tablename__ = "partner_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=False)
    # Optional login identity for partner users.  A member without a linked
    # user can still receive tasks but cannot authenticate to the platform.
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    role = Column(String(100))
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    partner = relationship("Partner", back_populates="members")
    linked_user = relationship("User", foreign_keys=[user_id])
    teams = relationship("PartnerTeam", secondary=partner_team_members, back_populates="members")
    projects = relationship("Project", secondary=project_partner_members, back_populates="partner_members")
