from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.modules.administration.repository import write_audit_log
from app.models.planning import ProjectDeliverable
from app.modules.deliverables import repository as repo
from app.modules.deliverables.schemas import DeliverableCreateIn, DeliverableUpdateIn
from app.modules.milestones.repository import get_milestone_by_id


def _resolve_title(body: DeliverableCreateIn | DeliverableUpdateIn) -> str:
    return (body.title or body.name or "").strip()


def _deliverable_snapshot(deliverable: ProjectDeliverable) -> dict:
    return {
        "id": deliverable.id,
        "milestone_id": deliverable.milestone_id,
        "title": deliverable.title,
        "description": deliverable.description,
        "acceptance_criteria": deliverable.acceptance_criteria,
        "planned_completion_date": deliverable.planned_completion_date.isoformat() if deliverable.planned_completion_date else None,
        "actual_completion_date": deliverable.actual_completion_date.isoformat() if deliverable.actual_completion_date else None,
        "status": deliverable.status,
        "owner_resource_id": deliverable.owner_resource_id,
    }


def list_milestone_deliverables(db: Session, milestone_id: int):
    return repo.get_milestone_deliverables(db, milestone_id)


def get_deliverable(db: Session, deliverable_id: int):
    return repo.get_deliverable_by_id(db, deliverable_id)


def create_deliverable(db: Session, milestone_id: int, body: DeliverableCreateIn, actor_id: int | None = None) -> ProjectDeliverable:
    milestone = get_milestone_by_id(db, milestone_id)
    if not milestone:
        raise ValueError("Milestone not found.")

    title = _resolve_title(body)
    if not title:
        raise ValueError("Deliverable title is required.")

    planned_date = body.planned_completion_date or body.due_date or body.date

    deliverable = ProjectDeliverable(
        milestone_id=milestone_id,
        title=title,
        description=body.description,
        acceptance_criteria=body.acceptance_criteria,
        planned_completion_date=planned_date,
        actual_completion_date=body.actual_completion_date,
        status=body.status or "pending",
        owner_resource_id=body.owner_resource_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="create",
            entity_type="planning_deliverable",
            entity_id=deliverable.id,
            old_values={},
            new_values=_deliverable_snapshot(deliverable),
        )
        db.commit()
    db.expire_all()
    return deliverable


def update_deliverable(db: Session, deliverable_id: int, body: DeliverableUpdateIn, actor_id: int | None = None):
    deliverable = repo.get_deliverable_by_id(db, deliverable_id)
    if not deliverable:
        return None
    old_values = _deliverable_snapshot(deliverable)

    data = body.model_dump(exclude_unset=True)
    if "title" in data or "name" in data:
        title = _resolve_title(body)
        if title:
            deliverable.title = title
    if "description" in data:
        deliverable.description = body.description
    if "acceptance_criteria" in data:
        deliverable.acceptance_criteria = body.acceptance_criteria
    if "planned_completion_date" in data or "due_date" in data or "date" in data:
        planned_date = body.planned_completion_date or body.due_date or body.date
        deliverable.planned_completion_date = planned_date
    if "actual_completion_date" in data:
        deliverable.actual_completion_date = body.actual_completion_date
    if "status" in data and body.status is not None:
        deliverable.status = body.status
    if "owner_resource_id" in data:
        deliverable.owner_resource_id = body.owner_resource_id

    deliverable.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(deliverable)
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="update",
            entity_type="planning_deliverable",
            entity_id=deliverable.id,
            old_values=old_values,
            new_values=_deliverable_snapshot(deliverable),
        )
        db.commit()
    db.expire_all()
    return deliverable


def delete_deliverable(db: Session, deliverable_id: int, actor_id: int | None = None) -> bool:
    deliverable = repo.get_deliverable_by_id(db, deliverable_id)
    if not deliverable:
        return False
    old_values = _deliverable_snapshot(deliverable)
    db.delete(deliverable)
    db.commit()
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="delete",
            entity_type="planning_deliverable",
            entity_id=deliverable_id,
            old_values=old_values,
            new_values={},
        )
        db.commit()
    db.expire_all()
    return True
