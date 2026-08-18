from typing import Optional, List
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime
from app.models.resource import (
    Resource, ResourceAllocation, ResourceAvailability, Skill, ResourceSkill, Certification, ResourceCertification
)
from app.models.user import User, team_user, project_members
from app.models.team import Team, Department, team_resources
from app.models.project import Project


def get_resources_query(
    db: Session,
    q: str = "",
    department_id: Optional[int] = None,
    team_id: Optional[int] = None,
    position: Optional[str] = None,
    seniority: Optional[str] = None,
    availability_status: Optional[str] = None,
    project_id: Optional[int] = None,
    is_active: Optional[bool] = None,
):
    query = db.query(Resource).join(User, Resource.user_id == User.id).filter(User.deleted_at.is_(None))

    if q:
        term = f"%{q}%"
        query = query.filter(
            Resource.name.ilike(term) |
            Resource.email.ilike(term) |
            Resource.employee_number.ilike(term) |
            Resource.position.ilike(term)
        )
    if department_id:
        query = query.filter(Resource.department_id == department_id)
    if team_id:
        query = query.join(team_resources, team_resources.c.resource_id == Resource.id).filter(team_resources.c.team_id == team_id)
    if position:
        query = query.filter(Resource.position.ilike(f"%{position}%"))
    if seniority:
        query = query.filter(Resource.seniority.ilike(f"%{seniority}%"))
    if availability_status:
        query = query.filter(Resource.availability_status == availability_status)
    if project_id:
        query = (
            query
            .outerjoin(project_members, project_members.c.user_id == User.id)
            .outerjoin(Project, Project.owner_id == User.id)
            .filter((project_members.c.project_id == project_id) | (Project.id == project_id))
        )
    if is_active is not None:
        query = query.filter(Resource.is_active == (1 if is_active else 0))

    return query.distinct().order_by(Resource.name)


def get_resource_by_id(db: Session, resource_id: int) -> Optional[Resource]:
    return db.query(Resource).filter(Resource.id == resource_id).first()


def compute_resource_utilization(db: Session, resource_id: int, weekly_capacity: float) -> float:
    # Dynamically compute total allocated hours / capacity
    total_hours = (
        db.query(func.coalesce(func.sum(ResourceAllocation.allocated_hours), 0))
        .filter(ResourceAllocation.resource_id == resource_id)
        .scalar()
    )
    cap = float(weekly_capacity or 40.0)
    if cap <= 0:
        return 0.0
    return round((float(total_hours) / cap) * 100, 2)


def format_resource_profile(db: Session, resource: Resource) -> dict:
    u = resource.linked_user
    dept = None
    if resource.department_id:
        d = db.query(Department).filter(Department.id == resource.department_id).first()
        if d:
            dept = {"id": d.id, "name": d.name}

    teams = [
        {"id": t.id, "name": t.name, "color": t.color or "#111827"}
        for t in resource.teams
    ] if resource.teams else []

    # Dynamic Utilization Calculation
    weekly_cap = float(resource.weekly_capacity or 40.0)
    utilization_percentage = compute_resource_utilization(db, resource.id, weekly_cap)

    # Normalized Skills
    skills_data = []
    for rs in resource.resource_skills:
        if rs.skill:
            skills_data.append({
                "id": rs.skill.id,
                "name": rs.skill.name,
                "category": rs.skill.category,
                "proficiency": rs.proficiency or "mid",
                "years_of_experience": float(rs.years_of_experience or 1.0),
                "verified": bool(rs.verified),
            })

    # Normalized Certifications
    certs_data = []
    for rc in resource.resource_certifications:
        if rc.certification:
            certs_data.append({
                "id": rc.certification.id,
                "name": rc.certification.name,
                "provider": rc.certification.provider,
                "issue_date": rc.issue_date.isoformat() if rc.issue_date else None,
                "expiry_date": rc.expiry_date.isoformat() if rc.expiry_date else None,
                "credential_id": rc.credential_id,
                "url": rc.url,
            })

    # Assigned Projects
    user_id = resource.user_id
    project_rows = (
        db.query(Project)
        .outerjoin(project_members, project_members.c.project_id == Project.id)
        .filter(
            (Project.owner_id == user_id) | (project_members.c.user_id == user_id),
            Project.deleted_at.is_(None),
        )
        .distinct()
        .all()
    ) if user_id else []

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

    return {
        "id": resource.id,
        "user_id": resource.user_id,
        "employee_number": resource.employee_number or f"EMP-{resource.id:03d}",
        "name": resource.name,
        "email": resource.email or (u.email if u else ""),
        "avatar_url": u.avatar_url if u else f"https://ui-avatars.com/api/?name={resource.name}&background=4f46e5&color=fff",
        "phone": u.phone if u else None,
        "bio": u.bio if u else None,
        "department_id": resource.department_id,
        "department": dept,
        "position": resource.position or "Team Member",
        "seniority": resource.seniority or "Mid",
        "salary": float(resource.salary) if resource.salary is not None else 0.0,
        "currency": resource.currency or "USD",
        "cost_per_hour": float(resource.cost_per_hour) if resource.cost_per_hour is not None else 0.0,
        "weekly_capacity": weekly_cap,
        "daily_capacity_hours": float(resource.daily_capacity_hours) if resource.daily_capacity_hours is not None else 8.0,
        "availability_status": resource.availability_status or "available",
        "utilization_percentage": utilization_percentage,
        "contract_type": resource.contract_type or "full_time",
        "experience_years": float(resource.experience_years) if resource.experience_years is not None else 0.0,
        "skills": skills_data,
        "skills_count": len(skills_data),
        "certifications": certs_data,
        "certifications_count": len(certs_data),
        "is_active": bool(resource.is_active),
        "teams": teams,
        "assigned_projects": assigned_projects,
    }


def get_project_resource_assignments(db: Session, project_id: int) -> list[ResourceAllocation]:
    return (
        db.query(ResourceAllocation)
        .filter(
            ResourceAllocation.project_id == project_id,
            ResourceAllocation.task_id.is_(None),
        )
        .order_by(ResourceAllocation.id)
        .all()
    )


def get_project_resource_assignment(
    db: Session, project_id: int, assignment_id: int
) -> ResourceAllocation | None:
    return (
        db.query(ResourceAllocation)
        .filter(
            ResourceAllocation.id == assignment_id,
            ResourceAllocation.project_id == project_id,
            ResourceAllocation.task_id.is_(None),
        )
        .first()
    )


def get_project_resource_assignment_by_resource(
    db: Session, project_id: int, resource_id: int
) -> ResourceAllocation | None:
    return (
        db.query(ResourceAllocation)
        .filter(
            ResourceAllocation.project_id == project_id,
            ResourceAllocation.resource_id == resource_id,
            ResourceAllocation.task_id.is_(None),
        )
        .first()
    )


def format_project_resource_assignment(db: Session, allocation: ResourceAllocation) -> dict:
    resource = allocation.resource or db.query(Resource).filter(Resource.id == allocation.resource_id).first()
    weekly_cap = float(resource.weekly_capacity or 40.0) if resource else 40.0
    utilization = compute_resource_utilization(db, allocation.resource_id, weekly_cap) if resource else 0.0
    overloaded = utilization > 100
    return {
        "id": allocation.id,
        "resource_id": allocation.resource_id,
        "project_id": allocation.project_id,
        "name": resource.name if resource else "Unknown",
        "position": resource.position if resource else None,
        "role": allocation.role,
        "allocation_pct": int(allocation.allocation_pct or 100),
        "allocated_hours": float(allocation.allocated_hours or 0),
        "weekly_capacity": weekly_cap,
        "utilization_percentage": utilization,
        "availability_status": resource.availability_status if resource else None,
        "overloaded": overloaded,
        "start_date": allocation.start_date.isoformat() if allocation.start_date else None,
        "end_date": allocation.end_date.isoformat() if allocation.end_date else None,
        "status": "Overallocated" if overloaded else (resource.availability_status if resource else "assigned"),
    }
