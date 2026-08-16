from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_
from app.models.roadmap import Plan, PlanTask, Milestone, Task, PlanTaskDependency
from app.models.planning import ProjectPlanningBaseline
from app.models.project import Project
from app.models.misc import AuditLog


def get_plans_query(db: Session, status: str = None, project_id: int = None):
    from sqlalchemy.orm import joinedload

    q = db.query(Plan).options(joinedload(Plan.tasks))
    if status:
        q = q.filter(Plan.status == status)
    if project_id is not None:
        # Prefer direct plan.project_id; also include legacy plans linked via tasks.
        q = q.filter(
            or_(
                Plan.project_id == project_id,
                Plan.id.in_(
                    select(PlanTask.plan_id).where(PlanTask.project_id == project_id).distinct()
                ),
            )
        )
    return q.order_by(Plan.id.desc())


def get_plan_by_id(db: Session, plan_id: int) -> Plan:
    from sqlalchemy.orm import joinedload

    return (
        db.query(Plan)
        .options(joinedload(Plan.tasks))
        .filter(Plan.id == plan_id)
        .first()
    )


def get_milestones_query(db: Session, project_id: int = None):
    q = db.query(Milestone)
    if project_id:
        q = q.join(Milestone.projects).filter(Project.id == project_id)
    return q.order_by(Milestone.date.asc(), Milestone.id.asc())


def get_roadmap_projects(db: Session):
    return db.query(Project).filter(Project.deleted_at.is_(None)).all()


def get_active_projects(db: Session, project_ids: set[int] | None = None):
    query = db.query(Project).filter(Project.deleted_at.is_(None))
    if project_ids is not None:
        query = query.filter(Project.id.in_(project_ids or {-1}))
    return (
        query
        .order_by(Project.created_at.desc(), Project.id.desc())
        .all()
    )


def get_plan_tasks(db: Session, plan_id: int):
    return db.query(PlanTask).filter(PlanTask.plan_id == plan_id).all()


def get_plan_task_by_id(db: Session, task_id: int) -> PlanTask:
    return db.query(PlanTask).filter(PlanTask.id == task_id).first()


def get_plan_dependencies(db: Session, plan_id: int):
    # Get all dependencies where the predecessor is in the plan
    task_ids = select(PlanTask.id).where(PlanTask.plan_id == plan_id)
    return db.query(PlanTaskDependency).filter(PlanTaskDependency.predecessor_id.in_(task_ids)).all()


def get_dependency(db: Session, source: int, target: int) -> PlanTaskDependency:
    return db.query(PlanTaskDependency).filter(
        PlanTaskDependency.predecessor_id == source,
        PlanTaskDependency.successor_id == target
    ).first()


def get_project_baseline(db: Session, project_id: int) -> ProjectPlanningBaseline | None:
    return db.query(ProjectPlanningBaseline).filter(ProjectPlanningBaseline.project_id == project_id).first()


def upsert_project_baseline(db: Session, project_id: int, data: dict) -> ProjectPlanningBaseline:
    baseline = get_project_baseline(db, project_id)
    if not baseline:
        baseline = ProjectPlanningBaseline(project_id=project_id)
        db.add(baseline)
    for field, value in data.items():
        if hasattr(baseline, field):
            setattr(baseline, field, value)
    db.commit()
    db.refresh(baseline)
    return baseline


def get_planning_audit_logs(
    db: Session,
    entity_ids_by_type: dict[str, list[int]],
    limit: int = 50,
):
    clauses = []
    for entity_type, entity_ids in entity_ids_by_type.items():
        ids = [int(entity_id) for entity_id in entity_ids if entity_id is not None]
        if not ids:
            continue
        clauses.append(
            and_(
                AuditLog.entity_type == entity_type,
                AuditLog.entity_id.in_(ids),
            )
        )

    if not clauses:
        return []

    return (
        db.query(AuditLog)
        .filter(or_(*clauses))
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .all()
    )
