from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import require_permissions, get_current_user
from app.modules.scope import service
from app.modules.scope.schemas import (
    ScopeDeliverableCreateIn, ScopeDeliverableUpdateIn,
    ScopeObjectiveCreateIn, ScopeObjectiveUpdateIn
)

router = APIRouter(tags=["Project Scope"])


@router.get("/projects/{project_id}/scope")
def get_project_scope(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_project_scope(db, project_id)


@router.post("/projects/{project_id}/scope/{scope_id}/deliverables", status_code=201)
@router.post("/scope/{scope_id}/deliverables", status_code=201)
def create_scope_deliverable(
    scope_id: int,
    body: ScopeDeliverableCreateIn,
    project_id: int = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_deliverable(db, scope_id, body)


@router.put("/projects/{project_id}/scope/deliverables/{deliverable_id}")
@router.put("/scope/deliverables/{deliverable_id}")
def update_scope_deliverable(
    deliverable_id: int,
    body: ScopeDeliverableUpdateIn,
    project_id: int = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    res = service.update_deliverable(db, deliverable_id, body)
    if not res:
        raise HTTPException(404, "Scope deliverable not found.")
    return res


@router.delete("/projects/{project_id}/scope/deliverables/{deliverable_id}")
@router.delete("/scope/deliverables/{deliverable_id}")
def delete_scope_deliverable(
    deliverable_id: int,
    project_id: int = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = service.delete_deliverable(db, deliverable_id)
    if not success:
        raise HTTPException(404, "Scope deliverable not found.")
    return {"message": "Scope deliverable deleted successfully."}


@router.post("/projects/{project_id}/scope/{scope_id}/objectives", status_code=201)
@router.post("/scope/{scope_id}/objectives", status_code=201)
def create_scope_objective(
    scope_id: int,
    body: ScopeObjectiveCreateIn,
    project_id: int = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_objective(db, scope_id, body)


@router.put("/projects/{project_id}/scope/objectives/{objective_id}")
@router.put("/scope/objectives/{objective_id}")
def update_scope_objective(
    objective_id: int,
    body: ScopeObjectiveUpdateIn,
    project_id: int = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    res = service.update_objective(db, objective_id, body)
    if not res:
        raise HTTPException(404, "Scope objective not found.")
    return res


@router.delete("/projects/{project_id}/scope/objectives/{objective_id}")
@router.delete("/scope/objectives/{objective_id}")
def delete_scope_objective(
    objective_id: int,
    project_id: int = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = service.delete_objective(db, objective_id)
    if not success:
        raise HTTPException(404, "Scope objective not found.")
    return {"message": "Scope objective deleted successfully."}
