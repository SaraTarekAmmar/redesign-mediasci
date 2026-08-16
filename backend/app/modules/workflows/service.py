from typing import Optional, List
from sqlalchemy.orm import Session
from app.modules.workflows import repository as repo
from app.modules.workflows.schemas import (
    TemplateCreateIn, WorkflowStageCreateIn, WorkflowStageUpdateIn, WorkflowStageReorderIn
)


def create_template(db: Session, body: TemplateCreateIn, user_id: int):
    from app.models.workflow import WorkflowTemplate
    t = WorkflowTemplate(
        name=body.name,
        description=body.description,
        is_global=body.is_global if body.is_global is not None else True,
        created_by=user_id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def list_project_stages(db: Session, project_id: int):
    return repo.get_project_stages(db, project_id)


def create_project_stage(db: Session, project_id: int, body: WorkflowStageCreateIn):
    return repo.create_project_stage(db, project_id, body.model_dump())


def update_project_stage(db: Session, stage_id: int, body: WorkflowStageUpdateIn):
    return repo.update_project_stage(db, stage_id, body.model_dump(exclude_unset=True))


def delete_project_stage(db: Session, stage_id: int, target_stage_id: Optional[int] = None):
    return repo.delete_project_stage(db, stage_id, target_stage_id)


def reorder_project_stages(db: Session, project_id: int, body: WorkflowStageReorderIn):
    return repo.reorder_project_stages(db, project_id, body.stage_ids)


def duplicate_project_stage(db: Session, stage_id: int):
    return repo.duplicate_project_stage(db, stage_id)


def archive_project_stage(db: Session, stage_id: int, archive: bool = True):
    return repo.archive_project_stage(db, stage_id, archive)


def copy_workflow_to_project(db: Session, from_project_id: int, to_project_id: int):
    return repo.copy_workflow_to_project(db, from_project_id, to_project_id)

