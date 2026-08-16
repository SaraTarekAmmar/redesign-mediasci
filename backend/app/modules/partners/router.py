"""Partners router — external partner CRUD and partner members."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.pagination import MessageResponse
from app.database import get_db
from app.dependencies import require_roles
from app.models.partner import Partner, PartnerTeam
from app.modules.partners.schemas import (
    PartnerCreateIn, PartnerUpdateIn, PartnerMemberCreateIn, PartnerMemberUpdateIn,
    PartnerTeamCreateIn, PartnerTeamUpdateIn, PartnerTeamMemberIn,
)
from app.modules.partners import service, repository as repo

router = APIRouter(tags=["Partners"])
_admin_only = Depends(require_roles("super-admin", "admin"))


def _fmt_member(m) -> dict:
    return {
        "id": m.id,
        "partner_id": m.partner_id,
        "user_id": m.user_id,
        "name": m.name,
        "email": m.email or "",
        "phone": m.phone or "",
        "role": m.role or "",
        "is_active": bool(m.is_active),
    }


def _fmt_team(team: PartnerTeam) -> dict:
    members = [
        member for member in (team.members or [])
        if member.deleted_at is None and member.is_active != 0
    ]
    return {
        "id": team.id,
        "partner_id": team.partner_id,
        "name": team.name,
        "description": team.description or "",
        "is_active": bool(team.is_active),
        "members": [_fmt_member(member) for member in members],
        "member_ids": [member.id for member in members],
        "members_count": len(members),
    }


def _fmt_partner(p: Partner) -> dict:
    members = [m for m in (p.members or []) if m.deleted_at is None]
    teams = [team for team in (p.teams or []) if team.deleted_at is None]
    return {
        "id": p.id,
        "name": p.name,
        "company": p.company or "",
        "specialty": p.specialty or "",
        "email": p.email or "",
        "phone": p.phone or "",
        "website": p.website or "",
        "status": p.status or "active",
        "notes": p.notes or "",
        "color": p.color or "#F59E0B",
        "members": [_fmt_member(m) for m in members],
        "members_count": len(members),
        "teams": [_fmt_team(team) for team in teams],
        "teams_count": len(teams),
        "projects": [
            {"id": project.id, "name": project.name, "key": project.key}
            for project in (p.projects or [])
            if project.deleted_at is None
        ],
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/partners")
def list_partners(
    q: str = Query(""),
    status: str = Query(""),
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    partners = repo.get_partners_query(db, q=q, status=status).order_by(Partner.name).all()
    return [_fmt_partner(p) for p in partners]


@router.post("/partners", status_code=201)
def create_partner(
    body: PartnerCreateIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    return _fmt_partner(service.create_partner(db, body))


@router.get("/partners/{partner_id}")
def get_partner(
    partner_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    partner = repo.get_partner_by_id(db, partner_id)
    if not partner:
        raise HTTPException(404, "Partner not found.")
    return _fmt_partner(partner)


@router.put("/partners/{partner_id}")
def update_partner(
    partner_id: int,
    body: PartnerUpdateIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    partner = repo.get_partner_by_id(db, partner_id)
    if not partner:
        raise HTTPException(404, "Partner not found.")
    return _fmt_partner(service.update_partner(db, partner, body))


@router.delete("/partners/{partner_id}", response_model=MessageResponse)
def delete_partner(
    partner_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    partner = repo.get_partner_by_id(db, partner_id)
    if not partner:
        raise HTTPException(404, "Partner not found.")
    service.delete_partner(db, partner)
    return MessageResponse(message="Partner deleted.")


# ── Partner members ─────────────────────────────────────────────────────────

@router.get("/partners/{partner_id}/members")
def list_members(
    partner_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    partner = repo.get_partner_by_id(db, partner_id)
    if not partner:
        raise HTTPException(404, "Partner not found.")
    return [_fmt_member(m) for m in partner.members if m.deleted_at is None]


@router.post("/partners/{partner_id}/members", status_code=201)
def add_member(
    partner_id: int,
    body: PartnerMemberCreateIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    partner = repo.get_partner_by_id(db, partner_id)
    if not partner:
        raise HTTPException(404, "Partner not found.")
    return _fmt_member(service.add_member(db, partner_id, body))


@router.put("/partners/{partner_id}/members/{member_id}")
def update_member(
    partner_id: int,
    member_id: int,
    body: PartnerMemberUpdateIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    member = repo.get_member_by_id(db, partner_id, member_id)
    if not member:
        raise HTTPException(404, "Partner member not found.")
    return _fmt_member(service.update_member(db, member, body))


@router.delete("/partners/{partner_id}/members/{member_id}", response_model=MessageResponse)
def remove_member(
    partner_id: int,
    member_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    member = repo.get_member_by_id(db, partner_id, member_id)
    if not member:
        raise HTTPException(404, "Partner member not found.")
    service.remove_member(db, member)
    return MessageResponse(message="Partner member removed.")


# ── Partner teams ───────────────────────────────────────────────────────────

@router.get("/partners/{partner_id}/teams")
def list_teams(
    partner_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    partner = repo.get_partner_by_id(db, partner_id)
    if not partner:
        raise HTTPException(404, "Partner not found.")
    return [_fmt_team(team) for team in partner.teams if team.deleted_at is None]


@router.post("/partners/{partner_id}/teams", status_code=201)
def create_team(
    partner_id: int,
    body: PartnerTeamCreateIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    partner = repo.get_partner_by_id(db, partner_id)
    if not partner:
        raise HTTPException(404, "Partner not found.")
    if partner.status == "inactive":
        raise HTTPException(409, "Inactive partners cannot create delivery teams.")
    return _fmt_team(service.create_team(db, partner_id, body))


@router.put("/partners/{partner_id}/teams/{team_id}")
def update_team(
    partner_id: int,
    team_id: int,
    body: PartnerTeamUpdateIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    team = repo.get_team_by_id(db, partner_id, team_id)
    if not team:
        raise HTTPException(404, "Partner team not found.")
    return _fmt_team(service.update_team(db, team, body))


@router.delete("/partners/{partner_id}/teams/{team_id}", response_model=MessageResponse)
def remove_team(
    partner_id: int,
    team_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    team = repo.get_team_by_id(db, partner_id, team_id)
    if not team:
        raise HTTPException(404, "Partner team not found.")
    service.remove_team(db, team)
    return MessageResponse(message="Partner team removed.")


@router.post("/partners/{partner_id}/teams/{team_id}/members")
def add_team_member(
    partner_id: int,
    team_id: int,
    body: PartnerTeamMemberIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    team = repo.get_team_by_id(db, partner_id, team_id)
    member = repo.get_member_by_id(db, partner_id, body.member_id)
    if not team:
        raise HTTPException(404, "Partner team not found.")
    if not member or member.is_active == 0:
        raise HTTPException(404, "Active partner member not found.")
    return _fmt_team(service.add_team_member(db, team, member))


@router.delete("/partners/{partner_id}/teams/{team_id}/members/{member_id}")
def remove_team_member(
    partner_id: int,
    team_id: int,
    member_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    team = repo.get_team_by_id(db, partner_id, team_id)
    member = repo.get_member_by_id(db, partner_id, member_id)
    if not team:
        raise HTTPException(404, "Partner team not found.")
    if not member:
        raise HTTPException(404, "Partner member not found.")
    return _fmt_team(service.remove_team_member(db, team, member))
