"""
Administration Router — User management, departments, skills, admin tasks, audit logs.
All endpoints require admin or super-admin role (except GET /users/:id for self-lookup).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from typing import Optional

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, require_roles
from app.models.team import Department, Team, department_team, team_resources
from app.models.user import User, team_user
from app.models.resource import Resource
from app.modules.administration import repository as repo
from app.security import hash_password
from app.modules.administration.schemas import (
    DepartmentCreateIn, DepartmentUpdateIn,
    TeamCreateIn, TeamUpdateIn,
    TeamMemberCreateIn, TeamMemberUpdateIn, TeamMemberOut,
    SkillCreateIn, SkillUpdateIn, SkillOut,
    TeamMemberWorkforceUpdateIn, TeamMemberWorkforceCreateIn, UserSkillAssignmentIn,
    UserCreateIn, UserUpdateIn,
)
from app.modules.administration.service import (
    activate_user, create_user, deactivate_user, format_user,
    hard_delete_user, restore_user, soft_delete_user, update_user,
)

router = APIRouter(tags=["Administration"])

# Shorthand guards
_admin_only = Depends(require_roles("super-admin", "admin"))


def _department_counts(db: Session, dept_id: int) -> tuple[int, int]:
    users_count = db.execute(
        select(func.count())
        .select_from(User.__table__)
        .where(
            User.__table__.c.department_id == dept_id,
            User.__table__.c.deleted_at.is_(None),
        )
    ).scalar_one()
    try:
        teams_count = db.execute(
            select(func.count())
            .select_from(Team.__table__)
            .where(
                Team.__table__.c.department_id == dept_id,
                Team.__table__.c.deleted_at.is_(None),
            )
        ).scalar_one()
    except SQLAlchemyError:
        teams_count = db.execute(
            select(func.count(func.distinct(department_team.c.team_id)))
            .select_from(
                department_team.join(Team.__table__, Team.__table__.c.id == department_team.c.team_id)
            )
            .where(
                department_team.c.department_id == dept_id,
                Team.__table__.c.deleted_at.is_(None),
            )
        ).scalar_one()
    return int(users_count or 0), int(teams_count or 0)


def _fmt_department(dept, db: Session) -> dict:
    users_count, teams_count = _department_counts(db, dept.id)
    return {
        "id": dept.id,
        "name": dept.name,
        "description": dept.description,
        "color": getattr(dept, "color", None) or "#3b82f6",
        "type": getattr(dept, "type", "department") or "department",
        "team_leader_id": dept.team_leader_id,
        "leaderId": str(dept.team_leader_id) if dept.team_leader_id else None,
        "users_count": users_count,
        "teams_count": teams_count,
    }


def _fmt_team(team, db: Session) -> dict:
    member_rows = (
        db.execute(
            select(User.__table__.c.id, User.__table__.c.name, User.__table__.c.avatar)
            .select_from(team_user.join(User.__table__, team_user.c.user_id == User.__table__.c.id))
            .where(
                team_user.c.team_id == team.id,
                User.__table__.c.deleted_at.is_(None),
            )
            .order_by(User.__table__.c.name)
        ).all()
    )
    resource_rows = (
        db.execute(
            select(
                Resource.__table__.c.id,
                Resource.__table__.c.user_id,
                Resource.__table__.c.name,
                Resource.__table__.c.avatar,
            )
            .select_from(
                team_resources.join(
                    Resource.__table__,
                    team_resources.c.resource_id == Resource.__table__.c.id,
                )
            )
            .where(team_resources.c.team_id == team.id)
            .order_by(Resource.__table__.c.name)
        ).all()
    )
    department = None
    if team.department_id:
        department = db.execute(
            select(Department.__table__.c.id, Department.__table__.c.name)
            .select_from(Department.__table__)
            .where(Department.__table__.c.id == team.department_id)
        ).first()

    # Prefer resource membership (team_resources) — same source as Resources?team_id=
    preview_members = [
        {
            "id": str(row.user_id or row.id),
            "name": row.name,
            "avatar_url": row.avatar,
        }
        for row in resource_rows
    ] or [
        {
            "id": row.id,
            "name": row.name,
            "avatar_url": row.avatar,
        }
        for row in member_rows
    ]

    return {
        "id": team.id,
        "name": team.name,
        "department_id": team.department_id,
        "slug": team.slug,
        "description": team.description,
        "color": team.color or "#3b82f6",
        "owner_id": team.owner_id,
        "is_active": bool(team.is_active),
        "members": preview_members,
        "members_count": len(resource_rows) if resource_rows else len(member_rows),
        "resources_count": len(resource_rows),
        "department": {"id": int(department.id), "name": department.name} if department else None,
        "created_at": team.created_at.isoformat() if team.created_at else None,
    }


def _fmt_team_member(team_id: int, member, assignment) -> dict:
    return {
        "team_id": team_id,
        "user_id": member.id,
        "role": getattr(assignment, "role", None) or "member",
        "created_at": assignment.created_at.isoformat() if getattr(assignment, "created_at", None) else None,
        "updated_at": assignment.updated_at.isoformat() if getattr(assignment, "updated_at", None) else None,
        "user": {
            "id": member.id,
            "name": member.name,
            "email": member.email,
            "avatar_url": member.avatar_url,
            "job_title": member.job_title,
            "department_id": member.department_id,
        },
    }


# ── User Management ────────────────────────────────────────────────────────

@router.get("/admin/users")
def list_users(
    q: str = Query(""),
    role: str = Query(""),
    department_id: Optional[int] = Query(None),
    team_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    current_user=Depends(require_permissions("manage-users")),
    db: Session = Depends(get_db),
):
    query = repo.get_users_query(db, q=q, role=role, department_id=department_id, team_id=team_id)
    return paginate(query, page, per_page, serializer=lambda u: format_user(u, db))


@router.post("/admin/users", status_code=201)
def create_new_user(
    body: UserCreateIn,
    current_user=Depends(require_permissions("manage-users")),
    db: Session = Depends(get_db),
):
    from app.dependencies import _get_user_roles

    user = create_user(
        db,
        name=body.name,
        email=body.email,
        phone=body.phone,
        job_title=body.job_title,
        department_id=body.department_id,
        team_id=body.team_id,
        role=body.role,
        password=body.password or "password",
        creator_id=current_user.id,
        actor_roles=_get_user_roles(current_user.id, db),
        is_active=True if body.is_active is None else bool(body.is_active),
    )
    return format_user(user, db)


@router.get("/admin/users/{user_id}")
def get_user(
    user_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Users can view their own profile; admins can view any
    if current_user.id != user_id:
        from app.dependencies import _get_user_roles
        roles = _get_user_roles(current_user.id, db)
        if not {"super-admin", "admin", "hr-manager"}.intersection(roles):
            raise HTTPException(403, "You can only view your own profile.")
    user = repo.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(404, "User not found.")
    return format_user(user, db)


@router.put("/admin/users/{user_id}")
def update_existing_user(
    user_id: int,
    body: UserUpdateIn,
    current_user=Depends(require_permissions("manage-users")),
    db: Session = Depends(get_db),
):
    from app.dependencies import _get_user_roles

    user = update_user(
        db,
        user_id,
        body.model_dump(exclude_unset=True),
        actor_roles=_get_user_roles(current_user.id, db),
    )
    return format_user(user, db)


@router.delete("/admin/users/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: int,
    current_user=Depends(require_permissions("manage-users")),
    db: Session = Depends(get_db),
):
    if current_user.id == user_id:
        raise HTTPException(400, "You cannot delete your own user account.")

    # Check if user is project owner
    from app.models.project import Project
    owned_projects = db.query(Project).filter(Project.owner_id == user_id, Project.deleted_at.is_(None)).first()
    if owned_projects:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete user because they are the owner of project '{owned_projects.name}'."
        )

    # Check if user is team owner
    from app.models.team import Team
    owned_teams = db.query(Team).filter(Team.owner_id == user_id).first()
    if owned_teams:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete user because they are the owner of team '{owned_teams.name}'."
        )

    # Check if user is department leader
    from app.models.team import Department
    led_depts = db.query(Department).filter(Department.team_leader_id == user_id).first()
    if led_depts:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete user because they are the leader of department '{led_depts.name}'."
        )

    # Check if user is assigned to active issues (not done/closed)
    from app.models.issue import Issue, IssueStatus
    active_issues = db.query(Issue).join(IssueStatus).filter(
        Issue.assignee_id == user_id,
        Issue.deleted_at.is_(None),
        IssueStatus.category != "done"
    ).first()
    if active_issues:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete user because they are assigned to active work/issues (e.g. '{active_issues.title}')."
        )

    hard_delete_user(db, user_id)
    return MessageResponse(message="User deleted successfully from database.")


@router.post("/admin/users/{user_id}/restore", response_model=MessageResponse)
def restore(
    user_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    restore_user(db, user_id)
    return MessageResponse(message="User restored successfully.")


@router.post("/admin/users/{user_id}/activate", response_model=MessageResponse)
def activate(
    user_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    activate_user(db, user_id)
    return MessageResponse(message="User activated.")


@router.post("/admin/users/{user_id}/deactivate", response_model=MessageResponse)
def deactivate(
    user_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    deactivate_user(db, user_id)
    return MessageResponse(message="User deactivated.")


# ── Roles (read-only listing for dropdowns) ────────────────────────────────

@router.get("/admin/roles")
def list_roles(
    current_user=Depends(require_permissions("manage-users")),
    db: Session = Depends(get_db),
):
    from app.models.user import Role
    roles = db.query(Role).order_by(Role.name).all()
    return [{"id": r.id, "name": r.name} for r in roles]


# ── Departments ────────────────────────────────────────────────────────────

@router.get("/admin/departments")
@router.get("/departments")
def list_departments(
    current_user=Depends(require_permissions("view-departments")),
    db: Session = Depends(get_db),
):
    depts = repo.get_all_departments(db)
    return [_fmt_department(d, db) for d in depts]


@router.post("/admin/departments", status_code=201)
@router.post("/departments", status_code=201)
def create_department(
    body: DepartmentCreateIn,
    current_user=Depends(require_permissions("manage-departments")),
    db: Session = Depends(get_db),
):
    from datetime import datetime as dt, timezone as tz

    leader_id = body.team_leader_id or body.manager_id
    dept = repo.create_department(
        db,
        name=body.name,
        description=body.description,
        team_leader_id=leader_id,
        is_active=True,
        created_at=dt.now(tz.utc),
        updated_at=dt.now(tz.utc),
    )
    if body.color:
        dept.color = body.color
    if body.type:
        dept.type = body.type
    db.commit()
    db.refresh(dept)
    return _fmt_department(dept, db)


@router.put("/admin/departments/{dept_id}")
@router.put("/departments/{dept_id}")
def update_department(
    dept_id: int,
    body: DepartmentUpdateIn,
    current_user=Depends(require_permissions("manage-departments")),
    db: Session = Depends(get_db),
):
    dept = repo.get_department_by_id(db, dept_id)
    if not dept:
        raise HTTPException(404, "Department not found.")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        dept.name = data["name"]
    if "description" in data:
        dept.description = data["description"]
    if "team_leader_id" in data or "manager_id" in data:
        dept.team_leader_id = data.get("team_leader_id") or data.get("manager_id")
    if "color" in data:
        dept.color = data["color"]
    if "type" in data:
        dept.type = data["type"]
    db.commit()
    db.refresh(dept)
    return _fmt_department(dept, db)


@router.delete("/admin/departments/{dept_id}", response_model=MessageResponse)
@router.delete("/departments/{dept_id}", response_model=MessageResponse)
def delete_department(
    dept_id: int,
    current_user=Depends(require_permissions("manage-departments")),
    db: Session = Depends(get_db),
):
    dept = repo.get_department_by_id(db, dept_id)
    if not dept:
        raise HTTPException(404, "Department not found.")
    teams_count = db.execute(
        select(func.count())
        .select_from(Team.__table__)
        .where(Team.__table__.c.department_id == dept.id)
    ).scalar_one()
    if teams_count:
        raise HTTPException(400, "Department cannot be deleted while teams exist. Reassign or delete the teams first.")
    repo.delete_department(db, dept)
    db.commit()
    return MessageResponse(message="Department deleted.")


# ── Teams ──────────────────────────────────────────────────────────

@router.get("/admin/teams")
@router.get("/teams")
def list_teams(
    current_user=Depends(require_permissions("view-teams")),
    db: Session = Depends(get_db),
):
    teams = repo.get_all_teams(db)
    return [_fmt_team(team, db) for team in teams]


@router.get("/admin/teams/{team_id}")
@router.get("/teams/{team_id}")
def get_team(
    team_id: int,
    current_user=Depends(require_permissions("view-teams")),
    db: Session = Depends(get_db),
):
    team = repo.get_team_by_id(db, team_id)
    if not team:
        raise HTTPException(404, "Team not found.")
    return _fmt_team(team, db)


@router.post("/admin/teams", status_code=201)
@router.post("/teams", status_code=201)
def create_team(
    body: TeamCreateIn,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    from datetime import datetime as dt, timezone as tz
    import re

    department = repo.get_department_by_id(db, body.department_id)
    if not department:
        raise HTTPException(404, "Department not found.")

    slug = (body.slug or "").strip().lower()
    if not slug:
        slug = re.sub(r"[^a-z0-9]+", "-", body.name.strip().lower()).strip("-")
    if not slug:
        slug = "team"

    existing_slugs = {row[0] for row in db.query(Team.slug).filter(Team.slug.isnot(None)).all()}
    base = slug
    suffix = 2
    while slug in existing_slugs:
        slug = f"{base}-{suffix}"
        suffix += 1

    team = repo.create_team(
        db,
        name=body.name.strip(),
        slug=slug,
        description=body.description,
        color=body.color or "#3b82f6",
        owner_id=body.owner_id,
        department_id=body.department_id,
        is_active=bool(body.is_active if body.is_active is not None else True),
        created_at=dt.now(tz.utc),
        updated_at=dt.now(tz.utc),
    )
    db.commit()
    db.refresh(team)
    return _fmt_team(team, db)


@router.put("/admin/teams/{team_id}")
@router.put("/teams/{team_id}")
def update_team(
    team_id: int,
    body: TeamUpdateIn,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    from datetime import datetime as dt, timezone as tz

    team = repo.get_team_by_id(db, team_id)
    if not team:
        raise HTTPException(404, "Team not found.")
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        team.name = data["name"].strip()
    if "department_id" in data and data["department_id"] is not None:
        department = repo.get_department_by_id(db, int(data["department_id"]))
        if not department:
            raise HTTPException(404, "Department not found.")
        team.department_id = int(data["department_id"])
    if "slug" in data and data["slug"] is not None:
        team.slug = data["slug"].strip().lower()
    if "description" in data:
        team.description = data["description"]
    if "color" in data:
        team.color = data["color"]
    if "owner_id" in data:
        team.owner_id = data["owner_id"]
    if "is_active" in data and data["is_active"] is not None:
        team.is_active = bool(data["is_active"])
        if not team.is_active:
            team.deleted_at = team.deleted_at or dt.now(tz.utc)
        elif team.deleted_at is not None:
            team.deleted_at = None
    db.commit()
    db.refresh(team)
    return _fmt_team(team, db)


@router.delete("/admin/teams/{team_id}", response_model=MessageResponse)
@router.delete("/teams/{team_id}", response_model=MessageResponse)
def delete_team(
    team_id: int,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    team = repo.get_team_by_id(db, team_id)
    if not team:
        raise HTTPException(404, "Team not found.")
    repo.delete_team(db, team)
    db.commit()
    return MessageResponse(message="Team deleted.")


@router.get("/admin/teams/{team_id}/members", response_model=list[TeamMemberOut])
@router.get("/teams/{team_id}/members", response_model=list[TeamMemberOut])
def list_team_members(
    team_id: int,
    current_user=Depends(require_permissions("view-teams")),
    db: Session = Depends(get_db),
):
    team = repo.get_team_by_id(db, team_id)
    if not team:
        raise HTTPException(404, "Team not found.")
    members = repo.get_team_members(db, team_id)
    return [_fmt_team_member(team_id, member, assignment) for member, assignment in members]


@router.get("/admin/teams/{team_id}/resources")
@router.get("/teams/{team_id}/resources")
def list_team_resources(
    team_id: int,
    current_user=Depends(require_permissions("view-teams")),
    db: Session = Depends(get_db),
):
    from app.modules.resources.service import list_resources
    return list_resources(db, team_id=team_id)


@router.post("/admin/teams/{team_id}/resources", status_code=201)
@router.post("/teams/{team_id}/resources", status_code=201)
def assign_team_resource(
    team_id: int,
    resource_id: int,
    role: str = "member",
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    from app.modules.resources.service import assign_resource_to_team
    return assign_resource_to_team(db, team_id, resource_id, role)


@router.delete("/admin/teams/{team_id}/resources/{resource_id}")
@router.delete("/teams/{team_id}/resources/{resource_id}")
def remove_team_resource(
    team_id: int,
    resource_id: int,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    from app.modules.resources.service import remove_resource_from_team
    return {"success": remove_resource_from_team(db, team_id, resource_id)}




@router.post("/admin/teams/{team_id}/members", status_code=201, response_model=TeamMemberOut)
@router.post("/teams/{team_id}/members", status_code=201, response_model=TeamMemberOut)
def add_team_member(
    team_id: int,
    body: TeamMemberCreateIn,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    team = repo.get_team_by_id(db, team_id)
    if not team:
        raise HTTPException(404, "Team not found.")
    user = repo.get_user_by_id(db, body.user_id)
    if not user or getattr(user, "deleted_at", None) is not None:
        raise HTTPException(404, "User not found.")

    created = repo.add_team_member(db, team_id, body.user_id, body.role or "member")
    if not created:
        raise HTTPException(409, "User is already a member of this team.")

    db.commit()
    assignment = repo.get_team_member_assignment(db, team_id, body.user_id)
    return _fmt_team_member(team_id, user, assignment)


@router.put("/admin/teams/{team_id}/members/{user_id}", response_model=TeamMemberOut)
@router.put("/teams/{team_id}/members/{user_id}", response_model=TeamMemberOut)
def update_team_member(
    team_id: int,
    user_id: int,
    body: TeamMemberUpdateIn,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    team = repo.get_team_by_id(db, team_id)
    if not team:
        raise HTTPException(404, "Team not found.")
    user = repo.get_user_by_id(db, user_id)
    if not user or getattr(user, "deleted_at", None) is not None:
        raise HTTPException(404, "User not found.")

    updated = repo.update_team_member(db, team_id, user_id, body.role)
    if not updated:
        raise HTTPException(404, "Team member not found.")

    db.commit()
    assignment = repo.get_team_member_assignment(db, team_id, user_id)
    return _fmt_team_member(team_id, user, assignment)


@router.delete("/admin/teams/{team_id}/members/{user_id}", response_model=MessageResponse)
@router.delete("/teams/{team_id}/members/{user_id}", response_model=MessageResponse)
def remove_team_member(
    team_id: int,
    user_id: int,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    team = repo.get_team_by_id(db, team_id)
    if not team:
        raise HTTPException(404, "Team not found.")

    removed = repo.remove_team_member(db, team_id, user_id)
    if not removed:
        raise HTTPException(404, "Team member not found.")

    db.commit()
    return MessageResponse(message="Team member removed.")


# ── Skills ────────────────────────────────────────────────────────────────

@router.get("/admin/skills")
@router.get("/skills")
def list_skills(
    category: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    skills = repo.get_all_skills(db, category=category)
    return [{"id": str(s.id), "name": s.name, "category": s.category} for s in skills]


@router.get("/skills-directory")
def get_skills_directory(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    skills = repo.get_all_skills(db)
    depts = repo.get_all_departments(db)
    users = repo.get_users_query(db).all()
    department_map = {d.id: d.name for d in depts}

    formatted_users = []
    for u in users:
        formatted_users.append({
            "id": str(u.id),
            "name": u.name,
            "email": u.email,
            "avatar": u.avatar,
            "job_title": u.job_title,
            "department": department_map.get(u.department_id),
            "department_id": str(u.department_id) if u.department_id else None,
            "skills": [
                {
                    "id": str(s.id),
                    "name": s.name,
                    "category": s.category or "general",
                    "proficiency": "expert"
                }
                for s in (u.skills or [])
            ]
        })

    return {
        "users": formatted_users,
        "skills": [{"id": str(s.id), "name": s.name, "category": s.category or "general", "color": "#3b82f6"} for s in skills],
        "departments": [{"id": str(d.id), "name": d.name} for d in depts],
    }


@router.post("/admin/skills", status_code=201, response_model=SkillOut)
@router.post("/skills", status_code=201, response_model=SkillOut)
def create_skill(
    body: SkillCreateIn,
    current_user=Depends(require_permissions("manage-skills")),
    db: Session = Depends(get_db),
):
    from app.models.resource import Skill
    existing = db.query(Skill).filter(Skill.name.ilike(body.name.strip())).first()
    if existing:
        raise HTTPException(400, "A skill with this name already exists.")
    skill = repo.create_skill(db, name=body.name.strip(), category=body.category)
    db.commit()
    db.refresh(skill)
    return skill


@router.put("/admin/skills/{skill_id}", response_model=SkillOut)
@router.put("/skills/{skill_id}", response_model=SkillOut)
def update_skill(
    skill_id: int,
    body: SkillUpdateIn,
    current_user=Depends(require_permissions("manage-skills")),
    db: Session = Depends(get_db),
):
    from app.models.resource import Skill
    skill = repo.get_skill_by_id(db, skill_id)
    if not skill:
        raise HTTPException(404, "Skill not found.")
    if body.name:
        existing = db.query(Skill).filter(
            Skill.name.ilike(body.name.strip()),
            Skill.id != skill_id
        ).first()
        if existing:
            raise HTTPException(400, "A skill with this name already exists.")
        skill.name = body.name.strip()
    if body.category is not None:
        skill.category = body.category
    db.commit()
    db.refresh(skill)
    return skill


@router.delete("/admin/skills/{skill_id}", response_model=MessageResponse)
@router.delete("/skills/{skill_id}", response_model=MessageResponse)
def delete_skill(
    skill_id: int,
    current_user=Depends(require_permissions("manage-skills")),
    db: Session = Depends(get_db),
):
    skill = repo.get_skill_by_id(db, skill_id)
    if not skill:
        raise HTTPException(404, "Skill not found.")
    repo.delete_skill(db, skill)
    db.commit()
    return MessageResponse(message="Skill deleted.")


# ── Workforce Team Members ───────────────────────────────────────────────────

def _fmt_workforce_member(u: User, db: Session) -> dict:
    dept = None
    if u.department_id:
        d = repo.get_department_by_id(db, u.department_id)
        if d:
            dept = {"id": d.id, "name": d.name}

    team_rows = (
        db.query(Team)
        .join(team_user, team_user.c.team_id == Team.id)
        .filter(team_user.c.user_id == u.id, Team.deleted_at.is_(None))
        .all()
    )
    teams = [{"id": t.id, "name": t.name, "color": t.color or "#3b82f6"} for t in team_rows]
    skills = repo.get_user_skills(db, u.id)

    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "avatar_url": u.avatar_url,
        "phone": u.phone,
        "job_title": u.job_title or u.position,
        "position": u.position or u.job_title or "Unassigned",
        "seniority": u.seniority or "Mid",
        "capacity": u.capacity if u.capacity is not None else 40,
        "availability": u.availability or "Available",
        "hourly_cost": float(u.hourly_cost) if u.hourly_cost is not None else None,
        "salary": float(u.salary) if u.salary is not None else None,
        "currency": u.currency or "USD",
        "department_id": u.department_id,
        "department": dept,
        "teams": teams,
        "skills": skills,
    }


@router.post("/team-members", status_code=201)
@router.post("/workforce/members", status_code=201)
def create_workforce_member(
    body: TeamMemberWorkforceCreateIn,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    existing = repo.get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(400, "A user with this email address already exists.")

    password_hash = hash_password(body.password or "password123")
    user = User(
        name=body.name,
        email=body.email,
        password=password_hash,
        phone=body.phone,
        bio=body.bio,
        job_title=body.position,
        position=body.position,
        seniority=body.seniority or "Mid",
        capacity=body.capacity if body.capacity is not None else 40,
        availability=body.availability or "Available",
        salary=body.salary,
        currency=body.currency or "USD",
        department_id=body.department_id,
        is_active=True,
    )
    db.add(user)
    db.flush()

    if body.team_ids:
        for t_id in body.team_ids:
            repo.add_team_member(db, t_id, user.id, role="member")

    if body.skills:
        skills_payload = [s.model_dump() for s in body.skills]
        repo.set_user_skills(db, user.id, skills_payload)

    db.commit()
    db.refresh(user)
    return repo.get_user_detailed_profile(db, user.id)


@router.get("/team-members")
@router.get("/workforce/members")
@router.get("/resources-directory")
def list_workforce_members(
    q: str = Query(""),
    project_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    team_id: Optional[int] = Query(None),
    skill_id: Optional[int] = Query(None),
    position: Optional[str] = Query(None),
    seniority: Optional[str] = Query(None),
    availability: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = repo.get_workforce_members_query(
        db,
        q=q,
        project_id=project_id,
        department_id=department_id,
        team_id=team_id,
        skill_id=skill_id,
        position=position,
        seniority=seniority,
        availability=availability,
    )
    users = query.all()
    return [_fmt_workforce_member(u, db) for u in users]


@router.get("/team-members/{user_id}")
@router.get("/workforce/members/{user_id}")
def get_workforce_member_profile(
    user_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = repo.get_user_detailed_profile(db, user_id)
    if not profile:
        raise HTTPException(404, "Team member profile not found.")
    return profile


@router.put("/team-members/{user_id}")
@router.put("/workforce/members/{user_id}")
def update_workforce_member_profile(
    user_id: int,
    body: TeamMemberWorkforceUpdateIn,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    user = repo.get_user_by_id(db, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(404, "User not found.")

    data = body.model_dump(exclude_unset=True)
    if "position" in data:
        user.position = data["position"]
        if not user.job_title:
            user.job_title = data["position"]
    if "seniority" in data:
        user.seniority = data["seniority"]
    if "capacity" in data:
        user.capacity = data["capacity"]
    if "availability" in data:
        user.availability = data["availability"]
    if "hourly_cost" in data:
        user.hourly_cost = data["hourly_cost"]
    if "salary" in data:
        user.salary = data["salary"]
    if "currency" in data:
        user.currency = data["currency"]
    if "department_id" in data:
        user.department_id = data["department_id"]

    if "team_ids" in data and data["team_ids"] is not None:
        db.execute(team_user.delete().where(team_user.c.user_id == user_id))
        for t_id in data["team_ids"]:
            repo.add_team_member(db, t_id, user_id, role="member")

    if "skills" in data and data["skills"] is not None:
        skills_payload = [s.model_dump() for s in data["skills"]]
        repo.set_user_skills(db, user_id, skills_payload)

    db.commit()
    db.refresh(user)
    return repo.get_user_detailed_profile(db, user_id)


@router.delete("/team-members/{user_id}", response_model=MessageResponse)
@router.delete("/workforce/members/{user_id}", response_model=MessageResponse)
def delete_workforce_member(
    user_id: int,
    current_user=Depends(require_permissions("manage-teams")),
    db: Session = Depends(get_db),
):
    user = repo.get_user_by_id(db, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(404, "Team member not found.")

    soft_delete_user(db, user_id)
    return MessageResponse(message="Team member deleted successfully.")


# ── Audit Logs ─────────────────────────────────────────────────────────────

@router.get("/admin/audit-logs")
def list_audit_logs(
    entity_type: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user=Depends(require_permissions("view-audit-logs")),
    db: Session = Depends(get_db),
):
    query = repo.get_audit_logs_query(db, entity_type=entity_type, user_id=user_id)
    return paginate(query, page, per_page, serializer=lambda log: {
        "id": log.id,
        "user_id": log.user_id,
        "action": log.action,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "old_values": log.old_values,
        "new_values": log.new_values,
        "ip_address": log.ip_address,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    })


# ── Admin Tasks ────────────────────────────────────────────────────────────

def _fmt_admin_task(t) -> dict:
    return {
        "id": t.id,
        "project_id": getattr(t, "project_id", None),
        "subject": getattr(t, "subject", None) or t.title,
        "comment": getattr(t, "comment", None) or t.description,
        "person_name": getattr(t, "person_name", None) or "Unassigned",
        "user_id": getattr(t, "user_id", None) or t.assigned_to,
        "start_date": getattr(t, "start_date", None).isoformat() if getattr(t, "start_date", None) else None,
        "end_date": t.due_date.isoformat() if t.due_date else None,
        "status": t.status or "todo",
        "notes": getattr(t, "notes", None) or t.category,
        "additional_notes": getattr(t, "additional_notes", None),
        "project": {"id": t.project_id, "name": f"Project #{t.project_id}"} if getattr(t, "project_id", None) else None,
        "assignee": {"id": t.assigned_to, "name": f"User #{t.assigned_to}"} if t.assigned_to else None,
    }


@router.get("/admin/tasks")
@router.get("/admin-tasks")
def list_admin_tasks(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    assigned_to: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = repo.get_admin_tasks_query(db, status=status, assigned_to=assigned_to)
    if project_id and hasattr(repo.AdminTask, "project_id"):
        query = query.filter(repo.AdminTask.project_id == project_id)
    if q:
        query = query.filter(repo.AdminTask.title.ilike(f"%{q}%"))
    tasks = query.order_by(repo.AdminTask.created_at.desc()).all()
    return {"data": [_fmt_admin_task(t) for t in tasks]}


@router.post("/admin/tasks", status_code=201)
@router.post("/admin-tasks", status_code=201)
def create_admin_task(
    body: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from datetime import datetime as dt
    title = body.get("subject") or body.get("title") or "New Task"
    desc = body.get("comment") or body.get("description")
    person = body.get("person_name")
    user_id = body.get("user_id") or body.get("assigned_to")
    project_id = body.get("project_id")
    status = body.get("status") or "todo"
    due_str = body.get("end_date") or body.get("due_date")
    due = None
    if due_str:
        try:
            due = dt.fromisoformat(due_str).date()
        except ValueError:
            pass

    task = repo.create_admin_task(
        db,
        title=title,
        description=desc,
        category=body.get("notes") or body.get("category"),
        priority=body.get("priority") or "medium",
        assigned_to=int(user_id) if user_id and str(user_id).isdigit() else None,
        created_by=current_user.id,
        due_date=due,
    )
    if hasattr(task, "status"):
        task.status = status
    if hasattr(task, "person_name") and person:
        task.person_name = person
    if hasattr(task, "project_id") and project_id and str(project_id).isdigit():
        task.project_id = int(project_id)
    db.commit()
    db.refresh(task)
    return _fmt_admin_task(task)


@router.put("/admin/tasks/{task_id}")
@router.put("/admin-tasks/{task_id}")
def update_admin_task(
    task_id: int,
    body: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = repo.get_admin_task_by_id(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found.")
    
    if "subject" in body or "title" in body:
        task.title = body.get("subject") or body.get("title")
    if "comment" in body or "description" in body:
        task.description = body.get("comment") or body.get("description")
    if "status" in body:
        task.status = body["status"]
    if "person_name" in body and hasattr(task, "person_name"):
        task.person_name = body["person_name"]
    if "user_id" in body:
        val = body["user_id"]
        task.assigned_to = int(val) if val and str(val).isdigit() else None
    
    db.commit()
    db.refresh(task)
    return _fmt_admin_task(task)


@router.delete("/admin/tasks/{task_id}", response_model=MessageResponse)
@router.delete("/admin-tasks/{task_id}", response_model=MessageResponse)
def delete_admin_task(
    task_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = repo.get_admin_task_by_id(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found.")
    db.delete(task)
    db.commit()
    return MessageResponse(message="Task deleted.")


# ── Recovery (soft-deleted items) ──────────────────────────────────────────

@router.get("/admin/recovery/users")
def list_deleted_users(
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    from app.models.user import User
    users = db.query(User).filter(User.deleted_at.isnot(None)).order_by(User.deleted_at.desc()).all()
    return [format_user(u, db) for u in users]


@router.get("/admin/recovery/issues")
def list_deleted_issues(
    project_id: Optional[int] = Query(None),
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    from app.models.issue import Issue
    q = db.query(Issue).filter(Issue.deleted_at.isnot(None))
    if project_id:
        q = q.filter(Issue.project_id == project_id)
    issues = q.order_by(Issue.deleted_at.desc()).all()
    return [{"id": i.id, "title": i.title, "project_id": i.project_id, "deleted_at": i.deleted_at.isoformat()} for i in issues]


@router.post("/admin/recovery/issues/{issue_id}/restore", response_model=MessageResponse)
def restore_issue(
    issue_id: int,
    current_user=_admin_only,
    db: Session = Depends(get_db),
):
    from app.models.issue import Issue
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(404, "Issue not found.")
    issue.deleted_at = None
    db.commit()
    return MessageResponse(message="Issue restored.")
