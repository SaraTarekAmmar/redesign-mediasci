from __future__ import annotations

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, aliased, selectinload

from app.models.planning import ProjectMilestone, ProjectDeliverable, ProjectMilestoneDependency
from app.models.project import Project
from app.models.resource import Resource


def get_project_or_none(db: Session, project_id: int) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()


def get_project_milestones(db: Session, project_id: int):
    return (
        db.query(ProjectMilestone)
        .options(
            selectinload(ProjectMilestone.deliverables),
            selectinload(ProjectMilestone.owner_resource),
        )
        .filter(ProjectMilestone.project_id == project_id)
        .order_by(ProjectMilestone.sort_order.asc(), ProjectMilestone.id.asc())
        .all()
    )


def get_milestone_by_id(db: Session, milestone_id: int) -> Optional[ProjectMilestone]:
    return (
        db.query(ProjectMilestone)
        .options(
            selectinload(ProjectMilestone.deliverables),
            selectinload(ProjectMilestone.owner_resource),
        )
        .filter(ProjectMilestone.id == milestone_id)
        .first()
    )


def get_project_milestone(db: Session, project_id: int, milestone_id: int) -> Optional[ProjectMilestone]:
    return (
        db.query(ProjectMilestone)
        .options(
            selectinload(ProjectMilestone.deliverables),
            selectinload(ProjectMilestone.owner_resource),
        )
        .filter(ProjectMilestone.project_id == project_id, ProjectMilestone.id == milestone_id)
        .first()
    )


def get_next_sort_order(db: Session, project_id: int) -> int:
    value = db.query(func.coalesce(func.max(ProjectMilestone.sort_order), -1)).filter(ProjectMilestone.project_id == project_id).scalar()
    return int(value or -1) + 1


def create_milestone(db: Session, milestone: ProjectMilestone) -> ProjectMilestone:
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone


def delete_milestone(db: Session, milestone: ProjectMilestone) -> None:
    db.delete(milestone)
    db.commit()


def get_project_milestone_dependencies(db: Session, project_id: int):
    predecessor = aliased(ProjectMilestone)
    successor = aliased(ProjectMilestone)
    return (
        db.query(ProjectMilestoneDependency)
        .join(predecessor, ProjectMilestoneDependency.predecessor_milestone_id == predecessor.id)
        .join(successor, ProjectMilestoneDependency.successor_milestone_id == successor.id)
        .options(
            selectinload(ProjectMilestoneDependency.predecessor_milestone),
            selectinload(ProjectMilestoneDependency.successor_milestone),
        )
        .filter(predecessor.project_id == project_id, successor.project_id == project_id)
        .order_by(ProjectMilestoneDependency.id.asc())
        .all()
    )


def get_milestone_dependency_by_id(db: Session, dependency_id: int) -> Optional[ProjectMilestoneDependency]:
    return (
        db.query(ProjectMilestoneDependency)
        .options(
            selectinload(ProjectMilestoneDependency.predecessor_milestone),
            selectinload(ProjectMilestoneDependency.successor_milestone),
        )
        .filter(ProjectMilestoneDependency.id == dependency_id)
        .first()
    )


def get_milestone_dependency_by_pair(
    db: Session,
    predecessor_milestone_id: int,
    successor_milestone_id: int,
    exclude_id: int | None = None,
) -> Optional[ProjectMilestoneDependency]:
    query = db.query(ProjectMilestoneDependency).filter(
        ProjectMilestoneDependency.predecessor_milestone_id == predecessor_milestone_id,
        ProjectMilestoneDependency.successor_milestone_id == successor_milestone_id,
    )
    if exclude_id is not None:
        query = query.filter(ProjectMilestoneDependency.id != exclude_id)
    return query.first()


def create_milestone_dependency(db: Session, dependency: ProjectMilestoneDependency) -> ProjectMilestoneDependency:
    db.add(dependency)
    db.commit()
    db.refresh(dependency)
    return dependency


def update_milestone_dependency(db: Session, dependency: ProjectMilestoneDependency) -> ProjectMilestoneDependency:
    db.commit()
    db.refresh(dependency)
    return dependency


def delete_milestone_dependency(db: Session, dependency: ProjectMilestoneDependency) -> None:
    db.delete(dependency)
    db.commit()


def get_resource_by_id(db: Session, resource_id: int) -> Optional[Resource]:
    return db.query(Resource).filter(Resource.id == resource_id).first()


def format_owner(resource: Optional[Resource]) -> Optional[dict]:
    if not resource:
        return None
    return {
        "id": resource.id,
        "name": resource.name,
        "email": resource.email,
        "position": resource.position,
        "seniority": resource.seniority,
        "availability_status": resource.availability_status,
    }


def _date_str(value):
    return value.isoformat() if value else None


def format_deliverable(deliverable: ProjectDeliverable) -> dict:
    return {
        "id": deliverable.id,
        "milestone_id": deliverable.milestone_id,
        "title": deliverable.title,
        "name": deliverable.title,
        "description": deliverable.description,
        "acceptance_criteria": deliverable.acceptance_criteria,
        "planned_completion_date": _date_str(deliverable.planned_completion_date),
        "actual_completion_date": _date_str(deliverable.actual_completion_date),
        "status": deliverable.status,
        "owner_resource_id": deliverable.owner_resource_id,
        "owner_resource": format_owner(deliverable.owner_resource),
        "date": _date_str(deliverable.planned_completion_date),
        "created_at": deliverable.created_at.isoformat() if deliverable.created_at else None,
        "updated_at": deliverable.updated_at.isoformat() if deliverable.updated_at else None,
    }


def format_milestone(milestone: ProjectMilestone) -> dict:
    deliverables = [format_deliverable(d) for d in (milestone.deliverables or [])]
    return {
        "id": milestone.id,
        "project_id": milestone.project_id,
        "name": milestone.name,
        "title": milestone.name,
        "description": milestone.description,
        "planned_start_date": _date_str(milestone.planned_start_date),
        "planned_end_date": _date_str(milestone.planned_end_date),
        "actual_start_date": _date_str(milestone.actual_start_date),
        "actual_end_date": _date_str(milestone.actual_end_date),
        "planned_hours": float(milestone.planned_hours or 0),
        "planned_budget": float(milestone.planned_budget or 0),
        "planned_progress": float(milestone.planned_progress or 0),
        "status": milestone.status,
        "owner_resource_id": milestone.owner_resource_id,
        "owner_resource": format_owner(milestone.owner_resource),
        "sort_order": milestone.sort_order or 0,
        "date": _date_str(milestone.planned_end_date or milestone.planned_start_date),
        "deliverables": deliverables,
        "deliverables_count": len(deliverables),
        "created_at": milestone.created_at.isoformat() if milestone.created_at else None,
        "updated_at": milestone.updated_at.isoformat() if milestone.updated_at else None,
    }


def format_milestone_reference(milestone: ProjectMilestone) -> dict:
    return {
        "id": milestone.id,
        "project_id": milestone.project_id,
        "name": milestone.name,
        "title": milestone.name,
        "status": milestone.status,
        "sort_order": milestone.sort_order or 0,
    }


def format_milestone_dependency(dependency: ProjectMilestoneDependency) -> dict:
    return {
        "id": dependency.id,
        "predecessor_milestone_id": dependency.predecessor_milestone_id,
        "successor_milestone_id": dependency.successor_milestone_id,
        "dependency_type": dependency.dependency_type,
        "predecessor_milestone": format_milestone_reference(dependency.predecessor_milestone),
        "successor_milestone": format_milestone_reference(dependency.successor_milestone),
        "created_at": dependency.created_at.isoformat() if dependency.created_at else None,
        "updated_at": dependency.updated_at.isoformat() if dependency.updated_at else None,
    }
