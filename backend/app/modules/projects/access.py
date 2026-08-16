"""Central project-access policy.

Global RBAC decides *what* an authenticated user may do.  This module decides
*where* those capabilities apply.  Access is derived from the existing
workforce relationships rather than copied into a second access table.
"""
from __future__ import annotations

from typing import Iterable, Mapping

from fastapi import HTTPException, status
from sqlalchemy import Select, select, union
from sqlalchemy.orm import Session

from app.models.client import Client, ClientContact
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
from app.models.team import team_resources
from app.models.user import project_members, team_user


ADMIN_ROLES = {"super-admin", "admin"}


def is_system_admin(role_names: Iterable[str]) -> bool:
    """Admins are the only roles that bypass project visibility controls."""
    return bool(ADMIN_ROLES.intersection({str(role).lower() for role in role_names}))


def accessible_project_ids_query(user_id: int) -> Select:
    """Return one SQL expression containing every legitimate access source.

    The union intentionally includes both legacy ``projects.team_id`` and the
    authoritative many-to-many assignment tables so existing data remains
    accessible during the migration period.
    """
    active_project = Project.deleted_at.is_(None)
    active_user_resource = Resource.user_id == user_id
    active_partner_member = (
        (PartnerMember.user_id == user_id)
        & PartnerMember.deleted_at.is_(None)
        & (PartnerMember.is_active != 0)
    )
    active_partner = Partner.deleted_at.is_(None) & (
        Partner.status.is_(None) | (Partner.status != "inactive")
    )

    owner = select(Project.id.label("project_id")).where(
        active_project,
        Project.owner_id == user_id,
    )
    direct_member = (
        select(project_members.c.project_id.label("project_id"))
        .select_from(project_members.join(Project, Project.id == project_members.c.project_id))
        .where(active_project, project_members.c.user_id == user_id)
    )
    assigned_team_user = (
        select(project_teams.c.project_id.label("project_id"))
        .select_from(
            project_teams
            .join(Project, Project.id == project_teams.c.project_id)
            .join(team_user, team_user.c.team_id == project_teams.c.team_id)
        )
        .where(active_project, team_user.c.user_id == user_id)
    )
    legacy_team_user = (
        select(Project.id.label("project_id"))
        .select_from(Project.__table__.join(team_user, team_user.c.team_id == Project.team_id))
        .where(active_project, team_user.c.user_id == user_id)
    )
    assigned_team_resource = (
        select(project_teams.c.project_id.label("project_id"))
        .select_from(
            project_teams
            .join(Project, Project.id == project_teams.c.project_id)
            .join(team_resources, team_resources.c.team_id == project_teams.c.team_id)
            .join(Resource, Resource.id == team_resources.c.resource_id)
        )
        .where(active_project, active_user_resource, Resource.is_active != 0)
    )
    legacy_team_resource = (
        select(Project.id.label("project_id"))
        .select_from(
            Project.__table__
            .join(team_resources, team_resources.c.team_id == Project.team_id)
            .join(Resource, Resource.id == team_resources.c.resource_id)
        )
        .where(active_project, active_user_resource, Resource.is_active != 0)
    )
    direct_resource = (
        select(ResourceAllocation.project_id.label("project_id"))
        .select_from(
            ResourceAllocation.__table__
            .join(Resource, Resource.id == ResourceAllocation.resource_id)
            .join(Project, Project.id == ResourceAllocation.project_id)
        )
        .where(
            active_project,
            active_user_resource,
            Resource.is_active != 0,
            ResourceAllocation.task_id.is_(None),
            ResourceAllocation.project_id.isnot(None),
        )
    )
    whole_partner = (
        select(project_partners.c.project_id.label("project_id"))
        .select_from(
            project_partners
            .join(Project, Project.id == project_partners.c.project_id)
            .join(Partner, Partner.id == project_partners.c.partner_id)
            .join(PartnerMember, PartnerMember.partner_id == Partner.id)
        )
        .where(active_project, active_partner, active_partner_member)
    )
    assigned_partner_team = (
        select(project_partner_teams.c.project_id.label("project_id"))
        .select_from(
            project_partner_teams
            .join(Project, Project.id == project_partner_teams.c.project_id)
            .join(PartnerTeam, PartnerTeam.id == project_partner_teams.c.partner_team_id)
            .join(Partner, Partner.id == PartnerTeam.partner_id)
            .join(partner_team_members, partner_team_members.c.partner_team_id == PartnerTeam.id)
            .join(PartnerMember, PartnerMember.id == partner_team_members.c.partner_member_id)
        )
        .where(
            active_project,
            active_partner,
            active_partner_member,
            PartnerTeam.deleted_at.is_(None),
            PartnerTeam.is_active != 0,
        )
    )
    direct_partner_member = (
        select(project_partner_members.c.project_id.label("project_id"))
        .select_from(
            project_partner_members
            .join(Project, Project.id == project_partner_members.c.project_id)
            .join(PartnerMember, PartnerMember.id == project_partner_members.c.partner_member_id)
            .join(Partner, Partner.id == PartnerMember.partner_id)
        )
        .where(active_project, active_partner, active_partner_member)
    )
    # A client contact linked to a login (ClientContact.user_id) sees every project billed
    # to their client record — the client-portal counterpart to the partner branches above.
    client_project = (
        select(Project.id.label("project_id"))
        .select_from(
            ClientContact.__table__
            .join(Client, Client.id == ClientContact.client_id)
            .join(Project, Project.client_id == Client.id)
        )
        .where(active_project, ClientContact.user_id == user_id)
    )

    return union(
        owner,
        direct_member,
        assigned_team_user,
        legacy_team_user,
        assigned_team_resource,
        legacy_team_resource,
        direct_resource,
        whole_partner,
        assigned_partner_team,
        direct_partner_member,
        client_project,
    )


def accessible_project_ids(db: Session, user_id: int, role_names: Iterable[str]) -> set[int]:
    if is_system_admin(role_names):
        rows = db.execute(
            select(Project.id).where(Project.deleted_at.is_(None))
        ).scalars().all()
    else:
        rows = db.execute(accessible_project_ids_query(user_id)).scalars().all()
    return {int(project_id) for project_id in rows if project_id is not None}


def require_project_access(
    db: Session,
    user_id: int,
    role_names: Iterable[str],
    project_id: int,
) -> None:
    """Raise 403 unless the user may work in ``project_id``."""
    if is_system_admin(role_names):
        return
    access = accessible_project_ids_query(user_id).subquery("accessible_projects")
    allowed = db.execute(
        select(access.c.project_id).where(access.c.project_id == int(project_id)).limit(1)
    ).first()
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this project.",
        )


def require_any_project_access(
    db: Session,
    user_id: int,
    role_names: Iterable[str],
    project_ids: Iterable[int],
) -> None:
    """Allow a shared record when at least one of its projects is accessible."""
    if is_system_admin(role_names):
        return
    candidates = {int(project_id) for project_id in project_ids if project_id is not None}
    if not candidates.intersection(accessible_project_ids(db, user_id, role_names)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this record's project.",
        )


def filter_query_by_project_access(query, project_column, user_id: int, role_names: Iterable[str]):
    """Apply the same access policy to a project-scoped list query."""
    if is_system_admin(role_names):
        return query
    return query.filter(project_column.in_(accessible_project_ids_query(user_id)))


def _positive_int(value) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def request_project_ids(
    db: Session,
    path_params: Mapping[str, object],
    query_params: Mapping[str, object],
) -> set[int]:
    """Resolve project scope for common direct and nested API resources."""
    project_ids: set[int] = set()
    for key in ("project_id", "source_project_id"):
        value = _positive_int(path_params.get(key) or query_params.get(key))
        if value:
            project_ids.add(value)

    issue_id = _positive_int(path_params.get("issue_id") or query_params.get("issue_id"))
    if issue_id:
        from app.models.issue import Issue

        value = db.execute(select(Issue.project_id).where(Issue.id == issue_id)).scalar_one_or_none()
        if value:
            project_ids.add(int(value))

    sprint_id = _positive_int(path_params.get("sprint_id") or query_params.get("sprint_id"))
    if sprint_id:
        from app.models.sprint import Sprint

        value = db.execute(select(Sprint.project_id).where(Sprint.id == sprint_id)).scalar_one_or_none()
        if value:
            project_ids.add(int(value))

    risk_id = _positive_int(path_params.get("risk_id"))
    if risk_id:
        from app.models.risk import Risk

        value = db.execute(select(Risk.project_id).where(Risk.id == risk_id)).scalar_one_or_none()
        if value:
            project_ids.add(int(value))

    change_request_id = _positive_int(path_params.get("cr_id"))
    if change_request_id:
        from app.models.change_request import ChangeRequest

        value = db.execute(
            select(ChangeRequest.project_id).where(ChangeRequest.id == change_request_id)
        ).scalar_one_or_none()
        if value:
            project_ids.add(int(value))

    document_id = _positive_int(path_params.get("doc_id"))
    if document_id:
        from app.models.misc import ProjectDocument

        value = db.execute(
            select(ProjectDocument.project_id).where(ProjectDocument.id == document_id)
        ).scalar_one_or_none()
        if value:
            project_ids.add(int(value))

    milestone_id = _positive_int(path_params.get("milestone_id"))
    if milestone_id:
        from app.models.planning import ProjectMilestone

        value = db.execute(
            select(ProjectMilestone.project_id).where(ProjectMilestone.id == milestone_id)
        ).scalar_one_or_none()
        if value:
            project_ids.add(int(value))

    deliverable_id = _positive_int(path_params.get("deliverable_id"))
    if deliverable_id:
        from app.models.planning import ProjectDeliverable, ProjectMilestone

        value = db.execute(
            select(ProjectMilestone.project_id)
            .select_from(
                ProjectDeliverable.__table__.join(
                    ProjectMilestone, ProjectMilestone.id == ProjectDeliverable.milestone_id
                )
            )
            .where(ProjectDeliverable.id == deliverable_id)
        ).scalar_one_or_none()
        if value:
            project_ids.add(int(value))

    scope_id = _positive_int(path_params.get("scope_id"))
    if scope_id:
        from app.models.scope import Scope

        value = db.execute(select(Scope.project_id).where(Scope.id == scope_id)).scalar_one_or_none()
        if value:
            project_ids.add(int(value))

    workflow_id = _positive_int(path_params.get("workflow_id"))
    if workflow_id:
        from app.models.workflow import Workflow

        value = db.execute(select(Workflow.project_id).where(Workflow.id == workflow_id)).scalar_one_or_none()
        if value:
            project_ids.add(int(value))

    validation_rule_id = _positive_int(path_params.get("rule_id"))
    if validation_rule_id:
        from app.models.misc import ValidationRule

        value = db.execute(
            select(ValidationRule.project_id).where(ValidationRule.id == validation_rule_id)
        ).scalar_one_or_none()
        if value:
            project_ids.add(int(value))

    return project_ids


def enforce_request_project_access(
    db: Session,
    user_id: int,
    role_names: Iterable[str],
    path_params: Mapping[str, object],
    query_params: Mapping[str, object],
) -> None:
    if is_system_admin(role_names):
        return
    stakeholder_id = _positive_int(path_params.get("stakeholder_id"))
    if stakeholder_id:
        from app.models.project import stakeholder_project

        stakeholder_projects = {
            int(project_id)
            for project_id in db.execute(
                select(stakeholder_project.c.project_id).where(
                    stakeholder_project.c.stakeholder_id == stakeholder_id
                )
            ).scalars().all()
        }
        allowed_projects = accessible_project_ids(db, user_id, role_names)
        if not stakeholder_projects.intersection(allowed_projects):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this stakeholder's projects.",
            )
    for project_id in request_project_ids(db, path_params, query_params):
        require_project_access(db, user_id, role_names, project_id)
