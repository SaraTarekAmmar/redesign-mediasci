from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.modules.deliverables.schemas import DeliverableCreateIn, DeliverableUpdateIn
from app.modules.deliverables import service
from app.modules.milestones.repository import format_deliverable

router = APIRouter(tags=["Deliverables"])


@router.get("/milestones/{milestone_id}/deliverables")
def list_milestone_deliverables(
    milestone_id: int,
    current_user=Depends(require_permissions("view-scope")),
    db: Session = Depends(get_db),
):
    deliverables = service.list_milestone_deliverables(db, milestone_id)
    return [format_deliverable(d) for d in deliverables]


@router.get("/deliverables/{deliverable_id}")
def get_deliverable(
    deliverable_id: int,
    current_user=Depends(require_permissions("view-scope")),
    db: Session = Depends(get_db),
):
    deliverable = service.get_deliverable(db, deliverable_id)
    if not deliverable:
        raise HTTPException(404, "Deliverable not found.")
    return format_deliverable(deliverable)


@router.post("/milestones/{milestone_id}/deliverables", status_code=201)
def create_deliverable(
    milestone_id: int,
    body: DeliverableCreateIn,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    try:
        deliverable = service.create_deliverable(db, milestone_id, body, actor_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return format_deliverable(deliverable)


@router.put("/deliverables/{deliverable_id}")
def update_deliverable(
    deliverable_id: int,
    body: DeliverableUpdateIn,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    deliverable = service.update_deliverable(db, deliverable_id, body, actor_id=current_user.id)
    if not deliverable:
        raise HTTPException(404, "Deliverable not found.")
    return format_deliverable(deliverable)


@router.delete("/deliverables/{deliverable_id}")
def delete_deliverable(
    deliverable_id: int,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    success = service.delete_deliverable(db, deliverable_id, actor_id=current_user.id)
    if not success:
        raise HTTPException(404, "Deliverable not found.")
    return {"message": "Deliverable deleted successfully."}
