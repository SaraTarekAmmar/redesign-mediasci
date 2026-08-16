from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException
from app.models.workflow import Workflow, WorkflowTemplate, WorkflowStage
from app.models.issue import Issue, IssueStatus


DEFAULT_STAGES = [
    {"name": "In Progress", "slug": "in-progress", "category": "in_progress", "color": "#3B82F6", "position": 0, "is_initial": True},
    {"name": "In Revision", "slug": "in-revision", "category": "review", "color": "#F59E0B", "position": 1},
    {"name": "Done", "slug": "done", "category": "done", "color": "#10B981", "position": 2, "is_final": True},
]


def get_all_templates(db: Session):
    return db.query(WorkflowTemplate).all()


def get_project_workflows(db: Session, project_id: int):
    return db.query(Workflow).filter(Workflow.project_id == project_id).all()


def get_project_stages(db: Session, project_id: int) -> List[WorkflowStage]:
    stages = (
        db.query(WorkflowStage)
        .filter(WorkflowStage.project_id == project_id, WorkflowStage.is_active == True)
        .order_by(WorkflowStage.position.asc())
        .all()
    )
    if not stages:
        # Seed default stages for project if none exist
        for idx, item in enumerate(DEFAULT_STAGES):
            stg = WorkflowStage(
                project_id=project_id,
                name=item["name"],
                slug=item["slug"],
                category=item["category"],
                color=item["color"],
                position=idx,
                is_initial=item.get("is_initial", False),
                is_final=item.get("is_final", False),
                is_active=True,
            )
            db.add(stg)
        db.flush()

        # Sync/Create corresponding IssueStatus rows for the project
        for idx, item in enumerate(DEFAULT_STAGES):
            status_row = db.query(IssueStatus).filter(IssueStatus.project_id == project_id, IssueStatus.name == item["name"]).first()
            if not status_row:
                status_row = IssueStatus(
                    project_id=project_id,
                    name=item["name"],
                    category=item["category"],
                    color=item["color"],
                    position=idx,
                )
                db.add(status_row)
        db.flush()

        # Migrate existing project issues from old status rows to the new ones
        in_progress_status = db.query(IssueStatus).filter(IssueStatus.project_id == project_id, IssueStatus.name == "In Progress").first()
        in_revision_status = db.query(IssueStatus).filter(IssueStatus.project_id == project_id, IssueStatus.name == "In Revision").first()
        old_statuses = db.query(IssueStatus).filter(IssueStatus.project_id == project_id, IssueStatus.name.in_(["To Do", "Backlog", "Review"])).all()
        for ost in old_statuses:
            if ost.name in ["To Do", "Backlog"] and in_progress_status:
                db.query(Issue).filter(Issue.issue_status_id == ost.id).update({"issue_status_id": in_progress_status.id})
            elif ost.name == "Review" and in_revision_status:
                db.query(Issue).filter(Issue.issue_status_id == ost.id).update({"issue_status_id": in_revision_status.id})
        db.commit()

        stages = (
            db.query(WorkflowStage)
            .filter(WorkflowStage.project_id == project_id, WorkflowStage.is_active == True)
            .order_by(WorkflowStage.position.asc())
            .all()
        )
    return stages


def create_project_stage(db: Session, project_id: int, data: dict) -> WorkflowStage:
    max_pos = db.query(func.max(WorkflowStage.position)).filter(WorkflowStage.project_id == project_id).scalar() or 0
    slug = data.get("name", "stage").lower().replace(" ", "-")

    if data.get("is_initial"):
        db.query(WorkflowStage).filter(WorkflowStage.project_id == project_id).update({"is_initial": False})
    if data.get("is_final"):
        db.query(WorkflowStage).filter(WorkflowStage.project_id == project_id).update({"is_final": False})

    stage = WorkflowStage(
        project_id=project_id,
        name=data["name"],
        slug=slug,
        category=data.get("category", "todo"),
        color=data.get("color", "#6366F1"),
        wip_limit=data.get("wip_limit"),
        is_initial=data.get("is_initial", False),
        is_final=data.get("is_final", False),
        position=max_pos + 1,
        is_active=True,
    )
    db.add(stage)

    # Ensure an IssueStatus row also exists for compatibility
    status_row = db.query(IssueStatus).filter(IssueStatus.project_id == project_id, IssueStatus.name == stage.name).first()
    if not status_row:
        status_row = IssueStatus(
            project_id=project_id,
            name=stage.name,
            category=stage.category,
            color=stage.color,
            position=stage.position,
        )
        db.add(status_row)

    db.commit()
    db.refresh(stage)
    return stage


def update_project_stage(db: Session, stage_id: int, data: dict) -> Optional[WorkflowStage]:
    stage = db.query(WorkflowStage).filter(WorkflowStage.id == stage_id).first()
    if not stage:
        return None

    old_name = stage.name

    if data.get("is_initial"):
        db.query(WorkflowStage).filter(WorkflowStage.project_id == stage.project_id).update({"is_initial": False})
        stage.is_initial = True
    if data.get("is_final"):
        db.query(WorkflowStage).filter(WorkflowStage.project_id == stage.project_id).update({"is_final": False})
        stage.is_final = True

    if "name" in data and data["name"] is not None:
        stage.name = data["name"]
        stage.slug = data["name"].lower().replace(" ", "-")
    if "category" in data and data["category"] is not None:
        stage.category = data["category"]
    if "color" in data and data["color"] is not None:
        stage.color = data["color"]
    if "wip_limit" in data:
        stage.wip_limit = data["wip_limit"]
    if "is_active" in data and data["is_active"] is not None:
        stage.is_active = data["is_active"]

    # Sync to corresponding IssueStatus
    status_row = db.query(IssueStatus).filter(
        IssueStatus.project_id == stage.project_id,
        IssueStatus.name == old_name
    ).first()
    if status_row:
        if "name" in data and data["name"] is not None:
            status_row.name = data["name"]
        if "category" in data and data["category"] is not None:
            status_row.category = data["category"]
        if "color" in data and data["color"] is not None:
            status_row.color = data["color"]
        status_row.position = stage.position

    db.commit()
    db.refresh(stage)
    return stage


def delete_project_stage(db: Session, stage_id: int, target_stage_id: Optional[int] = None) -> bool:
    stage = db.query(WorkflowStage).filter(WorkflowStage.id == stage_id).first()
    if not stage:
        return False

    project_id = stage.project_id
    active_initials = db.query(WorkflowStage).filter(WorkflowStage.project_id == project_id, WorkflowStage.is_active == True, WorkflowStage.is_initial == True).count()
    active_finals = db.query(WorkflowStage).filter(WorkflowStage.project_id == project_id, WorkflowStage.is_active == True, WorkflowStage.is_final == True).count()

    if stage.is_initial and active_initials <= 1:
        raise HTTPException(400, "Cannot delete the project's only Initial Stage. Set another stage as Initial first.")
    if stage.is_final and active_finals <= 1:
        raise HTTPException(400, "Cannot delete the project's only Final Stage. Set another stage as Final first.")

    # Find tasks in this status/stage and migrate them if target provided
    status_row = db.query(IssueStatus).filter(IssueStatus.project_id == project_id, IssueStatus.name == stage.name).first()
    if status_row:
        task_count = db.query(Issue).filter(Issue.issue_status_id == status_row.id, Issue.deleted_at.is_(None)).count()
        if task_count > 0:
            if not target_stage_id:
                raise HTTPException(400, f"Stage contains {task_count} tasks. A target stage ID is required to migrate tasks before deletion.")
            target_stage = db.query(WorkflowStage).filter(WorkflowStage.id == target_stage_id).first()
            if not target_stage:
                raise HTTPException(400, "Target migration stage not found.")
            target_status = db.query(IssueStatus).filter(IssueStatus.project_id == target_stage.project_id, IssueStatus.name == target_stage.name).first()
            if target_status:
                db.query(Issue).filter(Issue.issue_status_id == status_row.id).update({"issue_status_id": target_status.id})

    stage.is_active = False
    db.commit()
    return True


def reorder_project_stages(db: Session, project_id: int, stage_ids: List[int]) -> List[WorkflowStage]:
    for pos, s_id in enumerate(stage_ids):
        db.query(WorkflowStage).filter(WorkflowStage.id == s_id, WorkflowStage.project_id == project_id).update({"position": pos})
    db.commit()
    return get_project_stages(db, project_id)


def duplicate_project_stage(db: Session, stage_id: int) -> Optional[WorkflowStage]:
    source = db.query(WorkflowStage).filter(WorkflowStage.id == stage_id).first()
    if not source:
        return None
    data = {
        "name": f"{source.name} (Copy)",
        "category": source.category,
        "color": source.color,
        "wip_limit": source.wip_limit,
        "is_initial": False,
        "is_final": False,
    }
    return create_project_stage(db, source.project_id, data)


def archive_project_stage(db: Session, stage_id: int, archive: bool = True) -> Optional[WorkflowStage]:
    stage = db.query(WorkflowStage).filter(WorkflowStage.id == stage_id).first()
    if not stage:
        return None
    stage.is_archived = archive
    if archive:
        stage.is_active = False
    db.commit()
    db.refresh(stage)
    return stage


def copy_workflow_to_project(db: Session, from_project_id: int, to_project_id: int) -> List[WorkflowStage]:
    source_stages = get_project_stages(db, from_project_id)
    if not source_stages:
        return []
    db.query(WorkflowStage).filter(WorkflowStage.project_id == to_project_id).update({"is_active": False})
    for stg in source_stages:
        new_stg = WorkflowStage(
            project_id=to_project_id,
            name=stg.name,
            slug=stg.slug,
            category=stg.category,
            color=stg.color,
            position=stg.position,
            wip_limit=stg.wip_limit,
            is_initial=stg.is_initial,
            is_final=stg.is_final,
            is_active=True,
        )
        db.add(new_stg)
    db.commit()
    return get_project_stages(db, to_project_id)

