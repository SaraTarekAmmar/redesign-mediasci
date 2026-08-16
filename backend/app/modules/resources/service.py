from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.user import User
from app.models.resource import Resource, Skill, ResourceSkill, Certification, ResourceCertification
from app.models.team import team_resources
from app.security import hash_password
from app.modules.resources import repository as repo
from app.modules.resources.schemas import ResourceCreateIn, ResourceUpdateIn


def _save_resource_skills(db: Session, resource_id: int, skills_payload: list):
    db.query(ResourceSkill).filter(ResourceSkill.resource_id == resource_id).delete()
    if not skills_payload:
        return
    for item in skills_payload:
        skill_name = item.get("name") if isinstance(item, dict) else str(item)
        if not skill_name:
            continue
        skill = db.query(Skill).filter(Skill.name.ilike(skill_name)).first()
        if not skill:
            skill = Skill(name=skill_name, category=item.get("category") if isinstance(item, dict) else "general")
            db.add(skill)
            db.flush()

        prof = item.get("proficiency", "mid") if isinstance(item, dict) else "mid"
        yoe = float(item.get("years_of_experience", 1.0)) if isinstance(item, dict) else 1.0
        verified = bool(item.get("verified", False)) if isinstance(item, dict) else False

        db.add(ResourceSkill(
            resource_id=resource_id,
            skill_id=skill.id,
            proficiency=prof,
            years_of_experience=yoe,
            verified=verified,
        ))


def _save_resource_certifications(db: Session, resource_id: int, certs_payload: list):
    db.query(ResourceCertification).filter(ResourceCertification.resource_id == resource_id).delete()
    if not certs_payload:
        return
    for item in certs_payload:
        cert_name = item.get("name") if isinstance(item, dict) else str(item)
        if not cert_name:
            continue
        cert = db.query(Certification).filter(Certification.name.ilike(cert_name)).first()
        if not cert:
            cert = Certification(name=cert_name, provider=item.get("provider") if isinstance(item, dict) else "Industry")
            db.add(cert)
            db.flush()

        db.add(ResourceCertification(
            resource_id=resource_id,
            certification_id=cert.id,
            credential_id=item.get("credential_id") if isinstance(item, dict) else None,
            url=item.get("url") if isinstance(item, dict) else None,
        ))


def create_resource(db: Session, body: ResourceCreateIn) -> dict:
    existing_user = db.query(User).filter(User.email == body.email, User.deleted_at.is_(None)).first()
    if existing_user:
        raise HTTPException(400, f"A user account with email '{body.email}' already exists.")

    pwd_hash = hash_password(body.password or "password123")
    user = User(
        name=body.name,
        email=body.email,
        password=pwd_hash,
        phone=body.phone,
        bio=body.bio,
        position=body.position,
        seniority=body.seniority,
        capacity=int(body.weekly_capacity or 40),
        availability=body.availability_status or "Available",
        salary=body.salary,
        currency=body.currency or "USD",
        department_id=body.department_id,
        is_active=True,
    )
    db.add(user)
    db.flush()

    emp_num = body.employee_number or f"EMP-{user.id:03d}"
    resource = Resource(
        user_id=user.id,
        employee_number=emp_num,
        department_id=body.department_id,
        name=body.name,
        email=body.email,
        position=body.position or "Team Member",
        seniority=body.seniority or "Mid",
        salary=body.salary or 0.0,
        currency=body.currency or "USD",
        cost_per_hour=body.cost_per_hour or 0.0,
        weekly_capacity=body.weekly_capacity or 40.0,
        daily_capacity_hours=body.daily_capacity_hours or 8.0,
        availability_status=body.availability_status or "available",
        contract_type=body.contract_type or "full_time",
        experience_years=body.experience_years or 0.0,
        manager_id=body.manager_id,
        is_active=1 if body.is_active else 0,
    )
    db.add(resource)
    db.flush()

    if body.team_ids:
        for t_id in body.team_ids:
            db.execute(
                team_resources.insert().values(
                    team_id=t_id,
                    resource_id=resource.id,
                    role="member",
                )
            )

    if body.skills:
        _save_resource_skills(db, resource.id, body.skills)
    if body.certifications:
        _save_resource_certifications(db, resource.id, body.certifications)

    db.commit()
    db.refresh(resource)
    return repo.format_resource_profile(db, resource)


def update_resource(db: Session, resource_id: int, body: ResourceUpdateIn) -> dict:
    resource = repo.get_resource_by_id(db, resource_id)
    if not resource:
        raise HTTPException(404, f"Resource with ID {resource_id} not found.")

    user = resource.linked_user
    data = body.model_dump(exclude_unset=True)

    if "name" in data and data["name"]:
        resource.name = data["name"]
        if user:
            user.name = data["name"]
    if "email" in data and data["email"]:
        resource.email = data["email"]
        if user:
            user.email = data["email"]
    if "employee_number" in data:
        resource.employee_number = data["employee_number"]
    if "position" in data:
        resource.position = data["position"]
        if user:
            user.position = data["position"]
    if "seniority" in data:
        resource.seniority = data["seniority"]
        if user:
            user.seniority = data["seniority"]
    if "department_id" in data:
        resource.department_id = data["department_id"]
        if user:
            user.department_id = data["department_id"]
    if "salary" in data:
        resource.salary = data["salary"]
        if user:
            user.salary = data["salary"]
    if "currency" in data:
        resource.currency = data["currency"]
        if user:
            user.currency = data["currency"]
    if "cost_per_hour" in data:
        resource.cost_per_hour = data["cost_per_hour"]
    if "weekly_capacity" in data:
        resource.weekly_capacity = data["weekly_capacity"]
        if user:
            user.capacity = int(data["weekly_capacity"])
    if "daily_capacity_hours" in data:
        resource.daily_capacity_hours = data["daily_capacity_hours"]
    if "availability_status" in data:
        resource.availability_status = data["availability_status"]
        if user:
            user.availability = data["availability_status"]
    if "contract_type" in data:
        resource.contract_type = data["contract_type"]
    if "experience_years" in data:
        resource.experience_years = data["experience_years"]
    if "is_active" in data:
        resource.is_active = 1 if data["is_active"] else 0
        if user:
            user.is_active = data["is_active"]

    if "team_ids" in data and data["team_ids"] is not None:
        db.execute(team_resources.delete().where(team_resources.c.resource_id == resource_id))
        for t_id in data["team_ids"]:
            db.execute(
                team_resources.insert().values(
                    team_id=t_id,
                    resource_id=resource_id,
                    role="member",
                )
            )

    if "skills" in data and data["skills"] is not None:
        _save_resource_skills(db, resource_id, data["skills"])
    if "certifications" in data and data["certifications"] is not None:
        _save_resource_certifications(db, resource_id, data["certifications"])

    db.commit()
    db.refresh(resource)
    return repo.format_resource_profile(db, resource)


def list_resources(
    db: Session,
    q: str = "",
    department_id: Optional[int] = None,
    team_id: Optional[int] = None,
    position: Optional[str] = None,
    seniority: Optional[str] = None,
    availability_status: Optional[str] = None,
    project_id: Optional[int] = None,
    is_active: Optional[bool] = None,
) -> List[dict]:
    query = repo.get_resources_query(
        db,
        q=q,
        department_id=department_id,
        team_id=team_id,
        position=position,
        seniority=seniority,
        availability_status=availability_status,
        project_id=project_id,
        is_active=is_active,
    )
    resources = query.all()
    return [repo.format_resource_profile(db, r) for r in resources]


def assign_resource_to_team(db: Session, team_id: int, resource_id: int, role: str = "member") -> dict:
    res = repo.get_resource_by_id(db, resource_id)
    if not res:
        raise HTTPException(404, f"Resource with ID {resource_id} not found.")

    existing = db.execute(
        team_resources.select().where(
            team_resources.c.team_id == team_id,
            team_resources.c.resource_id == resource_id,
        )
    ).first()
    if not existing:
        db.execute(
            team_resources.insert().values(
                team_id=team_id,
                resource_id=resource_id,
                role=role,
                role_in_team=role,
                is_primary_team=True,
            )
        )
        db.commit()
    return repo.format_resource_profile(db, res)


def remove_resource_from_team(db: Session, team_id: int, resource_id: int) -> bool:
    db.execute(
        team_resources.delete().where(
            team_resources.c.team_id == team_id,
            team_resources.c.resource_id == resource_id,
        )
    )
    db.commit()
    return True


def delete_resource(db: Session, resource_id: int) -> dict:
    resource = repo.get_resource_by_id(db, resource_id)
    if not resource:
        raise HTTPException(404, f"Resource with ID {resource_id} not found.")

    # Prevent deletion if resource has active allocations
    from app.models.resource import ResourceAllocation
    allocations = db.query(ResourceAllocation).filter(ResourceAllocation.resource_id == resource_id).all()
    if allocations:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete resource as they are currently assigned to active project/task allocations."
        )

    # Prevent deletion if resource user has active issues (not done)
    if resource.user_id:
        from app.models.issue import Issue, IssueStatus
        active_issues = db.query(Issue).join(IssueStatus).filter(
            Issue.assignee_id == resource.user_id,
            Issue.deleted_at.is_(None),
            IssueStatus.category != "done"
        ).first()
        if active_issues:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete resource as they are currently assigned to active work/issues."
            )

    user_id = resource.user_id

    # Clean up resource skill/certification associations
    from app.models.resource import ResourceSkill, ResourceCertification
    db.query(ResourceSkill).filter(ResourceSkill.resource_id == resource_id).delete()
    db.query(ResourceCertification).filter(ResourceCertification.resource_id == resource_id).delete()

    db.delete(resource)

    if user_id:
        from app.models.user import User, user_roles_table, model_has_permissions, team_user, project_members, skill_user
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.execute(user_roles_table.delete().where(user_roles_table.c.model_id == user_id))
            db.execute(model_has_permissions.delete().where(model_has_permissions.c.model_id == user_id))
            db.execute(team_user.delete().where(team_user.c.user_id == user_id))
            db.execute(project_members.delete().where(project_members.c.user_id == user_id))
            db.execute(skill_user.delete().where(skill_user.c.user_id == user_id))
            db.delete(user)

    db.commit()
    return {"success": True, "message": "Resource and associated user deleted successfully from database."}


def _parse_optional_date(value: str | None):
    from datetime import date
    if not value:
        return None
    return date.fromisoformat(value)


def _default_allocated_hours(resource: Resource, allocation_pct: int) -> float:
    weekly_cap = float(resource.weekly_capacity or 40.0)
    pct = max(0, min(100, allocation_pct))
    return round(weekly_cap * pct / 100, 2)


def list_project_resource_assignments(db: Session, project_id: int) -> list[dict]:
    from app.models.project import Project
    project = db.query(Project).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()
    if not project:
        raise HTTPException(404, "Project not found.")
    allocations = repo.get_project_resource_assignments(db, project_id)
    return [repo.format_project_resource_assignment(db, a) for a in allocations]


def assign_resource_to_project(db: Session, project_id: int, body) -> dict:
    from app.models.project import Project
    from app.models.resource import ResourceAllocation

    project = db.query(Project).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()
    if not project:
        raise HTTPException(404, "Project not found.")

    resource = repo.get_resource_by_id(db, body.resource_id)
    if not resource:
        raise HTTPException(404, f"Resource with ID {body.resource_id} not found.")

    existing = repo.get_project_resource_assignment_by_resource(db, project_id, body.resource_id)
    if existing:
        raise HTTPException(409, "Resource is already assigned to this project.")

    allocation_pct = body.allocation_pct if body.allocation_pct is not None else 100
    if allocation_pct < 0 or allocation_pct > 100:
        raise HTTPException(400, "allocation_pct must be between 0 and 100.")

    allocated_hours = body.allocated_hours
    if allocated_hours is None:
        allocated_hours = _default_allocated_hours(resource, allocation_pct)
    elif allocated_hours < 0:
        raise HTTPException(400, "allocated_hours must be non-negative.")

    start_date = _parse_optional_date(body.start_date)
    end_date = _parse_optional_date(body.end_date)
    if start_date and end_date and end_date < start_date:
        raise HTTPException(400, "end_date must be on or after start_date.")

    allocation = ResourceAllocation(
        resource_id=body.resource_id,
        project_id=project_id,
        task_id=None,
        allocation_pct=allocation_pct,
        allocated_hours=allocated_hours,
        start_date=start_date,
        end_date=end_date,
        role=body.role,
    )
    db.add(allocation)
    db.commit()
    db.refresh(allocation)
    return repo.format_project_resource_assignment(db, allocation)


def update_project_resource_assignment(db: Session, project_id: int, assignment_id: int, body) -> dict:
    allocation = repo.get_project_resource_assignment(db, project_id, assignment_id)
    if not allocation:
        raise HTTPException(404, "Project resource assignment not found.")

    resource = repo.get_resource_by_id(db, allocation.resource_id)
    if not resource:
        raise HTTPException(404, "Linked resource not found.")

    if body.allocation_pct is not None:
        if body.allocation_pct < 0 or body.allocation_pct > 100:
            raise HTTPException(400, "allocation_pct must be between 0 and 100.")
        allocation.allocation_pct = body.allocation_pct

    if body.allocated_hours is not None:
        if body.allocated_hours < 0:
            raise HTTPException(400, "allocated_hours must be non-negative.")
        allocation.allocated_hours = body.allocated_hours
    elif body.allocation_pct is not None and body.allocated_hours is None:
        allocation.allocated_hours = _default_allocated_hours(resource, body.allocation_pct)

    if body.role is not None:
        allocation.role = body.role or None

    if body.start_date is not None:
        allocation.start_date = _parse_optional_date(body.start_date)

    if body.end_date is not None:
        allocation.end_date = _parse_optional_date(body.end_date)

    if allocation.start_date and allocation.end_date and allocation.end_date < allocation.start_date:
        raise HTTPException(400, "end_date must be on or after start_date.")

    db.commit()
    db.refresh(allocation)
    return repo.format_project_resource_assignment(db, allocation)


def remove_resource_from_project(db: Session, project_id: int, assignment_id: int) -> None:
    allocation = repo.get_project_resource_assignment(db, project_id, assignment_id)
    if not allocation:
        raise HTTPException(404, "Project resource assignment not found.")
    db.delete(allocation)
    db.commit()

