from sqlalchemy.orm import Session, joinedload
from app.models.scope import Scope, ScopeObjective, ScopeDeliverable


def get_or_create_project_scope(db: Session, project_id: int) -> Scope:
    scope = (
        db.query(Scope)
        .options(
            joinedload(Scope.objectives),
            joinedload(Scope.deliverables),
        )
        .filter(Scope.project_id == project_id)
        .first()
    )
    if not scope:
        scope = Scope(project_id=project_id, description="", status="draft")
        db.add(scope)
        db.commit()
        db.refresh(scope)
    return scope


def format_scope_deliverable(d: ScopeDeliverable) -> dict:
    due_str = d.due_date.isoformat() if d.due_date else None
    return {
        "id": str(d.id),
        "scope_id": str(d.scope_id),
        "name": d.title,
        "title": d.title,
        "description": d.description or "",
        "dueDate": due_str,
        "due_date": due_str,
        "status": d.status or "pending",
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


def format_scope_objective(o: ScopeObjective) -> dict:
    return {
        "id": str(o.id),
        "scope_id": str(o.scope_id),
        "title": o.title,
        "description": o.description or "",
        "priority": o.priority or "medium",
        "status": o.priority or "pending",
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }
