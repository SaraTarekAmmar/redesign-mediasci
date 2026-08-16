from datetime import datetime
from sqlalchemy.orm import Session
from app.models.scope import Scope, ScopeObjective, ScopeDeliverable
from app.modules.scope import repository as repo
from app.modules.scope.schemas import (
    ScopeDeliverableCreateIn, ScopeDeliverableUpdateIn,
    ScopeObjectiveCreateIn, ScopeObjectiveUpdateIn
)


def get_project_scope(db: Session, project_id: int):
    scope = repo.get_or_create_project_scope(db, project_id)
    objectives = [repo.format_scope_objective(o) for o in (scope.objectives or [])]
    deliverables = [repo.format_scope_deliverable(d) for d in (scope.deliverables or [])]
    return {
        "scope": {
            "id": str(scope.id),
            "project_id": str(scope.project_id),
            "description": scope.description or "",
            "status": scope.status or "draft",
        },
        "objectives": objectives,
        "deliverables": deliverables,
    }


def create_deliverable(db: Session, scope_id: int, body: ScopeDeliverableCreateIn):
    title = (body.name or body.title or "Untitled Deliverable").strip()
    due_date = body.due_date or body.dueDate

    deliverable = ScopeDeliverable(
        scope_id=scope_id,
        title=title,
        description=body.description,
        due_date=due_date,
        status=body.status or "pending",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)
    db.expire_all()
    return {"deliverable": repo.format_scope_deliverable(deliverable)}


def update_deliverable(db: Session, deliverable_id: int, body: ScopeDeliverableUpdateIn):
    deliverable = db.query(ScopeDeliverable).filter(ScopeDeliverable.id == deliverable_id).first()
    if not deliverable:
        return None

    data = body.model_dump(exclude_unset=True)
    if "name" in data or "title" in data:
        title = (body.name or body.title or "").strip()
        if title:
            deliverable.title = title
    if "description" in data:
        deliverable.description = body.description
    if "due_date" in data or "dueDate" in data:
        deliverable.due_date = body.due_date or body.dueDate
    if "status" in data and body.status is not None:
        deliverable.status = body.status

    deliverable.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(deliverable)
    db.expire_all()
    return {"deliverable": repo.format_scope_deliverable(deliverable)}


def delete_deliverable(db: Session, deliverable_id: int) -> bool:
    deliverable = db.query(ScopeDeliverable).filter(ScopeDeliverable.id == deliverable_id).first()
    if not deliverable:
        return False
    db.delete(deliverable)
    db.commit()
    db.expire_all()
    return True


def create_objective(db: Session, scope_id: int, body: ScopeObjectiveCreateIn):
    title = (body.title or "Untitled Objective").strip()
    priority = body.priority or body.status or "medium"
    obj = ScopeObjective(
        scope_id=scope_id,
        title=title,
        description=body.description,
        priority=priority,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    db.expire_all()
    return {"objective": repo.format_scope_objective(obj)}


def update_objective(db: Session, objective_id: int, body: ScopeObjectiveUpdateIn):
    obj = db.query(ScopeObjective).filter(ScopeObjective.id == objective_id).first()
    if not obj:
        return None

    data = body.model_dump(exclude_unset=True)
    if "title" in data and body.title:
        obj.title = body.title.strip()
    if "description" in data:
        obj.description = body.description
    if "priority" in data or "status" in data:
        obj.priority = body.priority or body.status

    obj.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(obj)
    db.expire_all()
    return {"objective": repo.format_scope_objective(obj)}


def delete_objective(db: Session, objective_id: int) -> bool:
    obj = db.query(ScopeObjective).filter(ScopeObjective.id == objective_id).first()
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    db.expire_all()
    return True
