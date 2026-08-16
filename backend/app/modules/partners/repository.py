"""Partners repository - DB access only."""
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.partner import Partner, PartnerMember, PartnerTeam


def _partner_load_options():
    return (
        joinedload(Partner.members),
        joinedload(Partner.teams).joinedload(PartnerTeam.members),
        joinedload(Partner.projects),
    )


def get_partners_query(db: Session, q: str = "", status: str = ""):
    query = db.query(Partner).options(*_partner_load_options()).filter(Partner.deleted_at.is_(None))
    if q:
        query = query.filter(Partner.name.ilike(f"%{q}%") | Partner.company.ilike(f"%{q}%"))
    if status:
        query = query.filter(Partner.status == status)
    return query


def get_partner_by_id(db: Session, partner_id: int) -> Optional[Partner]:
    return (
        db.query(Partner)
        .options(*_partner_load_options())
        .filter(Partner.id == partner_id, Partner.deleted_at.is_(None))
        .first()
    )


def get_member_by_id(db: Session, partner_id: int, member_id: int) -> Optional[PartnerMember]:
    return (
        db.query(PartnerMember)
        .filter(
            PartnerMember.id == member_id,
            PartnerMember.partner_id == partner_id,
            PartnerMember.deleted_at.is_(None),
        )
        .first()
    )


def get_team_by_id(db: Session, partner_id: int, team_id: int) -> Optional[PartnerTeam]:
    return (
        db.query(PartnerTeam)
        .options(joinedload(PartnerTeam.members))
        .filter(
            PartnerTeam.id == team_id,
            PartnerTeam.partner_id == partner_id,
            PartnerTeam.deleted_at.is_(None),
        )
        .first()
    )
