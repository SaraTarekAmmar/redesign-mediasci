"""
Projects Router — full CRUD + members + lookups.
All write operations require project-scoped permissions.
"""
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, require_roles, _get_user_roles
from app.models.client import Client, ClientRequest
from app.models.issue import Issue
from app.modules.projects import repository as repo
from app.modules.projects import service as project_service
from app.models.project import Project, project_teams
from app.models.resource import Resource
from app.models.team import Team, team_resources
from app.models.user import team_user
from app.modules.projects.schemas import (
    ProjectCreateIn, ProjectUpdateIn, ProjectMemberIn,
    ProjectTeamIn, ProjectPartnerIn, ProjectPartnerTeamIn, ProjectPartnerMemberIn,
    IssueStatusCreateIn, IssueStatusUpdateIn, IssueLabelCreateIn,
    CustomFieldCreateIn,
)
from app.modules.projects import workforce as workforce_service
from app.modules.projects.access import accessible_project_ids, is_system_admin
from app.models.partner import Partner, PartnerMember, PartnerTeam
from app.modules.resources import service as resource_service
from app.modules.resources.schemas import ProjectResourceAssignmentCreateIn, ProjectResourceAssignmentUpdateIn

router = APIRouter(tags=["Projects"])
_admin_only = Depends(require_roles("super-admin", "admin"))


def _fmt_user(user) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id,
        "name": user.name,
    }


def _fmt_client(client) -> dict | None:
    if not client:
        return None
    return {
        "id": client.id,
        "name": client.name,
        "company": client.company,
        "industry": client.industry,
        "status": client.status,
    }


def _generate_project_key(db: Session, name: str, requested_key: Optional[str]) -> str:
    candidate = (requested_key or "").strip().upper()
    if not candidate:
        slug = re.sub(r"[^A-Z0-9]+", "", name.upper())
        candidate = slug[:6] or "PRJ"

    existing_keys = {
        row[0]
        for row in db.query(Project.key)
        .filter(Project.key.isnot(None))
        .all()
    }
    base = candidate
    suffix = 2
    while candidate in existing_keys:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def _fmt_project_teams(p, db: Session) -> list[dict]:
    """Teams linked to a project via primary team_id and/or project_teams M2M."""
    team_ids: list[int] = []
    if p.team_id:
        team_ids.append(int(p.team_id))
    m2m_ids = db.execute(
        select(project_teams.c.team_id).where(project_teams.c.project_id == p.id)
    ).scalars().all()
    for tid in m2m_ids:
        if tid is not None and int(tid) not in team_ids:
            team_ids.append(int(tid))
    if not team_ids:
        return []

    teams = db.query(Team).filter(Team.id.in_(team_ids), Team.deleted_at.is_(None)).all()
    by_id = {t.id: t for t in teams}
    result = []
    for tid in team_ids:
        team = by_id.get(tid)
        if not team:
            continue
        resources_count = db.execute(
            select(func.count())
            .select_from(team_resources)
            .where(team_resources.c.team_id == tid)
        ).scalar_one()
        users_count = db.execute(
            select(func.count())
            .select_from(team_user)
            .where(team_user.c.team_id == tid)
        ).scalar_one()
        members_count = int(resources_count or 0) or int(users_count or 0)
        result.append({
            "id": team.id,
            "name": team.name,
            "color": team.color or "#111827",
            "description": team.description,
            "slug": team.slug,
            "members_count": members_count,
            "resources_count": int(resources_count or 0),
        })
    return result


def _validate_team_ids(db: Session, team_ids: list[int]) -> list[int]:
    """Return the subset of ids that do not match an existing (non-deleted) team."""
    found = {
        t.id for t in db.query(Team.id).filter(Team.id.in_(team_ids), Team.deleted_at.is_(None)).all()
    }
    return [tid for tid in team_ids if tid not in found]


def _validate_partner_ids(db: Session, partner_ids: list[int]) -> list[int]:
    """IDs that cannot be assigned: unknown, soft-deleted, or inactive partners."""
    found = {
        p.id
        for p in db.query(Partner.id)
        .filter(
            Partner.id.in_(partner_ids),
            Partner.deleted_at.is_(None),
            (Partner.status.is_(None)) | (Partner.status != "inactive"),
        )
        .all()
    }
    return [pid for pid in partner_ids if pid not in found]


def _validate_resource_ids(db: Session, resource_ids: list[int]) -> list[int]:
    found = {
        resource.id
        for resource in db.query(Resource.id).filter(
            Resource.id.in_(resource_ids),
            Resource.user_id.isnot(None),
            Resource.is_active != 0,
        ).all()
    }
    return [resource_id for resource_id in resource_ids if resource_id not in found]


def _validate_partner_team_ids(db: Session, team_ids: list[int]) -> list[int]:
    found = {
        team.id
        for team in db.query(PartnerTeam.id)
        .join(Partner, Partner.id == PartnerTeam.partner_id)
        .filter(
            PartnerTeam.id.in_(team_ids),
            PartnerTeam.deleted_at.is_(None),
            PartnerTeam.is_active != 0,
            Partner.deleted_at.is_(None),
            (Partner.status.is_(None)) | (Partner.status != "inactive"),
        ).all()
    }
    return [team_id for team_id in team_ids if team_id not in found]


def _validate_partner_member_ids(db: Session, member_ids: list[int]) -> list[int]:
    found = {
        member.id
        for member in db.query(PartnerMember.id)
        .join(Partner, Partner.id == PartnerMember.partner_id)
        .filter(
            PartnerMember.id.in_(member_ids),
            PartnerMember.deleted_at.is_(None),
            PartnerMember.is_active != 0,
            Partner.deleted_at.is_(None),
            (Partner.status.is_(None)) | (Partner.status != "inactive"),
        ).all()
    }
    return [member_id for member_id in member_ids if member_id not in found]


def _fmt_project_partners(p, db: Session) -> list[dict]:
    """External partners assigned to a project via project_partners M2M."""
    partner_ids = workforce_service.get_assigned_partner_ids(db, p.id)
    if not partner_ids:
        return []
    partners = db.query(Partner).filter(Partner.id.in_(partner_ids), Partner.deleted_at.is_(None)).all()
    return [
        {
            "id": partner.id,
            "name": partner.name,
            "company": partner.company,
            "specialty": partner.specialty,
            "color": partner.color or "#F59E0B",
            "members_count": len([m for m in (partner.members or []) if m.deleted_at is None]),
        }
        for partner in sorted(partners, key=lambda x: (x.name or "").lower())
    ]


def _fmt_project_partner_teams(p, db: Session) -> list[dict]:
    team_ids = workforce_service.get_assigned_partner_team_ids(db, p.id)
    if not team_ids:
        return []
    teams = (
        db.query(PartnerTeam)
        .filter(PartnerTeam.id.in_(team_ids), PartnerTeam.deleted_at.is_(None))
        .all()
    )
    return [
        {
            "id": team.id,
            "partner_id": team.partner_id,
            "name": team.name,
            "description": team.description,
            "partner": {
                "id": team.partner.id,
                "name": team.partner.name,
                "color": team.partner.color,
            },
            "members_count": len([
                member for member in (team.members or [])
                if member.deleted_at is None and member.is_active != 0
            ]),
        }
        for team in sorted(teams, key=lambda item: ((item.partner.name or "").lower(), (item.name or "").lower()))
    ]


def _fmt_project_partner_members(p, db: Session) -> list[dict]:
    member_ids = workforce_service.get_assigned_partner_member_ids(db, p.id)
    if not member_ids:
        return []
    members = (
        db.query(PartnerMember)
        .filter(PartnerMember.id.in_(member_ids), PartnerMember.deleted_at.is_(None))
        .all()
    )
    return [
        {
            "id": member.id,
            "partner_id": member.partner_id,
            "name": member.name,
            "email": member.email,
            "role": member.role,
            "partner": {
                "id": member.partner.id,
                "name": member.partner.name,
                "color": member.partner.color,
            },
        }
        for member in sorted(members, key=lambda item: (item.name or "").lower())
    ]


def _fmt_project(p, db: Session) -> dict:
    teams = _fmt_project_teams(p, db)
    team = teams[0] if teams else None
    if team:
        team = {"id": team["id"], "name": team["name"]}
    issue_count = db.execute(
        select(func.count())
        .select_from(Issue.__table__)
        .where(
            Issue.__table__.c.project_id == p.id,
            Issue.__table__.c.deleted_at.is_(None),
        )
    ).scalar_one()
    return {
        "id": p.id,
        "name": p.name,
        "key": p.key,
        "description": p.description,
        "type": p.type,
        "classification": p.classification,
        "presale_type": p.presale_type,
        "category": p.category,
        "status": p.status,
        "client_id": p.client_id,
        "client_request_id": p.client_request_id,
        "client_request": {"id": p.client_request.id, "title": p.client_request.title} if getattr(p, 'client_request', None) else None,
        "team_id": p.team_id,
        "team": team,
        "teams": teams,
        "partners": _fmt_project_partners(p, db),
        "partner_teams": _fmt_project_partner_teams(p, db),
        "partner_members": _fmt_project_partner_members(p, db),
        "owner": _fmt_user(getattr(p, "owner", None)),
        "client": _fmt_client(getattr(p, "client", None)),
        "issueCount": int(issue_count or 0),
        "owner_id": p.owner_id,
        "settings": p.settings or {},
        "boards": [{"id": str(board.id)} for board in getattr(p, "boards", []) or []],
        "start_date": p.start_date.isoformat() if p.start_date else None,
        "end_date": p.end_date.isoformat() if p.end_date else None,
        "color": p.color,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "contractual_terms": p.contractual_terms,
    }


@router.get("/projects")
def list_projects(
    q: str = Query(""),
    status: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    roles = _get_user_roles(current_user.id, db)
    query = repo.get_projects_query(db, current_user.id, roles, q=q, status=status)
    return paginate(query, page, per_page, serializer=lambda p: _fmt_project(p, db))


@router.post("/projects", status_code=201)
def create_project(
    body: ProjectCreateIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    client_id = body.client_id
    if not client_id:
        c = db.query(Client).filter(Client.deleted_at.is_(None)).first()
        if not c:
            c = Client(name="Default Client", company="Default Corp")
            db.add(c)
            db.flush()
        client_id = c.id

    client = db.query(Client).filter(Client.id == client_id, Client.deleted_at.is_(None)).first()
    if not client:
        raise HTTPException(404, "Client not found.")
    if body.client_request_id is not None:
        request = db.query(ClientRequest).filter(ClientRequest.id == body.client_request_id, ClientRequest.deleted_at.is_(None)).first()
        if not request:
            raise HTTPException(404, "Client request not found.")
        if request.client_id != client_id:
            raise HTTPException(400, "Project client must match the linked client request.")
    p = repo.create_project(
        db,
        name=body.name,
        key=_generate_project_key(db, body.name, body.key),
        description=body.description,
        type=body.type or "software",
        classification=body.classification,
        presale_type=body.presale_type,
        category=body.category,
        status=body.status or "active",
        client_id=client_id,

        client_request_id=body.client_request_id,
        team_id=body.team_id,
        settings=body.settings,
        owner_id=current_user.id,
        color=body.color,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    repo.add_member(db, p.id, current_user.id, "owner")

    # Multiple internal teams + external partners (unified workforce model)
    team_ids = list(body.team_ids or [])
    if body.team_id and body.team_id not in team_ids:
        team_ids.insert(0, body.team_id)
    if team_ids:
        missing = _validate_team_ids(db, team_ids)
        if missing:
            raise HTTPException(404, f"Team(s) not found: {', '.join(map(str, missing))}")
        workforce_service.sync_project_teams(db, p.id, team_ids)
    if body.partner_ids:
        missing = _validate_partner_ids(db, body.partner_ids)
        if missing:
            raise HTTPException(404, f"Partner(s) not found: {', '.join(map(str, missing))}")
        workforce_service.sync_project_partners(db, p.id, body.partner_ids)
    if body.resource_ids:
        missing = _validate_resource_ids(db, body.resource_ids)
        if missing:
            raise HTTPException(404, f"Resource(s) not found, inactive, or not linked to users: {', '.join(map(str, missing))}")
        workforce_service.sync_project_resources(db, p.id, body.resource_ids)
    if body.partner_team_ids:
        missing = _validate_partner_team_ids(db, body.partner_team_ids)
        if missing:
            raise HTTPException(404, f"Partner team(s) not found or inactive: {', '.join(map(str, missing))}")
        workforce_service.sync_project_partner_teams(db, p.id, body.partner_team_ids)
    if body.partner_member_ids:
        missing = _validate_partner_member_ids(db, body.partner_member_ids)
        if missing:
            raise HTTPException(404, f"Partner member(s) not found or inactive: {', '.join(map(str, missing))}")
        workforce_service.sync_project_partner_members(db, p.id, body.partner_member_ids)

    db.commit()
    db.refresh(p)
    return _fmt_project(p, db)


@router.get("/projects/{project_id}")
def get_project(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    members = repo.get_project_members(db, project_id)
    return {
        **_fmt_project(p, db),
        "members": [
            {
                **m,
                "id": m["user_id"],
                "project_role": m["role"],
                "pivot": {"role": m["role"]},
            }
            for _u, _role, m in members
        ],
        "members_count": len(members),
    }


@router.put("/projects/{project_id}/contractual-terms")
def update_project_contractual_terms(
    project_id: int,
    body: dict,
    current_user=Depends(require_roles("super-admin")),
    db: Session = Depends(get_db),
):
    """Contractual terms are entered manually and only by a super-admin — never
    auto-generated, never editable by regular admins or PMs."""
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    p.contractual_terms = body.get("contractual_terms")
    db.commit()
    db.refresh(p)
    return {"contractual_terms": p.contractual_terms}


@router.put("/projects/{project_id}")
def update_project(
    project_id: int,
    body: ProjectUpdateIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    if body.client_id is not None:
        client = db.query(Client).filter(Client.id == body.client_id, Client.deleted_at.is_(None)).first()
        if not client:
            raise HTTPException(404, "Client not found.")
    if body.client_request_id is not None:
        request = db.query(ClientRequest).filter(ClientRequest.id == body.client_request_id, ClientRequest.deleted_at.is_(None)).first()
        if not request:
            raise HTTPException(404, "Client request not found.")
        target_client_id = body.client_id if body.client_id is not None else p.client_id
        if target_client_id is not None and request.client_id != target_client_id:
            raise HTTPException(400, "Project client must match the linked client request.")

    data = body.model_dump(exclude_unset=True)

    team_ids = data.pop("team_ids", None)
    resource_ids = data.pop("resource_ids", None)
    partner_ids = data.pop("partner_ids", None)
    partner_team_ids = data.pop("partner_team_ids", None)
    partner_member_ids = data.pop("partner_member_ids", None)
    if team_ids is not None:
        missing = _validate_team_ids(db, team_ids)
        if missing:
            raise HTTPException(404, f"Team(s) not found: {', '.join(map(str, missing))}")
        workforce_service.sync_project_teams(db, project_id, team_ids)
        data.pop("team_id", None)  # team_ids is authoritative when provided
    elif "team_id" in data and data["team_id"]:
        # Keep the M2M in sync when only the legacy single FK is updated.
        workforce_service.add_team_to_project(db, project_id, data["team_id"])
    if partner_ids is not None:
        missing = _validate_partner_ids(db, partner_ids)
        if missing:
            raise HTTPException(404, f"Partner(s) not found: {', '.join(map(str, missing))}")
        workforce_service.sync_project_partners(db, project_id, partner_ids)
    if resource_ids is not None:
        missing = _validate_resource_ids(db, resource_ids)
        if missing:
            raise HTTPException(404, f"Resource(s) not found, inactive, or not linked to users: {', '.join(map(str, missing))}")
        workforce_service.sync_project_resources(db, project_id, resource_ids)
    if partner_team_ids is not None:
        missing = _validate_partner_team_ids(db, partner_team_ids)
        if missing:
            raise HTTPException(404, f"Partner team(s) not found or inactive: {', '.join(map(str, missing))}")
        workforce_service.sync_project_partner_teams(db, project_id, partner_team_ids)
    if partner_member_ids is not None:
        missing = _validate_partner_member_ids(db, partner_member_ids)
        if missing:
            raise HTTPException(404, f"Partner member(s) not found or inactive: {', '.join(map(str, missing))}")
        workforce_service.sync_project_partner_members(db, project_id, partner_member_ids)

    if "manager_id" in data:
        p.owner_id = data.pop("manager_id")
    if "owner_id" in data:
        p.owner_id = data.pop("owner_id")

    if "start_date" in data:
        val = data.pop("start_date")
        if val:
            try:
                p.start_date = datetime.strptime(str(val)[:10], "%Y-%m-%d").date()
            except Exception:
                p.start_date = None
        else:
            p.start_date = None

    if "end_date" in data:
        val = data.pop("end_date")
        if val:
            try:
                p.end_date = datetime.strptime(str(val)[:10], "%Y-%m-%d").date()
            except Exception:
                p.end_date = None
        else:
            p.end_date = None

    for field, value in data.items():
        if hasattr(p, field):
            setattr(p, field, value)

    if body.settings is not None:
        p.settings = body.settings

    p.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    return _fmt_project(p, db)


@router.delete("/projects/{project_id}", response_model=MessageResponse)
def delete_project(
    project_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    # Project lifecycle is soft-delete/archival so existing issues, workforce,
    # and audit history remain intact and can be recovered.
    p.status = "archived"
    p.deleted_at = datetime.now(timezone.utc)
    p.updated_at = datetime.now(timezone.utc)
    db.commit()
    return MessageResponse(message="Project deleted successfully.")


# ── Members ────────────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/members")
def get_members(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    members = repo.get_project_members(db, project_id)
    return [
        {
            **m,
            "id": m["user_id"],
            "project_role": m["role"],
        }
        for _u, _role, m in members
    ]


@router.post("/projects/{project_id}/members", status_code=201, response_model=MessageResponse)
def add_member(
    project_id: int,
    body: ProjectMemberIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    repo.add_member(db, project_id, body.user_id, body.role or "member")
    db.commit()
    return MessageResponse(message="Member added to project.")


@router.delete("/projects/{project_id}/members", response_model=MessageResponse)
def remove_member_body(
    project_id: int,
    body: ProjectMemberIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    repo.remove_member(db, project_id, body.user_id)
    db.commit()
    return MessageResponse(message="Member removed from project.")


@router.delete("/projects/{project_id}/members/{user_id}", response_model=MessageResponse)
def remove_member(
    project_id: int,
    user_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    repo.remove_member(db, project_id, user_id)
    db.commit()
    return MessageResponse(message="Member removed from project.")


@router.put("/projects/{project_id}/members/role", response_model=MessageResponse)
def update_member_role(
    project_id: int,
    body: ProjectMemberIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    updated = repo.update_member_role(db, project_id, body.user_id, body.role or "member")
    if not updated:
        raise HTTPException(404, "Member not found.")
    db.commit()
    return MessageResponse(message="Member role updated.")


# ── Teams & Partners (project workforce assignments) ───────────────────────

@router.get("/projects/{project_id}/teams")
def list_project_teams(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    return _fmt_project_teams(p, db)


@router.post("/projects/{project_id}/teams", status_code=201)
def add_project_team(
    project_id: int,
    body: ProjectTeamIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    if _validate_team_ids(db, [body.team_id]):
        raise HTTPException(404, "Team not found.")
    workforce_service.add_team_to_project(db, project_id, body.team_id)
    if not p.team_id:
        p.team_id = body.team_id
    db.commit()
    return _fmt_project_teams(p, db)


@router.delete("/projects/{project_id}/teams/{team_id}")
def remove_project_team(
    project_id: int,
    team_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    workforce_service.remove_team_from_project(db, project_id, team_id)
    db.commit()
    return _fmt_project_teams(p, db)


@router.get("/projects/{project_id}/partners")
def list_project_partners(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    return _fmt_project_partners(p, db)


@router.post("/projects/{project_id}/partners", status_code=201)
def add_project_partner(
    project_id: int,
    body: ProjectPartnerIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    if _validate_partner_ids(db, [body.partner_id]):
        raise HTTPException(404, "Partner not found.")
    workforce_service.add_partner_to_project(db, project_id, body.partner_id)
    db.commit()
    return _fmt_project_partners(p, db)


@router.delete("/projects/{project_id}/partners/{partner_id}")
def remove_project_partner(
    project_id: int,
    partner_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    workforce_service.remove_partner_from_project(db, project_id, partner_id)
    db.commit()
    return _fmt_project_partners(p, db)


@router.get("/projects/{project_id}/partner-teams")
def list_project_partner_teams(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    return _fmt_project_partner_teams(p, db)


@router.post("/projects/{project_id}/partner-teams", status_code=201)
def add_project_partner_team(
    project_id: int,
    body: ProjectPartnerTeamIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    if _validate_partner_team_ids(db, [body.partner_team_id]):
        raise HTTPException(404, "Partner team not found or inactive.")
    workforce_service.add_partner_team_to_project(db, project_id, body.partner_team_id)
    db.commit()
    return _fmt_project_partner_teams(p, db)


@router.delete("/projects/{project_id}/partner-teams/{partner_team_id}")
def remove_project_partner_team(
    project_id: int,
    partner_team_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    workforce_service.remove_partner_team_from_project(db, project_id, partner_team_id)
    db.commit()
    return _fmt_project_partner_teams(p, db)


@router.get("/projects/{project_id}/partner-members")
def list_project_partner_members(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    return _fmt_project_partner_members(p, db)


@router.post("/projects/{project_id}/partner-members", status_code=201)
def add_project_partner_member(
    project_id: int,
    body: ProjectPartnerMemberIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    if _validate_partner_member_ids(db, [body.partner_member_id]):
        raise HTTPException(404, "Partner member not found or inactive.")
    workforce_service.add_partner_member_to_project(db, project_id, body.partner_member_id)
    db.commit()
    return _fmt_project_partner_members(p, db)


@router.delete("/projects/{project_id}/partner-members/{partner_member_id}")
def remove_project_partner_member(
    project_id: int,
    partner_member_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    workforce_service.remove_partner_member_from_project(db, project_id, partner_member_id)
    db.commit()
    return _fmt_project_partner_members(p, db)


@router.get("/projects/{project_id}/workforce")
def get_project_workforce(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unified project workforce: internal (teams) + external (partners), deduped."""
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    return workforce_service.get_project_workforce(db, project_id)


# ── Project Resource Assignments ───────────────────────────────────────────


@router.get("/projects/{project_id}/resources")
def list_project_resources(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return resource_service.list_project_resource_assignments(db, project_id)


@router.post("/projects/{project_id}/resources", status_code=201)
def assign_project_resource(
    project_id: int,
    body: ProjectResourceAssignmentCreateIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    return resource_service.assign_resource_to_project(db, project_id, body)


@router.put("/projects/{project_id}/resources/{assignment_id}")
def update_project_resource(
    project_id: int,
    assignment_id: int,
    body: ProjectResourceAssignmentUpdateIn,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    return resource_service.update_project_resource_assignment(db, project_id, assignment_id, body)


@router.delete("/projects/{project_id}/resources/{assignment_id}", response_model=MessageResponse)
def remove_project_resource(
    project_id: int,
    assignment_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    resource_service.remove_resource_from_project(db, project_id, assignment_id)
    return MessageResponse(message="Resource removed from project.")


# ── Lookup endpoints ───────────────────────────────────────────────────────

@router.get("/projects/{project_id}/statuses")
def get_statuses(project_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    statuses = repo.get_project_statuses(db, project_id)
    return [{"id": s.id, "name": s.name, "color": s.color, "category": s.category, "position": s.position} for s in statuses]


@router.get("/projects/{project_id}/types")
def get_types(project_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    types = repo.get_project_types(db)
    return [{"id": t.id, "name": t.name, "icon": t.icon, "color": t.color} for t in types]


@router.get("/projects/{project_id}/priorities")
def get_priorities(project_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    priorities = repo.get_project_priorities(db)
    return [{"id": p.id, "name": p.name, "color": p.color, "level": p.weight} for p in priorities]


@router.get("/projects/{project_id}/labels")
def get_labels(project_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    labels = repo.get_project_labels(db, project_id)
    return [{"id": l.id, "name": l.name, "color": l.color} for l in labels]


@router.post("/projects/{project_id}/labels", status_code=201)
def create_label(
    project_id: int,
    body: IssueLabelCreateIn,
    current_user=Depends(require_permissions("manage-labels")),
    db: Session = Depends(get_db),
):
    from app.models.issue import IssueLabel
    label = IssueLabel(
        project_id=project_id,
        name=body.name,
        color=body.color or "#6B7280",
        created_at=datetime.now(timezone.utc),
    )
    db.add(label)
    db.commit()
    db.refresh(label)
    return {"id": label.id, "name": label.name, "color": label.color}


@router.get("/projects/{project_id}/custom-fields")
def get_custom_fields(project_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    fields = repo.get_custom_fields(db, project_id)
    return [{"id": f.id, "name": f.name, "field_type": f.type, "required": f.required, "options": f.options} for f in fields]


@router.get("/projects/{project_id}/settings")
def get_project_settings(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")
    return project.settings or {}


@router.put("/projects/{project_id}/settings")
def update_project_settings(
    project_id: int,
    body: dict,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    project = repo.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")
    values = dict(body)
    values.pop("section", None)
    project.settings = {**(project.settings or {}), **values}
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(project)
    return project.settings


@router.post("/projects/{project_id}/custom-fields", status_code=201)
def create_custom_field(
    project_id: int,
    body: CustomFieldCreateIn,
    current_user=Depends(require_permissions("edit-project")),
    db: Session = Depends(get_db),
):
    from app.models.misc import CustomField
    field = CustomField(
        name=body.name,
        type=body.field_type,
        description=body.description,
        options=body.options,
        required=body.required,
        project_id=project_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return {"id": field.id, "name": field.name, "field_type": field.type}


@router.get("/projects/{project_id}/overview")
def project_overview(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.issue import Issue
    from app.models.sprint import Sprint
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    total_issues = db.query(Issue).filter(Issue.project_id == project_id, Issue.deleted_at.is_(None)).count()
    active_sprints = db.query(Sprint).filter(Sprint.project_id == project_id, Sprint.status == "active").count()
    member_count = len(repo.get_project_members(db, project_id))  # returns list of 3-tuples
    return {
        **_fmt_project(p, db),
        "stats": {
            "total_issues": total_issues,
            "active_sprints": active_sprints,
            "member_count": member_count,
        },
    }


@router.get("/projects/{project_id}/performance")
def project_performance(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    performance = project_service.get_project_performance(db, project_id)
    if not performance:
        raise HTTPException(404, "Project not found.")
    return performance


@router.get("/projects/{project_id}/stats")
def get_project_stats(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.project import Project
    from app.models.issue import Issue, IssueStatus
    from app.models.sprint import Sprint
    from app.models.risk import Risk
    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")
    
    issues = db.query(Issue).filter(Issue.project_id == project_id, Issue.deleted_at.is_(None)).count()
    completed_issues = db.query(Issue).join(IssueStatus).filter(
        Issue.project_id == project_id,
        Issue.deleted_at.is_(None),
        IssueStatus.category == "done"
    ).count()
    open_issues = issues - completed_issues
    
    overdue_issues = db.query(Issue).join(IssueStatus).filter(
        Issue.project_id == project_id,
        Issue.deleted_at.is_(None),
        IssueStatus.category != "done",
        Issue.due_date.isnot(None),
        Issue.due_date < datetime.now()
    ).count()
    
    sprints = db.query(Sprint).filter(Sprint.project_id == project_id).count()
    members = len(repo.get_project_members(db, project_id))  # 3-tuple list
    risks = db.query(Risk).filter(Risk.project_id == project_id, Risk.deleted_at.is_(None)).count()
    
    # Status Counts
    status_counts_rows = db.query(Issue.issue_status_id, func.count(Issue.id)).filter(
        Issue.project_id == project_id,
        Issue.deleted_at.is_(None)
    ).group_by(Issue.issue_status_id).all()
    status_counts = {str(sid): count for sid, count in status_counts_rows if sid}
    
    # Epic progress stats
    epic_totals = db.query(Issue.epic_id, func.count(Issue.id)).filter(
        Issue.project_id == project_id,
        Issue.deleted_at.is_(None),
        Issue.epic_id.isnot(None)
    ).group_by(Issue.epic_id).all()
    
    epic_dones = db.query(Issue.epic_id, func.count(Issue.id)).join(IssueStatus).filter(
        Issue.project_id == project_id,
        Issue.deleted_at.is_(None),
        Issue.epic_id.isnot(None),
        IssueStatus.category == "done"
    ).group_by(Issue.epic_id).all()
    
    dones_map = {str(eid): count for eid, count in epic_dones if eid}
    epic_stats = {
        str(eid): {"total": total, "done": dones_map.get(str(eid), 0)}
        for eid, total in epic_totals if eid
    }
    
    return {
        "issues": issues,
        "open_issues": open_issues,
        "completed_issues": completed_issues,
        "overdue_issues": overdue_issues,
        "sprints": sprints,
        "members": members,
        "risks": risks,
        "status_counts": status_counts,
        "epic_stats": epic_stats
    }


@router.get("/projects/{project_id}/briefing")
def project_briefing(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.issue import Issue, IssueStatus, sprint_issues
    from app.models.sprint import Sprint

    p = repo.get_project_by_id(db, project_id)
    if not p:
        raise HTTPException(404, "Project not found.")

    stats = get_project_stats(project_id, current_user=current_user, db=db)
    total_issues = max(int(stats["issues"] or 0), 1)
    completed_issues = int(stats["completed_issues"] or 0)
    overdue_issues = int(stats["overdue_issues"] or 0)
    open_issues = int(stats["open_issues"] or 0)

    score = max(0, min(100, round((completed_issues / total_issues) * 100) - (overdue_issues * 10)))
    if score >= 75 and overdue_issues == 0:
        tone = "success"
        label = "On Track"
    elif score >= 45:
        tone = "warning"
        label = "Needs Attention"
    else:
        tone = "danger"
        label = "At Risk"

    attention = []
    if overdue_issues > 0:
        attention.append(
            {
                "severity": "high" if overdue_issues > 3 else "medium",
                "tone": "danger",
                "icon": "alert-triangle",
                "title": "Overdue work",
                "detail": f"{overdue_issues} overdue issue(s) need attention.",
                "count": overdue_issues,
                "link": "/issues",
            }
        )
    if open_issues > 0:
        attention.append(
            {
                "severity": "medium",
                "tone": "warning",
                "icon": "circle-dot",
                "title": "Open work",
                "detail": f"{open_issues} issue(s) are still in flight.",
                "count": open_issues,
                "link": "/board",
            }
        )
    if not attention:
        attention.append(
            {
                "severity": "low",
                "tone": "success",
                "icon": "check",
                "title": "Milestones",
                "detail": "Work items are progressing normally.",
                "count": 0,
                "link": "/roadmap",
            }
        )

    active_sprint = (
        db.query(Sprint)
        .filter(Sprint.project_id == project_id, Sprint.status == "active")
        .order_by(Sprint.end_date.is_(None), Sprint.end_date.asc(), Sprint.id.asc())
        .first()
    )

    sprint_forecast_sprints = []
    sprint_summary = "No active sprint is currently running."
    if active_sprint:
        issue_ids = db.execute(
            select(sprint_issues.c.issue_id).where(sprint_issues.c.sprint_id == active_sprint.id)
        ).scalars().all()
        done_status_ids = [row[0] for row in db.query(IssueStatus.id).filter(IssueStatus.category == "done").all()]
        done_count = (
            db.query(func.count(Issue.id))
            .filter(Issue.id.in_(issue_ids or [-1]), Issue.issue_status_id.in_(done_status_ids))
            .scalar()
            or 0
        )
        done_pct = round((done_count / max(len(issue_ids), 1)) * 100)
        sprint_summary = f"{active_sprint.name} is {done_pct}% complete."
        sprint_forecast_sprints.append(
            {
                "name": active_sprint.name,
                "tone": "success" if done_pct >= 80 else "warning" if done_pct >= 50 else "danger",
                "verdict": "Active",
                "done_pct": done_pct,
            }
        )

    return {
        "briefing": {
            "headline": f"{p.name} is currently {p.status or 'active'} and {label.lower()}.",
            "health": {"score": score, "tone": tone, "label": label},
            "attention": attention,
        },
        "sprintForecast": {
            "has_sprint": bool(active_sprint),
            "summary": sprint_summary,
            "sprints": sprint_forecast_sprints,
        },
    }


@router.get("/projects/{project_id}/epics")
def list_project_epics(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.epic import Epic
    epics = db.query(Epic).filter(Epic.project_id == project_id, Epic.deleted_at.is_(None)).all()
    return [
        {
            "id": str(item.id),
            "name": item.name,
            "projectId": str(item.project_id),
            "status": item.status,
            "goal": item.goal,
            "color": item.color,
        }
        for item in epics
    ]


@router.get("/users")
def list_users(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.user import User
    roles = _get_user_roles(current_user.id, db)
    query = db.query(User).filter(User.deleted_at.is_(None), User.is_active != 0)
    if not is_system_admin(roles):
        visible_user_ids: set[int] = set()
        for visible_project_id in accessible_project_ids(db, current_user.id, roles):
            visible_user_ids.update(
                entry["user_id"]
                for entry in workforce_service.get_project_workforce(db, visible_project_id)["internal"]
            )
        query = query.filter(User.id.in_(visible_user_ids or {-1}))
    users = query.order_by(User.id).all()
    
    def _initials(name: str | None) -> str:
        parts = [part[0] for part in (name or "").split() if part]
        return "".join(parts[:2]).upper() or "U"

    return [
        {
            "id": str(item.id),
            "name": item.name,
            "email": item.email,
            "initials": _initials(item.name),
            "avatar": item.avatar_url,
            "role": item.role_names[0] if item.role_names else "member",
        }
        for item in users
    ]
