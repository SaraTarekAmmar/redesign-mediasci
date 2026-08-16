"""
Project workforce resolution.

The project workforce is DERIVED from assignments, never stored redundantly:

- Internal resources: users belonging to teams assigned to the project
  (projects.team_id legacy FK + project_teams M2M, team membership via
  team_user and team_resources), plus direct project members and the owner.
- External resources: active members derived from whole-partner, partner-team,
  and direct partner-member assignments.

These functions are the backend source of truth for task-assignment
eligibility; frontend filtering is presentation only.
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.partner import (
    Partner,
    PartnerMember,
    PartnerTeam,
    partner_team_members,
    project_partner_members,
    project_partner_teams,
    project_partners,
)
from app.models.project import Project, project_teams
from app.models.resource import Resource, ResourceAllocation
from app.models.team import Team, team_resources
from app.models.user import User, project_members, team_user


def get_assigned_team_ids(db: Session, project_id: int) -> list[int]:
    """Assigned teams = legacy primary team_id + project_teams M2M, deduped."""
    team_ids: list[int] = []
    project = db.query(Project).filter(Project.id == project_id).first()
    if project and project.team_id:
        team_ids.append(int(project.team_id))
    rows = db.execute(
        select(project_teams.c.team_id).where(project_teams.c.project_id == project_id)
    ).scalars().all()
    for tid in rows:
        if tid is not None and int(tid) not in team_ids:
            team_ids.append(int(tid))
    return team_ids


def get_assigned_partner_ids(db: Session, project_id: int) -> list[int]:
    rows = db.execute(
        select(project_partners.c.partner_id).where(project_partners.c.project_id == project_id)
    ).scalars().all()
    return sorted({int(pid) for pid in rows if pid is not None})


def get_assigned_partner_team_ids(db: Session, project_id: int) -> list[int]:
    rows = db.execute(
        select(project_partner_teams.c.partner_team_id).where(
            project_partner_teams.c.project_id == project_id
        )
    ).scalars().all()
    return sorted({int(team_id) for team_id in rows if team_id is not None})


def get_assigned_partner_member_ids(db: Session, project_id: int) -> list[int]:
    rows = db.execute(
        select(project_partner_members.c.partner_member_id).where(
            project_partner_members.c.project_id == project_id
        )
    ).scalars().all()
    return sorted({int(member_id) for member_id in rows if member_id is not None})


def get_direct_resource_ids(db: Session, project_id: int) -> list[int]:
    rows = db.execute(
        select(ResourceAllocation.resource_id).where(
            ResourceAllocation.project_id == project_id,
            ResourceAllocation.task_id.is_(None),
        )
    ).scalars().all()
    return sorted({int(resource_id) for resource_id in rows if resource_id is not None})


def sync_project_resources(db: Session, project_id: int, resource_ids: list[int]) -> None:
    """Synchronize direct project-level resource allocations only.

    Task-level allocations are deliberately untouched so historical execution
    data is never removed by workforce management.
    """
    current = set(get_direct_resource_ids(db, project_id))
    target = {int(resource_id) for resource_id in resource_ids}
    now = datetime.now(timezone.utc)
    for resource_id in target - current:
        db.add(ResourceAllocation(
            resource_id=resource_id,
            project_id=project_id,
            task_id=None,
            allocation_pct=100,
            created_at=now,
            updated_at=now,
        ))
    if current - target:
        db.query(ResourceAllocation).filter(
            ResourceAllocation.project_id == project_id,
            ResourceAllocation.task_id.is_(None),
            ResourceAllocation.resource_id.in_(current - target),
        ).delete(synchronize_session=False)


def add_team_to_project(db: Session, project_id: int, team_id: int) -> bool:
    """Idempotently link a team. Returns False if already linked."""
    existing = db.execute(
        select(project_teams.c.id).where(
            project_teams.c.project_id == project_id,
            project_teams.c.team_id == team_id,
        )
    ).first()
    if existing:
        return False
    now = datetime.now(timezone.utc)
    db.execute(project_teams.insert().values(
        project_id=project_id, team_id=team_id, created_at=now, updated_at=now,
    ))
    return True


def remove_team_from_project(db: Session, project_id: int, team_id: int) -> None:
    db.execute(project_teams.delete().where(
        project_teams.c.project_id == project_id,
        project_teams.c.team_id == team_id,
    ))
    # Keep the legacy FK consistent with the M2M assignments.
    project = db.query(Project).filter(Project.id == project_id).first()
    if project and project.team_id == team_id:
        remaining = db.execute(
            select(project_teams.c.team_id)
            .where(project_teams.c.project_id == project_id)
            .order_by(project_teams.c.id)
        ).scalars().first()
        project.team_id = remaining


def sync_project_teams(db: Session, project_id: int, team_ids: list[int]) -> None:
    """Replace the project's team assignments with the given list."""
    current = set(get_assigned_team_ids(db, project_id))
    target = {int(t) for t in team_ids}
    for tid in target - current:
        add_team_to_project(db, project_id, tid)
    for tid in current - target:
        remove_team_from_project(db, project_id, tid)
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        if project.team_id and int(project.team_id) not in target:
            project.team_id = None
        if not project.team_id and target:
            project.team_id = sorted(target)[0]


def add_partner_to_project(db: Session, project_id: int, partner_id: int) -> bool:
    existing = db.execute(
        select(project_partners.c.id).where(
            project_partners.c.project_id == project_id,
            project_partners.c.partner_id == partner_id,
        )
    ).first()
    if existing:
        return False
    now = datetime.now(timezone.utc)
    db.execute(project_partners.insert().values(
        project_id=project_id, partner_id=partner_id, created_at=now, updated_at=now,
    ))
    return True


def remove_partner_from_project(db: Session, project_id: int, partner_id: int) -> None:
    """Removes only the project association; the partner and its people are untouched."""
    db.execute(project_partners.delete().where(
        project_partners.c.project_id == project_id,
        project_partners.c.partner_id == partner_id,
    ))


def sync_project_partners(db: Session, project_id: int, partner_ids: list[int]) -> None:
    current = set(get_assigned_partner_ids(db, project_id))
    target = {int(p) for p in partner_ids}
    for pid in target - current:
        add_partner_to_project(db, project_id, pid)
    for pid in current - target:
        remove_partner_from_project(db, project_id, pid)


def add_partner_team_to_project(db: Session, project_id: int, partner_team_id: int) -> bool:
    existing = db.execute(
        select(project_partner_teams.c.id).where(
            project_partner_teams.c.project_id == project_id,
            project_partner_teams.c.partner_team_id == partner_team_id,
        )
    ).first()
    if existing:
        return False
    now = datetime.now(timezone.utc)
    db.execute(project_partner_teams.insert().values(
        project_id=project_id,
        partner_team_id=partner_team_id,
        created_at=now,
        updated_at=now,
    ))
    return True


def remove_partner_team_from_project(db: Session, project_id: int, partner_team_id: int) -> None:
    db.execute(project_partner_teams.delete().where(
        project_partner_teams.c.project_id == project_id,
        project_partner_teams.c.partner_team_id == partner_team_id,
    ))


def sync_project_partner_teams(db: Session, project_id: int, partner_team_ids: list[int]) -> None:
    current = set(get_assigned_partner_team_ids(db, project_id))
    target = {int(team_id) for team_id in partner_team_ids}
    for team_id in target - current:
        add_partner_team_to_project(db, project_id, team_id)
    for team_id in current - target:
        remove_partner_team_from_project(db, project_id, team_id)


def add_partner_member_to_project(db: Session, project_id: int, partner_member_id: int) -> bool:
    existing = db.execute(
        select(project_partner_members.c.id).where(
            project_partner_members.c.project_id == project_id,
            project_partner_members.c.partner_member_id == partner_member_id,
        )
    ).first()
    if existing:
        return False
    now = datetime.now(timezone.utc)
    db.execute(project_partner_members.insert().values(
        project_id=project_id,
        partner_member_id=partner_member_id,
        created_at=now,
        updated_at=now,
    ))
    return True


def remove_partner_member_from_project(db: Session, project_id: int, partner_member_id: int) -> None:
    db.execute(project_partner_members.delete().where(
        project_partner_members.c.project_id == project_id,
        project_partner_members.c.partner_member_id == partner_member_id,
    ))


def sync_project_partner_members(db: Session, project_id: int, partner_member_ids: list[int]) -> None:
    current = set(get_assigned_partner_member_ids(db, project_id))
    target = {int(member_id) for member_id in partner_member_ids}
    for member_id in target - current:
        add_partner_member_to_project(db, project_id, member_id)
    for member_id in current - target:
        remove_partner_member_from_project(db, project_id, member_id)


def _internal_user_entries(db: Session, project_id: int) -> list[dict]:
    """Resolve internal workforce, deduped by user, with source teams preserved."""
    team_ids = get_assigned_team_ids(db, project_id)
    teams_by_id: dict[int, Team] = {}
    if team_ids:
        teams_by_id = {
            t.id: t
            for t in db.query(Team).filter(Team.id.in_(team_ids), Team.deleted_at.is_(None)).all()
        }

    # user_id -> {team_id, ...}
    user_team_map: dict[int, set[int]] = {}
    if team_ids:
        for uid, tid in db.execute(
            select(team_user.c.user_id, team_user.c.team_id).where(team_user.c.team_id.in_(team_ids))
        ).all():
            if uid is not None:
                user_team_map.setdefault(int(uid), set()).add(int(tid))
        # Team membership tracked through workforce resources linked to users
        for uid, tid in db.execute(
            select(Resource.user_id, team_resources.c.team_id)
            .select_from(team_resources.join(Resource, team_resources.c.resource_id == Resource.id))
            .where(team_resources.c.team_id.in_(team_ids), Resource.user_id.isnot(None))
        ).all():
            if uid is not None:
                user_team_map.setdefault(int(uid), set()).add(int(tid))

    # Direct project members, direct resource allocations, and the owner remain
    # eligible independently of teams.
    direct_ids: set[int] = set()
    for (uid,) in db.execute(
        select(project_members.c.user_id).where(project_members.c.project_id == project_id)
    ).all():
        if uid is not None:
            direct_ids.add(int(uid))
    project = db.query(Project).filter(Project.id == project_id).first()
    if project and project.owner_id:
        direct_ids.add(int(project.owner_id))

    direct_resource_map: dict[int, int] = {}
    for user_id, resource_id in db.execute(
        select(Resource.user_id, Resource.id)
        .select_from(
            ResourceAllocation.__table__.join(
                Resource, Resource.id == ResourceAllocation.resource_id
            )
        )
        .where(
            ResourceAllocation.project_id == project_id,
            ResourceAllocation.task_id.is_(None),
            Resource.user_id.isnot(None),
            Resource.is_active != 0,
        )
    ).all():
        if user_id is not None:
            direct_resource_map[int(user_id)] = int(resource_id)

    all_ids = set(user_team_map) | direct_ids | set(direct_resource_map)
    if not all_ids:
        return []

    users = db.query(User).filter(
        User.id.in_(all_ids),
        User.deleted_at.is_(None),
        User.is_active != False,  # noqa: E712
    ).all()
    resources = {
        r.user_id: r
        for r in db.query(Resource).filter(Resource.user_id.in_(all_ids)).all()
    }

    entries = []
    for u in sorted(users, key=lambda x: (x.name or "").lower()):
        source_teams = [
            {"id": tid, "name": teams_by_id[tid].name, "color": teams_by_id[tid].color}
            for tid in sorted(user_team_map.get(u.id, set()))
            if tid in teams_by_id
        ]
        resource = resources.get(u.id)
        entries.append({
            "type": "internal",
            "user_id": u.id,
            "resource_id": resource.id if resource else None,
            "name": u.name,
            "email": u.email,
            "avatar": u.avatar_url,
            "title": (resource.position if resource else None) or u.position or u.job_title,
            "teams": source_teams,
            "is_direct_member": u.id in direct_ids,
            "is_direct_resource": u.id in direct_resource_map,
            "sources": [
                *[
                    {"type": "internal_team", "id": team["id"], "name": team["name"]}
                    for team in source_teams
                ],
                *([{"type": "direct_member", "id": u.id, "name": "Direct project member"}]
                  if u.id in direct_ids else []),
                *([{"type": "direct_resource", "id": direct_resource_map[u.id], "name": "Direct resource allocation"}]
                  if u.id in direct_resource_map else []),
            ],
        })
    return entries


def _external_member_entries(db: Session, project_id: int) -> list[dict]:
    whole_partner_ids = set(get_assigned_partner_ids(db, project_id))
    assigned_team_ids = set(get_assigned_partner_team_ids(db, project_id))
    direct_member_ids = set(get_assigned_partner_member_ids(db, project_id))

    eligible_member_ids: set[int] = set()
    member_team_map: dict[int, list[dict]] = {}

    if whole_partner_ids:
        eligible_member_ids.update(
            int(member_id)
            for member_id in db.execute(
                select(PartnerMember.id)
                .select_from(PartnerMember.__table__.join(Partner, Partner.id == PartnerMember.partner_id))
                .where(
                    PartnerMember.partner_id.in_(whole_partner_ids),
                    PartnerMember.deleted_at.is_(None),
                    PartnerMember.is_active != 0,
                    Partner.deleted_at.is_(None),
                    (Partner.status.is_(None)) | (Partner.status != "inactive"),
                )
            ).scalars().all()
        )

    if assigned_team_ids:
        team_rows = db.execute(
            select(
                PartnerMember.id,
                PartnerTeam.id,
                PartnerTeam.name,
            )
            .select_from(
                partner_team_members
                .join(PartnerTeam, PartnerTeam.id == partner_team_members.c.partner_team_id)
                .join(PartnerMember, PartnerMember.id == partner_team_members.c.partner_member_id)
                .join(Partner, Partner.id == PartnerTeam.partner_id)
            )
            .where(
                PartnerTeam.id.in_(assigned_team_ids),
                PartnerTeam.deleted_at.is_(None),
                PartnerTeam.is_active != 0,
                PartnerMember.deleted_at.is_(None),
                PartnerMember.is_active != 0,
                Partner.deleted_at.is_(None),
                (Partner.status.is_(None)) | (Partner.status != "inactive"),
            )
        ).all()
        for member_id, team_id, team_name in team_rows:
            eligible_member_ids.add(int(member_id))
            member_team_map.setdefault(int(member_id), []).append({
                "id": int(team_id),
                "name": team_name,
            })

    eligible_member_ids.update(direct_member_ids)
    if not eligible_member_ids:
        return []

    # Organizational team memberships (independent of project assignment).
    # Preserves partner → team → member visibility even when a person is
    # assigned directly or via whole-partner eligibility.
    org_team_map: dict[int, list[dict]] = {}
    for member_id, team_id, team_name in db.execute(
        select(
            PartnerMember.id,
            PartnerTeam.id,
            PartnerTeam.name,
        )
        .select_from(
            partner_team_members
            .join(PartnerTeam, PartnerTeam.id == partner_team_members.c.partner_team_id)
            .join(PartnerMember, PartnerMember.id == partner_team_members.c.partner_member_id)
        )
        .where(
            PartnerMember.id.in_(eligible_member_ids),
            PartnerTeam.deleted_at.is_(None),
            PartnerTeam.is_active != 0,
            PartnerMember.deleted_at.is_(None),
            PartnerMember.is_active != 0,
        )
    ).all():
        teams = org_team_map.setdefault(int(member_id), [])
        team_entry = {"id": int(team_id), "name": team_name}
        if team_entry not in teams:
            teams.append(team_entry)

    rows = (
        db.query(PartnerMember, Partner)
        .join(Partner, PartnerMember.partner_id == Partner.id)
        .filter(
            PartnerMember.id.in_(eligible_member_ids),
            PartnerMember.deleted_at.is_(None),
            PartnerMember.is_active != 0,
            Partner.deleted_at.is_(None),
            (Partner.status.is_(None)) | (Partner.status != "inactive"),
        )
        .all()
    )
    entries = []
    for member, partner in sorted(rows, key=lambda row: (row[0].name or "").lower()):
        eligibility_teams = sorted(
            member_team_map.get(member.id, []),
            key=lambda team: (team["name"] or "").lower(),
        )
        org_teams = sorted(
            org_team_map.get(member.id, []),
            key=lambda team: (team["name"] or "").lower(),
        )
        sources = []
        if partner.id in whole_partner_ids:
            sources.append({"type": "partner", "id": partner.id, "name": partner.name})
        sources.extend(
            {"type": "partner_team", "id": team["id"], "name": team["name"]}
            for team in eligibility_teams
        )
        if member.id in direct_member_ids:
            sources.append({"type": "direct_partner_member", "id": member.id, "name": member.name})
        entries.append({
            "type": "external",
            "member_id": member.id,
            "user_id": member.user_id,
            "name": member.name,
            "email": member.email,
            "title": member.role,
            "partner": {"id": partner.id, "name": partner.name, "color": partner.color},
            # Organizational affiliation for management visibility.
            "teams": org_teams,
            "is_direct_member": member.id in direct_member_ids,
            "is_org_direct_member": len(org_teams) == 0,
            "sources": sources,
        })
    return entries


def get_project_workforce(db: Session, project_id: int) -> dict:
    return {
        "internal": _internal_user_entries(db, project_id),
        "external": _external_member_entries(db, project_id),
    }


def is_user_eligible_for_project(db: Session, project_id: int, user_id: int) -> bool:
    """A user may be assigned project tasks only when part of the project workforce."""
    active_user = db.query(User.id).filter(
        User.id == user_id,
        User.deleted_at.is_(None),
        User.is_active != False,  # noqa: E712
    ).first()
    if not active_user:
        return False
    project = db.query(Project).filter(Project.id == project_id).first()
    if project and project.owner_id == user_id:
        return True
    member = db.execute(
        select(project_members.c.id).where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
    ).first()
    if member:
        return True
    direct_resource = db.execute(
        select(ResourceAllocation.id)
        .select_from(
            ResourceAllocation.__table__.join(
                Resource, Resource.id == ResourceAllocation.resource_id
            )
        )
        .where(
            ResourceAllocation.project_id == project_id,
            ResourceAllocation.task_id.is_(None),
            Resource.user_id == user_id,
            Resource.is_active != 0,
        )
    ).first()
    if direct_resource:
        return True
    team_ids = get_assigned_team_ids(db, project_id)
    if not team_ids:
        return False
    via_users = db.execute(
        select(team_user.c.id).where(
            team_user.c.team_id.in_(team_ids),
            team_user.c.user_id == user_id,
        )
    ).first()
    if via_users:
        return True
    via_resources = db.execute(
        select(team_resources.c.id)
        .select_from(team_resources.join(Resource, team_resources.c.resource_id == Resource.id))
        .where(team_resources.c.team_id.in_(team_ids), Resource.user_id == user_id)
    ).first()
    return bool(via_resources)


def is_partner_member_eligible_for_project(db: Session, project_id: int, member_id: int) -> bool:
    return any(
        entry["member_id"] == member_id
        for entry in _external_member_entries(db, project_id)
    )
