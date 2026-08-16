"""Partners service - business logic."""
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.partner import Partner, PartnerMember, PartnerTeam
from app.models.user import User
from app.modules.partners.schemas import (
    PartnerCreateIn, PartnerUpdateIn, PartnerMemberCreateIn, PartnerMemberUpdateIn,
    PartnerTeamCreateIn, PartnerTeamUpdateIn,
)


def create_partner(db: Session, body: PartnerCreateIn) -> Partner:
    partner = Partner(
        name=body.name,
        company=body.company,
        specialty=body.specialty,
        email=body.email,
        phone=body.phone,
        website=body.website,
        status=body.status or "active",
        notes=body.notes,
        color=body.color or "#F59E0B",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(partner)
    db.commit()
    db.refresh(partner)
    return partner


def update_partner(db: Session, partner: Partner, body: PartnerUpdateIn) -> Partner:
    for field, value in body.model_dump(exclude_unset=True).items():
        if hasattr(partner, field):
            setattr(partner, field, value)
    partner.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(partner)
    return partner


def delete_partner(db: Session, partner: Partner) -> None:
    """Soft delete; project links and members stay for historical integrity."""
    partner.deleted_at = datetime.now(timezone.utc)
    db.commit()


def add_member(db: Session, partner_id: int, body: PartnerMemberCreateIn) -> PartnerMember:
    if body.user_id is not None:
        linked_user = db.query(User).filter(
            User.id == body.user_id,
            User.deleted_at.is_(None),
            User.is_active != False,  # noqa: E712
        ).first()
        if not linked_user:
            raise HTTPException(404, "Linked user not found or inactive.")
    member = PartnerMember(
        partner_id=partner_id,
        user_id=body.user_id,
        name=body.name,
        email=body.email,
        phone=body.phone,
        role=body.role,
        is_active=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def update_member(db: Session, member: PartnerMember, body: PartnerMemberUpdateIn) -> PartnerMember:
    data = body.model_dump(exclude_unset=True)
    if data.get("user_id") is not None:
        linked_user = db.query(User).filter(
            User.id == data["user_id"],
            User.deleted_at.is_(None),
            User.is_active != False,  # noqa: E712
        ).first()
        if not linked_user:
            raise HTTPException(404, "Linked user not found or inactive.")
    if "is_active" in data:
        member.is_active = 1 if data.pop("is_active") else 0
    for field, value in data.items():
        if hasattr(member, field):
            setattr(member, field, value)
    member.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(member)
    return member


def remove_member(db: Session, member: PartnerMember) -> None:
    """Soft delete so historical task assignments keep resolving."""
    member.deleted_at = datetime.now(timezone.utc)
    db.commit()


def _validated_team_members(db: Session, partner_id: int, member_ids: list[int]) -> list[PartnerMember]:
    target = {int(member_id) for member_id in member_ids}
    if not target:
        return []
    members = db.query(PartnerMember).filter(
        PartnerMember.id.in_(target),
        PartnerMember.partner_id == partner_id,
        PartnerMember.deleted_at.is_(None),
        PartnerMember.is_active != 0,
    ).all()
    found = {member.id for member in members}
    missing = sorted(target - found)
    if missing:
        raise HTTPException(404, f"Partner member(s) not found or inactive: {', '.join(map(str, missing))}")
    return members


def create_team(db: Session, partner_id: int, body: PartnerTeamCreateIn) -> PartnerTeam:
    now = datetime.now(timezone.utc)
    team = PartnerTeam(
        partner_id=partner_id,
        name=body.name,
        description=body.description,
        is_active=1,
        created_at=now,
        updated_at=now,
    )
    team.members = _validated_team_members(db, partner_id, body.member_ids)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


def update_team(db: Session, team: PartnerTeam, body: PartnerTeamUpdateIn) -> PartnerTeam:
    data = body.model_dump(exclude_unset=True)
    member_ids = data.pop("member_ids", None)
    if "is_active" in data:
        team.is_active = 1 if data.pop("is_active") else 0
    for field, value in data.items():
        if hasattr(team, field):
            setattr(team, field, value)
    if member_ids is not None:
        team.members = _validated_team_members(db, team.partner_id, member_ids)
    team.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(team)
    return team


def remove_team(db: Session, team: PartnerTeam) -> None:
    """Soft delete so historical project links remain explainable."""
    team.deleted_at = datetime.now(timezone.utc)
    team.is_active = 0
    db.commit()


def add_team_member(db: Session, team: PartnerTeam, member: PartnerMember) -> PartnerTeam:
    if member.partner_id != team.partner_id:
        raise HTTPException(400, "Team and member must belong to the same partner.")
    if member not in team.members:
        team.members.append(member)
        team.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(team)
    return team


def remove_team_member(db: Session, team: PartnerTeam, member: PartnerMember) -> PartnerTeam:
    if member in team.members:
        team.members.remove(member)
        team.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(team)
    return team
