"""
Administration Repository — database access only.
No business logic here. Called by the service layer.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.misc import AdminTask, AuditLog
from app.models.project import Project
from app.models.resource import Resource, Skill


from app.models.team import Department, Team
from app.models.user import Role, User, user_roles_table, model_has_permissions, team_user, project_members, skill_user


# ── User Repository ────────────────────────────────────────────────────────

def get_users_query(db: Session, q: str = "", role: str = "", department_id: Optional[int] = None, team_id: Optional[int] = None, include_deleted: bool = False):
    from app.models.team import Team
    query = db.query(User)
    if not include_deleted:
        query = query.filter(User.deleted_at.is_(None))
    if q:
        query = query.filter(User.name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    if department_id:
        query = query.filter(User.department_id == department_id)
    if team_id:
        query = (
            query
            .join(team_user, team_user.c.user_id == User.id)
            .join(Team, Team.id == team_user.c.team_id)
            .filter(Team.id == team_id)
        )
    if role:
        query = (
            query
            .join(user_roles_table, user_roles_table.c.model_id == User.id)
            .join(Role, Role.id == user_roles_table.c.role_id)
            .filter(Role.name == role)
        )
    return query.order_by(User.name)


def get_user_by_id(db: Session, user_id: int, include_deleted: bool = False) -> Optional[User]:
    query = db.query(User).filter(User.id == user_id)
    if not include_deleted:
        query = query.filter(User.deleted_at.is_(None))
    return query.first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()


def create_user(db: Session, **kwargs) -> User:
    user = User(**kwargs)
    db.add(user)
    db.flush()
    return user


def get_role_by_name(db: Session, role_name: str) -> Optional[Role]:
    return db.query(Role).filter(Role.name == role_name).first()


def assign_role_to_user(db: Session, user_id: int, role_name: str) -> Role:
    """
    Replace the user's global RBAC assignment in model_has_roles.
    Raises BadRequestException if the role name does not exist.
    """
    from app.core.exceptions import BadRequestException

    role_obj = get_role_by_name(db, role_name)
    if not role_obj:
        raise BadRequestException(f"Role '{role_name}' does not exist.")

    # Remove existing global roles first (single global role model)
    db.execute(
        user_roles_table.delete().where(user_roles_table.c.model_id == user_id)
    )
    db.execute(
        user_roles_table.insert().values(
            role_id=role_obj.id,
            model_type="App\\Models\\User",
            model_id=user_id,
        )
    )
    return role_obj


def add_user_to_team(db: Session, user_id: int, team_id: int) -> None:
    existing = db.execute(
        team_user.select().where(
            team_user.c.user_id == user_id,
            team_user.c.team_id == team_id,
        )
    ).first()
    if not existing:
        db.execute(
            team_user.insert().values(
                team_id=team_id,
                user_id=user_id,
                role="member",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        )


def soft_delete_user(db: Session, user: User) -> None:
    now = datetime.now(timezone.utc)
    user.deleted_at = now
    user.is_active = False
    db.add(user)

    from app.models.resource import Resource
    resource = db.query(Resource).filter(Resource.user_id == user.id).first()
    if resource:
        resource.deleted_at = now
        resource.is_active = False
        db.add(resource)


def hard_delete_user(db: Session, user: User) -> None:
    from app.models.resource import Resource, ResourceSkill, ResourceCertification
    resource = db.query(Resource).filter(Resource.user_id == user.id).first()
    if resource:
        db.query(ResourceSkill).filter(ResourceSkill.resource_id == resource.id).delete()
        db.query(ResourceCertification).filter(ResourceCertification.resource_id == resource.id).delete()
        db.delete(resource)

    db.execute(user_roles_table.delete().where(user_roles_table.c.model_id == user.id))
    db.execute(model_has_permissions.delete().where(model_has_permissions.c.model_id == user.id))
    db.execute(team_user.delete().where(team_user.c.user_id == user.id))
    db.execute(project_members.delete().where(project_members.c.user_id == user.id))
    db.execute(skill_user.delete().where(skill_user.c.user_id == user.id))

    from app.models.issue import Issue
    db.query(Issue).filter(Issue.assignee_id == user.id).update({Issue.assignee_id: None})

    db.delete(user)
    db.flush()


def restore_user(db: Session, user: User) -> None:
    user.deleted_at = None
    user.is_active = True
    db.add(user)

    from app.models.resource import Resource
    resource = db.query(Resource).filter(Resource.user_id == user.id).first()
    if resource:
        resource.deleted_at = None
        resource.is_active = True
        db.add(resource)


# ── Department Repository ──────────────────────────────────────────────────

def get_all_departments(db: Session) -> list[Department]:
    return (
        db.query(Department)
        .filter(Department.deleted_at.is_(None))
        .order_by(Department.name)
        .all()
    )


def get_department_by_id(db: Session, dept_id: int) -> Optional[Department]:
    return (
        db.query(Department)
        .filter(Department.id == dept_id, Department.deleted_at.is_(None))
        .first()
    )


def create_department(db: Session, **kwargs) -> Department:
    dept = Department(**kwargs)
    db.add(dept)
    db.flush()
    return dept


def delete_department(db: Session, dept: Department) -> None:
    db.query(User).filter(User.department_id == dept.id).update(
        {User.department_id: None},
        synchronize_session=False,
    )
    db.query(Resource).filter(Resource.department_id == dept.id).update(
        {Resource.department_id: None},
        synchronize_session=False,
    )
    db.delete(dept)


# ── Team Repository ───────────────────────────────────────────────

def get_all_teams(db: Session) -> list[Team]:
    return (
        db.query(Team)
        .filter(Team.deleted_at.is_(None))
        .order_by(Team.name)
        .all()
    )


def get_team_by_id(db: Session, team_id: int) -> Optional[Team]:
    return (
        db.query(Team)
        .filter(Team.id == team_id, Team.deleted_at.is_(None))
        .first()
    )


def create_team(db: Session, **kwargs) -> Team:
    team = Team(**kwargs)
    db.add(team)
    db.flush()
    return team


def delete_team(db: Session, team: Team) -> None:
    db.query(Project).filter(Project.team_id == team.id).update(
        {Project.team_id: None},
        synchronize_session=False,
    )
    db.delete(team)


def get_team_member_assignment(db: Session, team_id: int, user_id: int):
    return db.execute(
        team_user.select().where(
            team_user.c.team_id == team_id,
            team_user.c.user_id == user_id,
        )
    ).first()


def get_team_members(db: Session, team_id: int):
    rows = db.execute(
        team_user.select().where(team_user.c.team_id == team_id)
    ).all()
    if not rows:
        return []

    assignment_map = {row.user_id: row for row in rows}
    user_ids = list(assignment_map.keys())
    users = (
        db.query(User)
        .filter(User.id.in_(user_ids), User.deleted_at.is_(None))
        .order_by(User.name)
        .all()
    )
    return [(user, assignment_map.get(user.id)) for user in users]


def add_team_member(db: Session, team_id: int, user_id: int, role: str = "member") -> bool:
    existing = get_team_member_assignment(db, team_id, user_id)
    if existing:
        return False

    db.execute(
        team_user.insert().values(
            team_id=team_id,
            user_id=user_id,
            role=role or "member",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
    )
    return True


def update_team_member(db: Session, team_id: int, user_id: int, role: str) -> int:
    result = db.execute(
        team_user.update().where(
            team_user.c.team_id == team_id,
            team_user.c.user_id == user_id,
        ).values(
            role=role or "member",
            updated_at=datetime.now(timezone.utc),
        )
    )
    return int(getattr(result, "rowcount", 0) or 0)


def remove_team_member(db: Session, team_id: int, user_id: int) -> int:
    result = db.execute(
        team_user.delete().where(
            team_user.c.team_id == team_id,
            team_user.c.user_id == user_id,
        )
    )
    return int(getattr(result, "rowcount", 0) or 0)


# ── Skill Repository ───────────────────────────────────────────────────────

def get_all_skills(db: Session, category: Optional[str] = None) -> list[Skill]:
    q = db.query(Skill)
    if category:
        q = q.filter(Skill.category == category)
    return q.order_by(Skill.name).all()


def get_skill_by_id(db: Session, skill_id: int) -> Optional[Skill]:
    return db.query(Skill).filter(Skill.id == skill_id).first()


def create_skill(db: Session, name: str, category: Optional[str] = None) -> Skill:
    skill = Skill(name=name, category=category)
    db.add(skill)
    db.flush()
    return skill


def delete_skill(db: Session, skill: Skill) -> None:
    db.delete(skill)


# ── Workforce Repository ───────────────────────────────────────────────────

def get_user_skills(db: Session, user_id: int) -> list[dict]:
    from app.models.user import skill_user
    rows = db.execute(
        select(Skill.id, Skill.name, Skill.category, skill_user.c.proficiency, skill_user.c.proficiency_level, skill_user.c.years_of_experience)
        .select_from(skill_user.join(Skill, Skill.id == skill_user.c.skill_id))
        .where(skill_user.c.user_id == user_id)
    ).all()
    
    return [
        {
            "id": r.id,
            "name": r.name,
            "category": r.category or "General",
            "proficiency_level": r.proficiency_level or r.proficiency or "Intermediate",
            "years_of_experience": float(r.years_of_experience or 0.0),
        }
        for r in rows
    ]


def set_user_skills(db: Session, user_id: int, skills: list[dict]) -> None:
    from app.models.user import skill_user
    db.execute(skill_user.delete().where(skill_user.c.user_id == user_id))
    for item in skills:
        s_id = item.get("skill_id")
        if not s_id:
            continue
        prof = item.get("proficiency_level") or "Intermediate"
        yoe = item.get("years_of_experience") or 0.0
        db.execute(
            skill_user.insert().values(
                skill_id=s_id,
                user_id=user_id,
                proficiency=prof,
                proficiency_level=prof,
                years_of_experience=yoe,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        )


def get_workforce_members_query(
    db: Session,
    q: str = "",
    project_id: Optional[int] = None,
    department_id: Optional[int] = None,
    team_id: Optional[int] = None,
    skill_id: Optional[int] = None,
    position: Optional[str] = None,
    seniority: Optional[str] = None,
    availability: Optional[str] = None,
):
    from app.models.user import skill_user, project_members
    from app.models.project import Project
    query = db.query(User).filter(User.deleted_at.is_(None))

    if q:
        search_term = f"%{q}%"
        query = query.filter(User.name.ilike(search_term) | User.email.ilike(search_term) | User.job_title.ilike(search_term) | User.position.ilike(search_term))
    if project_id:
        query = (
            query
            .outerjoin(project_members, project_members.c.user_id == User.id)
            .outerjoin(Project, Project.owner_id == User.id)
            .filter((project_members.c.project_id == project_id) | (Project.id == project_id))
        )
    if department_id:
        query = query.filter(User.department_id == department_id)
    if team_id:
        query = (
            query
            .join(team_user, team_user.c.user_id == User.id)
            .filter(team_user.c.team_id == team_id)
        )
    if skill_id:
        query = (
            query
            .join(skill_user, skill_user.c.user_id == User.id)
            .filter(skill_user.c.skill_id == skill_id)
        )
    if position:
        query = query.filter((User.position == position) | (User.job_title == position))
    if seniority:
        query = query.filter(User.seniority == seniority)
    if availability:
        query = query.filter(User.availability == availability)

    return query.distinct().order_by(User.name)


def get_user_detailed_profile(db: Session, user_id: int) -> Optional[dict]:
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        return None

    # Department
    dept = None
    if user.department_id:
        d = db.query(Department).filter(Department.id == user.department_id).first()
        if d:
            dept = {"id": d.id, "name": d.name}

    # Teams
    team_rows = (
        db.query(Team)
        .join(team_user, team_user.c.team_id == Team.id)
        .filter(team_user.c.user_id == user_id, Team.deleted_at.is_(None))
        .all()
    )
    teams = [{"id": t.id, "name": t.name, "color": t.color or "#3b82f6"} for t in team_rows]

    # Skills
    skills = get_user_skills(db, user_id)

    # Assigned Projects
    from app.models.user import project_members
    from app.models.project import Project
    project_rows = (
        db.query(Project)
        .outerjoin(project_members, project_members.c.project_id == Project.id)
        .filter(
            (Project.owner_id == user_id) | (project_members.c.user_id == user_id),
            Project.deleted_at.is_(None),
        )
        .distinct()
        .all()
    )
    assigned_projects = [
        {
            "id": p.id,
            "name": p.name,
            "key": p.key,
            "status": p.status or "In Progress",
            "progress": float(getattr(p, "progress", 0) or 0),
        }
        for p in project_rows
    ]

    # Assigned Issues
    from app.models.issue import Issue
    issue_rows = (
        db.query(Issue)
        .filter(Issue.assignee_id == user_id, Issue.deleted_at.is_(None))
        .order_by(Issue.created_at.desc())
        .limit(20)
        .all()
    )
    assigned_issues = [
        {
            "id": i.id,
            "key": getattr(i, "issue_key", f"ISS-{i.id}"),
            "title": i.title,
            "status": i.status or "todo",
            "priority": i.priority or "medium",
            "due_date": i.due_date.isoformat() if getattr(i, "due_date", None) else None,
        }
        for i in issue_rows
    ]

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "phone": user.phone,
        "bio": user.bio,
        "department": dept,
        "teams": teams,
        "position": user.position or user.job_title or "Unassigned",
        "seniority": user.seniority or "Mid",
        "capacity": user.capacity if user.capacity is not None else 40,
        "availability": user.availability or "Available",
        "hourly_cost": float(user.hourly_cost) if user.hourly_cost is not None else None,
        "salary": float(user.salary) if user.salary is not None else None,
        "currency": user.currency or "USD",
        "skills": skills,
        "assigned_projects": assigned_projects,
        "assigned_issues": assigned_issues,
    }


# ── Admin Task Repository ──────────────────────────────────────────────────

def get_admin_tasks_query(db: Session, status: Optional[str] = None, assigned_to: Optional[int] = None):
    q = db.query(AdminTask)
    if status:
        q = q.filter(AdminTask.status == status)
    if assigned_to:
        q = q.filter(AdminTask.assigned_to == assigned_to)
    return q.order_by(AdminTask.created_at.desc())


def get_admin_task_by_id(db: Session, task_id: int) -> Optional[AdminTask]:
    return db.query(AdminTask).filter(AdminTask.id == task_id).first()


def create_admin_task(db: Session, **kwargs) -> AdminTask:
    task = AdminTask(**kwargs)
    db.add(task)
    db.flush()
    return task


# ── Audit Log Repository ───────────────────────────────────────────────────

def get_audit_logs_query(db: Session, entity_type: Optional[str] = None, user_id: Optional[int] = None):
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    return q.order_by(AuditLog.created_at.desc())


def write_audit_log(
    db: Session,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: int,
    old_values: dict = None,
    new_values: dict = None,
    ip_address: str = None,
) -> None:
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values or {},
        new_values=new_values or {},
        ip_address=ip_address,
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
