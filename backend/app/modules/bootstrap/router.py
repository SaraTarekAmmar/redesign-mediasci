from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.dependencies import _fallback_permissions_for_roles
from app.models.client import Client, ClientRequest, Proposal
from app.models.epic import Epic
from app.models.issue import Issue, IssueLabel, IssuePriority, IssueStatus, IssueType, TaskDependency, sprint_issues
from app.models.misc import ProjectDocument, ValidationRule
from app.models.project import Project
from app.models.risk import Risk
from app.models.resource import Resource

from app.models.stakeholder import Stakeholder
from app.models.sprint import Sprint
from app.models.team import Department
from app.models.user import (
    Permission, Role, User, model_has_permissions, role_has_permissions, user_roles_table,
)
from app.modules.projects import repository as project_repo
from app.modules.projects.access import accessible_project_ids_query, is_system_admin
from app.modules.projects import workforce as workforce_service

router = APIRouter(tags=["spa-bootstrap"])


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _slug(value: str | None) -> str:
    return (value or "").strip().lower().replace(" ", "-")


def _initials(name: str | None) -> str:
    parts = [part[0] for part in (name or "").split() if part]
    return "".join(parts[:2]).upper() or "U"


@router.get("/sanctum/csrf-cookie", status_code=204)
def csrf_cookie() -> Response:
    response = Response(status_code=204)
    response.set_cookie(
        key="XSRF-TOKEN",
        value=uuid4().hex,
        httponly=False,
        samesite="lax",
        secure=False,
        path="/",
    )
    return response


@router.post("/locale")
def set_locale(response: Response, payload: dict = Body(default={})) -> dict:
    locale = str(payload.get("locale") or "en").strip()[:10] or "en"
    response.set_cookie(
        key="taskflow_locale",
        value=locale,
        httponly=False,
        samesite="lax",
        secure=False,
        path="/",
    )
    return {"locale": locale}


@router.get("/spa/bootstrap")
def spa_bootstrap(
    response: Response,
    project: str | None = Query(default=None),
    project_ids: list[int] = Query(default=[]),
    project_ids_bracket: list[int] = Query(default=[], alias="project_ids[]"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    role_names = db.execute(
        select(Role.name)
        .select_from(user_roles_table.join(Role, user_roles_table.c.role_id == Role.id))
        .where(
            user_roles_table.c.model_id == current_user.id,
            user_roles_table.c.model_type.like("%User"),
        )
    ).scalars().all()
    direct_permission_names = db.execute(
        select(Permission.name)
        .select_from(model_has_permissions.join(Permission, model_has_permissions.c.permission_id == Permission.id))
        .where(
            model_has_permissions.c.model_id == current_user.id,
            model_has_permissions.c.model_type.like("%User"),
        )
    ).scalars().all()
    role_permission_names = db.execute(
        select(Permission.name)
        .select_from(
            user_roles_table
            .join(Role, user_roles_table.c.role_id == Role.id)
            .join(role_has_permissions, role_has_permissions.c.role_id == Role.id)
            .join(Permission, role_has_permissions.c.permission_id == Permission.id)
        )
        .where(
            user_roles_table.c.model_id == current_user.id,
            user_roles_table.c.model_type.like("%User"),
        )
    ).scalars().all()
    permission_names = sorted(
        set(direct_permission_names)
        | set(role_permission_names)
        | _fallback_permissions_for_roles(set(role_names))
    )

    visible_projects_query = select(Project).where(Project.deleted_at.is_(None)).order_by(Project.id)
    if not is_system_admin(role_names):
        visible_projects_query = visible_projects_query.where(
            Project.id.in_(accessible_project_ids_query(current_user.id))
        )

    visible_projects = db.execute(visible_projects_query).scalars().all()
    visible_project_ids = {item.id for item in visible_projects}
    requested_ids = [*project_ids, *project_ids_bracket]

    if project == "all":
        selected_ids = [item.id for item in visible_projects]
        scope_mode = "all"
    elif requested_ids:
        selected_ids = [item_id for item_id in requested_ids if item_id in visible_project_ids]
        scope_mode = "multi" if len(selected_ids) > 1 else "single"
    elif project and project.isdigit() and int(project) in visible_project_ids:
        selected_ids = [int(project)]
        scope_mode = "single"
    elif visible_projects:
        selected_ids = [visible_projects[0].id]
        scope_mode = "single"
    else:
        selected_ids = []
        scope_mode = "empty"

    selected_projects = [item for item in visible_projects if item.id in selected_ids] or visible_projects[:1]
    primary_project = selected_projects[0] if selected_projects else None
    selected_ids = [item.id for item in selected_projects]

    internal_user_ids: set[int] = set()
    if not is_system_admin(role_names):
        for selected_project_id in selected_ids:
            internal_user_ids.update(
                int(entry["user_id"])
                for entry in workforce_service.get_project_workforce(db, selected_project_id)["internal"]
            )

    users_query = select(User).where(User.deleted_at.is_(None)).order_by(User.id)
    if not is_system_admin(role_names):
        users_query = users_query.where(User.id.in_(internal_user_ids or {-1}))
    users = db.execute(users_query).scalars().all()
    issue_types = project_repo.get_project_types(db)
    statuses = db.execute(
        select(IssueStatus)
        .where((IssueStatus.project_id.is_(None)) | (IssueStatus.project_id.in_(selected_ids or [-1])))
        .order_by(IssueStatus.position, IssueStatus.id)
    ).scalars().all()
    priorities = db.execute(select(IssuePriority).order_by(IssuePriority.level.asc(), IssuePriority.id)).scalars().all()
    labels = db.execute(
        select(IssueLabel)
        .where((IssueLabel.project_id.is_(None)) | (IssueLabel.project_id.in_(selected_ids or [-1])))
        .order_by(IssueLabel.id)
    ).scalars().all()
    epics = db.execute(select(Epic).where(Epic.project_id.in_(selected_ids or [-1])).order_by(Epic.id)).scalars().all()
    sprints = db.execute(select(Sprint).where(Sprint.project_id.in_(selected_ids or [-1])).order_by(Sprint.id)).scalars().all()

    sprint_rows = db.execute(
        select(sprint_issues.c.issue_id, sprint_issues.c.sprint_id, sprint_issues.c.position).where(
            sprint_issues.c.sprint_id.in_([item.id for item in sprints] or [-1])
        )
    ).all()
    sprint_map = {row.issue_id: {"sprintId": row.sprint_id, "position": row.position} for row in sprint_rows}

    issues = db.execute(
        select(Issue)
        .options(
            joinedload(Issue.project),
            joinedload(Issue.type),
            joinedload(Issue.status),
            joinedload(Issue.priority),
            joinedload(Issue.labels),
        )
        .where(Issue.project_id.in_(selected_ids or [-1]), Issue.deleted_at.is_(None))
        .order_by(Issue.id)
    ).unique().scalars().all()

    dependencies = db.execute(
        select(TaskDependency).where(TaskDependency.issue_id.in_([item.id for item in issues] or [-1]))
    ).scalars().all()
    dependency_map: dict[int, list[dict]] = {}
    for dependency in dependencies:
        dependency_map.setdefault(dependency.issue_id, []).append(
            {
                "id": dependency.id,
                "dependsOnId": dependency.depends_on_id,
                "type": dependency.type,
            }
        )

    visible_client_ids = {
        int(item.client_id) for item in visible_projects if item.client_id is not None
    }
    clients_query = select(Client).order_by(Client.id)
    requests_query = select(ClientRequest).order_by(ClientRequest.id)
    if not is_system_admin(role_names):
        clients_query = clients_query.where(Client.id.in_(visible_client_ids or {-1}))
        requests_query = requests_query.where(ClientRequest.client_id.in_(visible_client_ids or {-1}))
    clients = db.execute(clients_query).scalars().all()
    client_requests = db.execute(requests_query).scalars().all()
    visible_request_ids = {int(item.id) for item in client_requests}
    proposals_query = select(Proposal).order_by(Proposal.id)
    if not is_system_admin(role_names):
        proposals_query = proposals_query.where(Proposal.client_request_id.in_(visible_request_ids or {-1}))
    proposals = db.execute(proposals_query).scalars().all()
    risks = db.execute(select(Risk).where(Risk.project_id.in_(selected_ids or [-1])).order_by(Risk.id)).scalars().all()
    resources_query = select(Resource).order_by(Resource.id)
    if not is_system_admin(role_names):
        resources_query = resources_query.where(Resource.user_id.in_(internal_user_ids or {-1}))
    resources = db.execute(resources_query).scalars().all()
    stakeholders_query = select(Stakeholder).order_by(Stakeholder.id)
    if not is_system_admin(role_names):
        stakeholders_query = stakeholders_query.where(
            Stakeholder.projects.any(Project.id.in_(selected_ids or [-1]))
        )
    stakeholders = db.execute(stakeholders_query).scalars().all()
    departments = db.execute(select(Department).order_by(Department.id)).scalars().all()
    documents = db.execute(select(ProjectDocument).where(ProjectDocument.project_id.in_(selected_ids or [-1]))).scalars().all()
    validation_rules = db.execute(
        select(ValidationRule).where(ValidationRule.project_id.in_(selected_ids or [-1]))
    ).scalars().all()

    response.headers["Cache-Control"] = "no-store"

    return {
        "user": {
            "id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "role": role_names[0] if role_names else "member",
            "permissions": permission_names,
        },
        "project": None if primary_project is None else {
            "id": str(primary_project.id),
            "name": primary_project.name,
            "key": primary_project.key,
            "type": primary_project.type or "scrum",
            "category": primary_project.category or "Software",
            "classification": primary_project.classification or "standard",
            "presale_type": primary_project.presale_type,
            "status": primary_project.status,
            "issueCount": sum(1 for item in issues if item.project_id == primary_project.id),
            "client_request_id": str(primary_project.client_request_id) if primary_project.client_request_id else None,
            "settings": primary_project.settings or {},
        },
        "projects": [
            {
                "id": str(item.id),
                "name": item.name,
                "key": item.key,
                "type": item.type or "scrum",
                "category": item.category or "Software",
                "classification": item.classification or "standard",
                "presale_type": item.presale_type,
                "status": item.status,
                "issueCount": sum(1 for issue in issues if issue.project_id == item.id),
                "client_request_id": str(item.client_request_id) if item.client_request_id else None,
                "settings": item.settings or {},
            }
            for item in visible_projects
        ],
        "projectScope": {
            "mode": scope_mode if selected_projects else "empty",
            "projectIds": [str(i) for i in selected_ids],
            "primaryProjectId": str(primary_project.id) if primary_project else "",
            "label": "All Projects" if project == "all" else (primary_project.name if primary_project else "No Project"),
            "projectNames": [p.name for p in selected_projects],
            "selectedIds": selected_ids,
            "isAll": project == "all",
        },
        "users": [
            {
                "id": str(item.id),
                "name": item.name,
                "email": item.email,
                "initials": _initials(item.name),
                "avatar": item.avatar_url,
                "role": item.role_names[0] if item.role_names else "member",
            }
            for item in users
        ],
        "issueTypes": [
            {
                "id": str(item.id),
                "name": item.name,
                "key": _slug(item.name),
                "icon": item.icon,
                "color": item.color,
            }
            for item in issue_types
        ],
        "statuses": [
            {
                "id": str(item.id),
                "name": item.name,
                "key": _slug(item.name),
                "color": item.color,
                "category": item.category,
            }
            for item in statuses
        ],
        "priorities": [
            {
                "id": str(item.id),
                "name": item.name,
                "key": _slug(item.name),
                "color": item.color,
                "level": item.weight,
            }
            for item in priorities
        ],
        "labels": [{"id": str(item.id), "name": item.name, "color": item.color} for item in labels],
        "epics": [
            {
                "id": str(item.id),
                "name": item.name,
                "projectId": str(item.project_id),
                "status": item.status,
                "goal": item.goal,
                "color": item.color,
            }
            for item in epics
        ],
        "sprints": [
            {
                "id": str(item.id),
                "name": item.name,
                "projectId": str(item.project_id),
                "goal": item.goal,
                "status": item.status,
                "startDate": item.start_date.isoformat() if item.start_date else None,
                "endDate": item.end_date.isoformat() if item.end_date else None,
            }
            for item in sprints
        ],
        "issues": [
            {
                "id": str(item.id),
                "key": item.key,
                "title": item.title,
                "description": item.description,
                "projectId": str(item.project_id),
                "typeKey": _slug(item.type.name if item.type else "task"),
                "statusId": str(item.issue_status_id) if item.issue_status_id else "",
                "priorityId": str(item.issue_priority_id) if item.issue_priority_id else "",
                "assigneeId": str(item.assignee_id) if item.assignee_id else None,
                "externalAssigneeId": str(item.external_assignee_id) if item.external_assignee_id else None,
                "reporterId": str(item.reporter_id) if item.reporter_id else None,
                "reportedTo": [str(x) for x in (item.reported_to or [])],
                "epicId": str(item.epic_id) if item.epic_id else None,
                "sprintId": str(sprint_map.get(item.id, {}).get("sprintId")) if sprint_map.get(item.id, {}).get("sprintId") else None,
                "labelIds": [str(label.id) for label in item.labels],
                "storyPoints": item.story_points,
                "dueDate": item.due_date.isoformat() if item.due_date else None,
                "customFields": item.custom_fields or {},
                "workstream": None,
                "position": sprint_map.get(item.id, {}).get("position", item.position),
                "comments": [],
                "createdAt": _iso(item.created_at),
                "updatedAt": _iso(item.updated_at),
                "dependencies": dependency_map.get(item.id, []),
            }
            for item in issues
        ],
        "risks": [
            {
                "id": str(item.id),
                "title": item.title,
                "severity": item.severity,
                "status": item.status,
                "ownerId": str(item.owner_user_id) if item.owner_user_id else None,
                "projectId": str(item.project_id) if item.project_id else None,
            }
            for item in risks
        ],
        "resources": [
            {
                "id": str(item.id),
                "name": item.name,
                "type": item.contract_type,
                "email": item.email,
                "departmentId": str(item.department_id) if item.department_id else None,
                "role": item.role,
                "availability": item.availability_status,
                "status": "active" if item.is_active else "inactive",
            }
            for item in resources
        ],
        "expenses": [],
        "cloudServices": [],
        "softwareLicenses": [],
        "stakeholders": [
            {
                "id": str(item.id),
                "name": item.name,
                "role": item.role,
                "organization": item.organization,
                "influence": item.influence_level,
                "interest": item.interest_level,
            }
            for item in stakeholders
        ],
        "timeLogs": [],
        "changeRequests": [],
        "milestones": [],
        "deliverables": [],
        "objectives": [],
        "scopeMeta": {},
        "departments": [{"id": str(item.id), "name": item.name} for item in departments],
        "documents": [
            {
                "id": str(item.id),
                "projectId": str(item.project_id),
                "name": item.name,
                "type": item.category,
                "path": item.path,
            }
            for item in documents
        ],
        "clients": [
            {
                "id": str(item.id),
                "name": item.name,
                "company": item.company,
                "industry": item.industry,
                "status": item.status,
            }
            for item in clients
        ],
        "clientRequests": [
            {
                "id": str(item.id),
                "clientId": str(item.client_id) if item.client_id else None,
                "title": item.title,
                "type": item.type,
                "status": item.status,
            }
            for item in client_requests
        ],
        "proposals": [
            {
                "id": str(item.id),
                "clientRequestId": str(item.client_request_id) if item.client_request_id else None,
                "title": item.title,
                "status": item.status,
            }
            for item in proposals
        ],
        "validationRules": [
            {
                "id": str(item.id),
                "projectId": str(item.project_id) if item.project_id else None,
                "name": item.name,
                "type": item.type,
                "status": item.status,
            }
            for item in validation_rules
        ],
    }
