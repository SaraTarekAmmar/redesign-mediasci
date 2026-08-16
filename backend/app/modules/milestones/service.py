from __future__ import annotations

from datetime import datetime
from collections import defaultdict, deque

from sqlalchemy.orm import Session

from app.modules.administration.repository import write_audit_log
from app.models.planning import ProjectMilestone, ProjectMilestoneDependency
from app.modules.milestones import repository as repo
from app.modules.milestones.schemas import (
    MilestoneCreateIn,
    MilestoneUpdateIn,
    MilestoneDependencyCreateIn,
    MilestoneDependencyUpdateIn,
)


DEPENDENCY_TYPE_ALIASES = {
    "finish_to_start": "finish_to_start",
    "finish-to-start": "finish_to_start",
    "Finish-to-Start": "finish_to_start",
    "start_to_start": "start_to_start",
    "start-to-start": "start_to_start",
    "Start-to-Start": "start_to_start",
    "finish_to_finish": "finish_to_finish",
    "finish-to-finish": "finish_to_finish",
    "Finish-to-Finish": "finish_to_finish",
    "start_to_finish": "start_to_finish",
    "start-to-finish": "start_to_finish",
    "Start-to-Finish": "start_to_finish",
}

VALID_DEPENDENCY_TYPES = {
    "finish_to_start",
    "start_to_start",
    "finish_to_finish",
    "start_to_finish",
}


def _resolve_name(body: MilestoneCreateIn | MilestoneUpdateIn) -> str:
    return (body.name or body.title or "").strip()


def _resolve_dates(body: MilestoneCreateIn | MilestoneUpdateIn):
    planned_start = body.planned_start_date
    planned_end = body.planned_end_date
    if getattr(body, "date", None) and not planned_start and not planned_end:
        planned_start = body.date
        planned_end = body.date
    return planned_start, planned_end


def _milestone_snapshot(milestone: ProjectMilestone) -> dict:
    return {
        "id": milestone.id,
        "project_id": milestone.project_id,
        "name": milestone.name,
        "description": milestone.description,
        "planned_start_date": milestone.planned_start_date.isoformat() if milestone.planned_start_date else None,
        "planned_end_date": milestone.planned_end_date.isoformat() if milestone.planned_end_date else None,
        "actual_start_date": milestone.actual_start_date.isoformat() if milestone.actual_start_date else None,
        "actual_end_date": milestone.actual_end_date.isoformat() if milestone.actual_end_date else None,
        "planned_hours": float(milestone.planned_hours or 0),
        "planned_budget": float(milestone.planned_budget or 0),
        "planned_progress": float(milestone.planned_progress or 0),
        "status": milestone.status,
        "owner_resource_id": milestone.owner_resource_id,
        "sort_order": milestone.sort_order,
    }


def _dependency_snapshot(dependency: ProjectMilestoneDependency) -> dict:
    return {
        "id": dependency.id,
        "predecessor_milestone_id": dependency.predecessor_milestone_id,
        "successor_milestone_id": dependency.successor_milestone_id,
        "dependency_type": dependency.dependency_type,
    }


def list_project_milestones(db: Session, project_id: int):
    return repo.get_project_milestones(db, project_id)


def get_project_milestone(db: Session, project_id: int, milestone_id: int):
    return repo.get_project_milestone(db, project_id, milestone_id)


def create_project_milestone(db: Session, project_id: int, body: MilestoneCreateIn, actor_id: int | None = None) -> ProjectMilestone:
    project = repo.get_project_or_none(db, project_id)
    if not project:
        raise ValueError("Project not found.")

    name = _resolve_name(body)
    if not name:
        raise ValueError("Milestone name is required.")

    planned_start, planned_end = _resolve_dates(body)
    milestone = ProjectMilestone(
        project_id=project_id,
        name=name,
        description=body.description,
        planned_start_date=planned_start,
        planned_end_date=planned_end,
        actual_start_date=body.actual_start_date,
        actual_end_date=body.actual_end_date,
        planned_hours=body.planned_hours or 0,
        planned_budget=body.planned_budget or 0,
        planned_progress=body.planned_progress or 0,
        status=body.status or "pending",
        owner_resource_id=body.owner_resource_id,
        sort_order=body.sort_order if body.sort_order is not None else repo.get_next_sort_order(db, project_id),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    milestone = repo.create_milestone(db, milestone)
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="create",
            entity_type="planning_milestone",
            entity_id=milestone.id,
            old_values={},
            new_values=_milestone_snapshot(milestone),
        )
        db.commit()
    return milestone


def update_project_milestone(db: Session, project_id: int, milestone_id: int, body: MilestoneUpdateIn, actor_id: int | None = None):
    milestone = repo.get_project_milestone(db, project_id, milestone_id)
    if not milestone:
        return None
    old_values = _milestone_snapshot(milestone)

    data = body.model_dump(exclude_unset=True)
    if "name" in data or "title" in data:
        name = _resolve_name(body)
        if name:
            milestone.name = name
    if "description" in data:
        milestone.description = body.description
    if "planned_start_date" in data or "planned_end_date" in data or "date" in data:
        planned_start, planned_end = _resolve_dates(body)
        milestone.planned_start_date = planned_start
        milestone.planned_end_date = planned_end
    if "actual_start_date" in data:
        milestone.actual_start_date = body.actual_start_date
    if "actual_end_date" in data:
        milestone.actual_end_date = body.actual_end_date
    if "planned_hours" in data:
        milestone.planned_hours = body.planned_hours or 0
    if "planned_budget" in data:
        milestone.planned_budget = body.planned_budget or 0
    if "planned_progress" in data:
        milestone.planned_progress = body.planned_progress or 0
    if "status" in data and body.status is not None:
        milestone.status = body.status
    if "owner_resource_id" in data:
        milestone.owner_resource_id = body.owner_resource_id
    if "sort_order" in data and body.sort_order is not None:
        milestone.sort_order = body.sort_order

    milestone.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(milestone)
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="update",
            entity_type="planning_milestone",
            entity_id=milestone.id,
            old_values=old_values,
            new_values=_milestone_snapshot(milestone),
        )
        db.commit()
    return milestone


def delete_project_milestone(db: Session, project_id: int, milestone_id: int, actor_id: int | None = None) -> bool:
    milestone = repo.get_project_milestone(db, project_id, milestone_id)
    if not milestone:
        return False
    old_values = _milestone_snapshot(milestone)
    repo.delete_milestone(db, milestone)
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="delete",
            entity_type="planning_milestone",
            entity_id=milestone_id,
            old_values=old_values,
            new_values={},
        )
        db.commit()
    return True


def _normalize_dependency_type(value: str | None) -> str:
    if not value:
        return "finish_to_start"
    cleaned = value.strip().replace(" ", "_").replace("-", "_").lower()
    normalized = DEPENDENCY_TYPE_ALIASES.get(value, DEPENDENCY_TYPE_ALIASES.get(cleaned, cleaned))
    if normalized not in VALID_DEPENDENCY_TYPES:
        raise ValueError("Invalid dependency type.")
    return normalized


def _get_project_milestone_or_raise(db: Session, milestone_id: int, project_id: int) -> ProjectMilestone:
    milestone = repo.get_milestone_by_id(db, milestone_id)
    if not milestone or milestone.project_id != project_id:
        raise ValueError("Milestones must belong to the same project.")
    return milestone


def _build_adjacency(dependencies):
    adjacency = defaultdict(set)
    for dependency in dependencies:
        adjacency[dependency.predecessor_milestone_id].add(dependency.successor_milestone_id)
    return adjacency


def _has_path(adjacency, start_id: int, target_id: int) -> bool:
    if start_id == target_id:
        return True
    visited = set()
    queue = deque([start_id])
    while queue:
        current = queue.popleft()
        if current in visited:
            continue
        visited.add(current)
        for next_id in adjacency.get(current, set()):
            if next_id == target_id:
                return True
            if next_id not in visited:
                queue.append(next_id)
    return False


def list_project_milestone_dependencies(db: Session, project_id: int):
    return repo.get_project_milestone_dependencies(db, project_id)


def create_project_milestone_dependency(
    db: Session,
    project_id: int,
    body: MilestoneDependencyCreateIn,
    actor_id: int | None = None,
) -> ProjectMilestoneDependency:
    predecessor = _get_project_milestone_or_raise(db, body.predecessor_milestone_id, project_id)
    successor = _get_project_milestone_or_raise(db, body.successor_milestone_id, project_id)

    if predecessor.id == successor.id:
        raise ValueError("A milestone cannot depend on itself.")

    dependency_type = _normalize_dependency_type(body.dependency_type)

    existing = repo.get_milestone_dependency_by_pair(db, predecessor.id, successor.id)
    if existing:
        raise ValueError("This dependency already exists.")

    project_dependencies = repo.get_project_milestone_dependencies(db, project_id)
    adjacency = _build_adjacency(project_dependencies)
    if _has_path(adjacency, successor.id, predecessor.id):
        raise ValueError("Circular dependencies are not allowed.")

    dependency = ProjectMilestoneDependency(
        predecessor_milestone_id=predecessor.id,
        successor_milestone_id=successor.id,
        dependency_type=dependency_type,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    dependency = repo.create_milestone_dependency(db, dependency)
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="create",
            entity_type="planning_dependency",
            entity_id=dependency.id,
            old_values={},
            new_values=_dependency_snapshot(dependency),
        )
        db.commit()
    return dependency


def update_project_milestone_dependency(
    db: Session,
    dependency_id: int,
    body: MilestoneDependencyUpdateIn,
    actor_id: int | None = None,
) -> ProjectMilestoneDependency | None:
    dependency = repo.get_milestone_dependency_by_id(db, dependency_id)
    if not dependency:
        return None

    project_id = dependency.successor_milestone.project_id
    data = body.model_dump(exclude_unset=True)

    predecessor_id = dependency.predecessor_milestone_id
    successor_id = dependency.successor_milestone_id

    if "predecessor_milestone_id" in data:
        predecessor_id = body.predecessor_milestone_id if body.predecessor_milestone_id is not None else predecessor_id
    if "successor_milestone_id" in data:
        successor_id = body.successor_milestone_id if body.successor_milestone_id is not None else successor_id

    predecessor = _get_project_milestone_or_raise(db, predecessor_id, project_id)
    successor = _get_project_milestone_or_raise(db, successor_id, project_id)

    if predecessor.id == successor.id:
        raise ValueError("A milestone cannot depend on itself.")

    dependency_type = dependency.dependency_type
    if "dependency_type" in data:
        dependency_type = _normalize_dependency_type(body.dependency_type)

    existing = repo.get_milestone_dependency_by_pair(db, predecessor.id, successor.id, exclude_id=dependency.id)
    if existing:
        raise ValueError("This dependency already exists.")

    project_dependencies = [item for item in repo.get_project_milestone_dependencies(db, project_id) if item.id != dependency.id]
    adjacency = _build_adjacency(project_dependencies)
    if _has_path(adjacency, successor.id, predecessor.id):
        raise ValueError("Circular dependencies are not allowed.")

    old_values = _dependency_snapshot(dependency)

    dependency.predecessor_milestone_id = predecessor.id
    dependency.successor_milestone_id = successor.id
    dependency.dependency_type = dependency_type
    dependency.updated_at = datetime.utcnow()
    dependency = repo.update_milestone_dependency(db, dependency)
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="update",
            entity_type="planning_dependency",
            entity_id=dependency.id,
            old_values=old_values,
            new_values=_dependency_snapshot(dependency),
        )
        db.commit()
    return dependency


def delete_project_milestone_dependency(db: Session, dependency_id: int, actor_id: int | None = None) -> bool:
    dependency = repo.get_milestone_dependency_by_id(db, dependency_id)
    if not dependency:
        return False
    old_values = _dependency_snapshot(dependency)
    repo.delete_milestone_dependency(db, dependency)
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="delete",
            entity_type="planning_dependency",
            entity_id=dependency_id,
            old_values=old_values,
            new_values={},
        )
        db.commit()
    return True
