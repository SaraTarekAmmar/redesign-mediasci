from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.modules.milestones.schemas import (
    MilestoneCreateIn,
    MilestoneUpdateIn,
    MilestoneDependencyCreateIn,
    MilestoneDependencyUpdateIn,
)
from app.modules.milestones import service, repository as repo

router = APIRouter(tags=["Milestones"])


@router.get("/projects/{project_id}/milestones")
def list_project_milestones(
    project_id: int,
    current_user=Depends(require_permissions("view-scope")),
    db: Session = Depends(get_db),
):
    milestones = service.list_project_milestones(db, project_id)
    return [repo.format_milestone(m) for m in milestones]


@router.get("/projects/{project_id}/milestones/{milestone_id}")
def get_project_milestone(
    project_id: int,
    milestone_id: int,
    current_user=Depends(require_permissions("view-scope")),
    db: Session = Depends(get_db),
):
    milestone = service.get_project_milestone(db, project_id, milestone_id)
    if not milestone:
        raise HTTPException(404, "Milestone not found.")
    return repo.format_milestone(milestone)


@router.post("/projects/{project_id}/milestones", status_code=201)
def create_project_milestone(
    project_id: int,
    body: MilestoneCreateIn,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    try:
        milestone = service.create_project_milestone(db, project_id, body, actor_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return repo.format_milestone(milestone)


@router.put("/projects/{project_id}/milestones/{milestone_id}")
def update_project_milestone(
    project_id: int,
    milestone_id: int,
    body: MilestoneUpdateIn,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    milestone = service.update_project_milestone(db, project_id, milestone_id, body, actor_id=current_user.id)
    if not milestone:
        raise HTTPException(404, "Milestone not found.")
    return repo.format_milestone(milestone)


@router.delete("/projects/{project_id}/milestones/{milestone_id}")
def delete_project_milestone(
    project_id: int,
    milestone_id: int,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    success = service.delete_project_milestone(db, project_id, milestone_id, actor_id=current_user.id)
    if not success:
        raise HTTPException(404, "Milestone not found.")
    return {"message": "Milestone deleted successfully."}


@router.get("/projects/{project_id}/milestone-dependencies")
def list_project_milestone_dependencies(
    project_id: int,
    current_user=Depends(require_permissions("view-scope")),
    db: Session = Depends(get_db),
):
    dependencies = service.list_project_milestone_dependencies(db, project_id)
    return [repo.format_milestone_dependency(dependency) for dependency in dependencies]


@router.post("/projects/{project_id}/milestone-dependencies", status_code=201)
def create_project_milestone_dependency(
    project_id: int,
    body: MilestoneDependencyCreateIn,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    try:
        dependency = service.create_project_milestone_dependency(db, project_id, body, actor_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return repo.format_milestone_dependency(dependency)


@router.put("/milestone-dependencies/{dependency_id}")
def update_project_milestone_dependency(
    dependency_id: int,
    body: MilestoneDependencyUpdateIn,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    try:
        dependency = service.update_project_milestone_dependency(db, dependency_id, body, actor_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    if not dependency:
        raise HTTPException(404, "Milestone dependency not found.")
    return repo.format_milestone_dependency(dependency)


@router.delete("/milestone-dependencies/{dependency_id}")
def delete_project_milestone_dependency(
    dependency_id: int,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    success = service.delete_project_milestone_dependency(db, dependency_id, actor_id=current_user.id)
    if not success:
        raise HTTPException(404, "Milestone dependency not found.")
    return {"message": "Milestone dependency deleted successfully."}
