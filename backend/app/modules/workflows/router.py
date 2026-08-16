"""Workflows router — templates, steps, custom transitions, project workflow stages."""
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_permissions
from app.modules.workflows.schemas import (
    TemplateCreateIn, WorkflowStageCreateIn, WorkflowStageUpdateIn, WorkflowStageReorderIn
)
from app.modules.workflows import service, repository as repo

router = APIRouter(tags=["Workflows"])


@router.get("/workflow-templates")
def list_templates(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    templates = repo.get_all_templates(db)
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "isGlobal": t.is_global,
            "stepCount": len(t.steps) if t.steps else 0,
        }
        for t in templates
    ]


@router.post("/workflow-templates", status_code=201)
def create_template(body: TemplateCreateIn, current_user=Depends(require_permissions("manage-settings")), db: Session = Depends(get_db)):
    t = service.create_template(db, body, current_user.id)
    return {"id": t.id, "name": t.name}


@router.get("/projects/{project_id}/workflows")
def list_project_workflows(project_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    workflows = repo.get_project_workflows(db, project_id)
    return [{"id": w.id, "name": w.name, "description": w.description, "isDefault": w.is_default} for w in workflows]


# ── Configurable Board Workflow Stages Endpoints ─────────────────────────

@router.get("/projects/{project_id}/stages")
def get_project_stages(project_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    stages = service.list_project_stages(db, project_id)
    return [
        {
            "id": s.id,
            "project_id": s.project_id,
            "name": s.name,
            "slug": s.slug,
            "category": s.category,
            "color": s.color,
            "position": s.position,
            "wip_limit": s.wip_limit,
            "is_initial": s.is_initial,
            "is_final": s.is_final,
            "is_active": s.is_active,
        }
        for s in stages
    ]


@router.post("/projects/{project_id}/stages", status_code=201)
def create_project_stage(
    project_id: int,
    body: WorkflowStageCreateIn,
    current_user=Depends(require_permissions("manage-workflows")),
    db: Session = Depends(get_db),
):
    stage = service.create_project_stage(db, project_id, body)
    return {
        "id": stage.id,
        "name": stage.name,
        "slug": stage.slug,
        "category": stage.category,
        "color": stage.color,
        "position": stage.position,
        "wip_limit": stage.wip_limit,
    }


@router.put("/projects/{project_id}/stages/{stage_id}")
def update_project_stage(
    project_id: int,
    stage_id: int,
    body: WorkflowStageUpdateIn,
    current_user=Depends(require_permissions("manage-workflows")),
    db: Session = Depends(get_db),
):
    stage = service.update_project_stage(db, stage_id, body)
    if not stage:
        raise HTTPException(404, "Workflow stage not found")
    return {
        "id": stage.id,
        "name": stage.name,
        "slug": stage.slug,
        "category": stage.category,
        "color": stage.color,
        "position": stage.position,
        "wip_limit": stage.wip_limit,
    }


@router.delete("/projects/{project_id}/stages/{stage_id}")
def delete_project_stage(
    project_id: int,
    stage_id: int,
    target_stage_id: Optional[int] = Query(None),
    current_user=Depends(require_permissions("manage-workflows")),
    db: Session = Depends(get_db),
):
    success = service.delete_project_stage(db, stage_id, target_stage_id)
    if not success:
        raise HTTPException(404, "Workflow stage not found")
    return {"message": "Stage deleted successfully"}


@router.post("/projects/{project_id}/stages/reorder")
def reorder_project_stages(
    project_id: int,
    body: WorkflowStageReorderIn,
    current_user=Depends(require_permissions("manage-workflows")),
    db: Session = Depends(get_db),
):
    stages = service.reorder_project_stages(db, project_id, body)
    return [
        {
            "id": s.id,
            "name": s.name,
            "position": s.position,
        }
        for s in stages
    ]


@router.post("/projects/{project_id}/stages/{stage_id}/duplicate")
def duplicate_project_stage(
    project_id: int,
    stage_id: int,
    current_user=Depends(require_permissions("manage-workflows")),
    db: Session = Depends(get_db),
):
    stg = service.duplicate_project_stage(db, stage_id)
    if not stg:
        raise HTTPException(404, "Workflow stage not found")
    return {"id": stg.id, "name": stg.name, "category": stg.category, "color": stg.color, "position": stg.position}


@router.post("/projects/{project_id}/stages/{stage_id}/archive")
def archive_project_stage(
    project_id: int,
    stage_id: int,
    archive: bool = Query(True),
    current_user=Depends(require_permissions("manage-workflows")),
    db: Session = Depends(get_db),
):
    stg = service.archive_project_stage(db, stage_id, archive)
    if not stg:
        raise HTTPException(404, "Workflow stage not found")
    return {"id": stg.id, "name": stg.name, "is_archived": stg.is_archived, "is_active": stg.is_active}


@router.post("/projects/{project_id}/copy-workflow-from/{source_project_id}")
def copy_workflow_to_project(
    project_id: int,
    source_project_id: int,
    current_user=Depends(require_permissions("manage-workflows")),
    db: Session = Depends(get_db),
):
    stages = service.copy_workflow_to_project(db, source_project_id, project_id)
    return [{"id": s.id, "name": s.name, "category": s.category, "color": s.color, "position": s.position} for s in stages]

