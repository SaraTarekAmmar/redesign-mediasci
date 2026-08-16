"""Planning module router — Plans, PlanTasks, Milestones, Roadmaps, Gantt."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.pagination import paginate, MessageResponse
from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.models.project import Project
from app.models.roadmap import Plan, PlanTask, Milestone
from app.modules.planning.schemas import (
    PlanCreateIn, PlanUpdateIn, PlanTaskCreateIn, PlanTaskUpdateIn,
    MilestoneCreateIn, DependencyCreateIn, ProjectBaselineIn
)
from app.modules.planning import repository as repo
from app.modules.planning import service
from app.modules.projects.access import (
    accessible_project_ids,
    accessible_project_ids_query,
    is_system_admin,
    require_any_project_access,
    require_project_access,
)

router = APIRouter(tags=["Planning"])


def _plan_project_ids(plan: Plan) -> set[int]:
    ids = {int(plan.project_id)} if plan.project_id is not None else set()
    ids.update(int(task.project_id) for task in (plan.tasks or []) if task.project_id is not None)
    return ids


def _fmt_plan(p: Plan) -> dict:
    return service.format_plan_option(p)


def _fmt_task(t: PlanTask) -> dict:
    return {
        "id": t.id,
        "planId": t.plan_id,
        "projectId": t.project_id,
        "title": t.title,
        "text": t.title,
        "description": t.description,
        "assignedTo": t.assigned_to,
        "assigned_to": t.assigned_to,
        "status": t.status,
        "priority": t.priority,
        "startDate": t.start_date.isoformat() if t.start_date else None,
        "start_date": t.start_date.isoformat() if t.start_date else None,
        "endDate": t.end_date.isoformat() if t.end_date else None,
        "end_date": t.end_date.isoformat() if t.end_date else None,
        "duration": t.duration,
        "progress": t.progress,
        "type": getattr(t, "type", "task") or "task",
        "wbsCode": t.wbs_code,
        "parentId": t.parent_id,
        "parent_id": t.parent_id,
        "milestoneId": t.milestone_id,
        "cost": float(t.cost) if t.cost else None,
    }


# ── Enterprise Gantt: Plans / Plan Tasks / Dependencies / Legacy Milestones ─


@router.get("/plans")
def list_plans(
    request: Request,
    status: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Frontend sends `projects[]=<id>`; also accept project_id / projects."""
    project_id = None
    qp = request.query_params
    if "projects[]" in qp:
        project_id = int(qp.get("projects[]"))
    elif "projects" in qp:
        project_id = int(qp.get("projects"))
    elif "project_id" in qp:
        project_id = int(qp.get("project_id"))

    roles = _get_user_roles(current_user.id, db)
    if project_id is not None:
        require_project_access(db, current_user.id, roles, project_id)
    plans_query = repo.get_plans_query(db, status=status, project_id=project_id)
    if not is_system_admin(roles):
        allowed = accessible_project_ids_query(current_user.id)
        plans_query = plans_query.filter(or_(
            Plan.project_id.in_(allowed),
            Plan.id.in_(
                select(PlanTask.plan_id).where(PlanTask.project_id.in_(allowed))
            ),
        ))
    plans = plans_query.all()
    return {"data": [_fmt_plan(p) for p in plans]}


@router.post("/plans", status_code=201)
def create_plan(
    body: PlanCreateIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    roles = _get_user_roles(current_user.id, db)
    if body.project_id is None and not is_system_admin(roles):
        raise HTTPException(403, "A project-scoped plan is required.")
    if body.project_id is not None:
        require_project_access(db, current_user.id, roles, int(body.project_id))
    plan = service.create_plan(db, body, owner_id=current_user.id)
    return {"plan": _fmt_plan(plan)}


@router.get("/plans/{plan_id}/gantt-data")
def get_plan_gantt_data(
    plan_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = repo.get_plan_by_id(db, plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found.")
    require_any_project_access(db, current_user.id, _get_user_roles(current_user.id, db), _plan_project_ids(plan))
    return service.build_gantt_payload(db, plan_id)


@router.post("/plan-tasks", status_code=201)
def create_plan_task(
    body: PlanTaskCreateIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.plan_id:
        raise HTTPException(422, "plan_id is required.")
    plan = repo.get_plan_by_id(db, body.plan_id)
    if not plan:
        raise HTTPException(404, "Plan not found.")
    candidate_projects = _plan_project_ids(plan)
    if body.project_id is not None:
        candidate_projects.add(int(body.project_id))
        require_project_access(
            db,
            current_user.id,
            _get_user_roles(current_user.id, db),
            int(body.project_id),
        )
    else:
        require_any_project_access(db, current_user.id, _get_user_roles(current_user.id, db), candidate_projects)
    try:
        task = service.create_plan_task(db, body)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    return _fmt_task(task)


@router.put("/plan-tasks/{task_id}")
def update_plan_task(
    task_id: int,
    body: PlanTaskUpdateIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = repo.get_plan_task_by_id(db, task_id)
    if not task:
        raise HTTPException(404, "Plan task not found.")
    require_any_project_access(
        db,
        current_user.id,
        _get_user_roles(current_user.id, db),
        {task.project_id} if task.project_id is not None else _plan_project_ids(task.plan),
    )
    task = service.update_plan_task(db, task, body)
    return _fmt_task(task)


@router.delete("/plan-tasks/{task_id}")
def delete_plan_task(
    task_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = repo.get_plan_task_by_id(db, task_id)
    if not task:
        raise HTTPException(404, "Plan task not found.")
    require_any_project_access(
        db,
        current_user.id,
        _get_user_roles(current_user.id, db),
        {task.project_id} if task.project_id is not None else _plan_project_ids(task.plan),
    )
    service.delete_plan_task(db, task)
    return {"message": "Plan task deleted."}


@router.post("/plan-dependencies", status_code=201)
def create_plan_dependency(
    body: DependencyCreateIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    source_task = repo.get_plan_task_by_id(db, int(body.source))
    target_task = repo.get_plan_task_by_id(db, int(body.target))
    if not source_task or not target_task:
        raise HTTPException(404, "Plan task not found.")
    source_projects = {source_task.project_id} if source_task.project_id is not None else _plan_project_ids(source_task.plan)
    target_projects = {target_task.project_id} if target_task.project_id is not None else _plan_project_ids(target_task.plan)
    if source_projects.isdisjoint(target_projects):
        raise HTTPException(422, "Plan dependencies cannot cross projects.")
    require_any_project_access(db, current_user.id, _get_user_roles(current_user.id, db), source_projects)
    try:
        dep = service.create_dependency(db, body)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {
        "id": str(dep.id),
        "source": str(dep.predecessor_id),
        "target": str(dep.successor_id),
        "type": dep.type or "FS",
        "lag": int(dep.lag or 0),
    }


@router.delete("/plan-dependencies")
def delete_plan_dependency(
    source: int = Query(...),
    target: int = Query(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dep = repo.get_dependency(db, source, target)
    if not dep:
        raise HTTPException(404, "Dependency not found.")
    source_task = repo.get_plan_task_by_id(db, source)
    target_task = repo.get_plan_task_by_id(db, target)
    if not source_task or not target_task:
        raise HTTPException(404, "Plan task not found.")
    source_projects = {source_task.project_id} if source_task.project_id is not None else _plan_project_ids(source_task.plan)
    target_projects = {target_task.project_id} if target_task.project_id is not None else _plan_project_ids(target_task.plan)
    if source_projects.isdisjoint(target_projects):
        raise HTTPException(422, "Plan dependencies cannot cross projects.")
    require_any_project_access(db, current_user.id, _get_user_roles(current_user.id, db), source_projects)
    service.delete_dependency(db, dep)
    return {"message": "Dependency deleted."}


@router.get("/milestones")
def list_legacy_milestones(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Global legacy milestones table used by Enterprise Gantt markers."""
    milestones_query = repo.get_milestones_query(db)
    roles = _get_user_roles(current_user.id, db)
    if not is_system_admin(roles):
        milestones_query = milestones_query.filter(
            Milestone.projects.any(Project.id.in_(accessible_project_ids_query(current_user.id)))
        )
    milestones = milestones_query.all()
    return {"milestones": [service.format_legacy_milestone(m) for m in milestones]}


@router.post("/milestones", status_code=201)
def create_legacy_milestone(
    body: MilestoneCreateIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    roles = _get_user_roles(current_user.id, db)
    for project_id in body.projects or []:
        require_project_access(db, current_user.id, roles, int(project_id))
    milestone = service.create_milestone(db, body, owner_id=current_user.id)
    return service.format_legacy_milestone(milestone)


# ── Roadmaps / Projects ────────────────────────────────────────────────────
# ── Project Planning Baseline ──────────────────────────────────────────


# â”€â”€ Project Planning Baseline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def _fmt_project_baseline(b):
    if not b:
        return None
    return {
        "id": b.id,
        "project_id": b.project_id,
        "planned_duration_days": int(b.planned_duration_days or 0),
        "planned_budget": float(b.planned_budget or 0),
        "planned_hours": float(b.planned_hours or 0),
        "planned_resources_count": int(b.planned_resources_count or 0),
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
    }


@router.get("/projects/{project_id}/planning-baseline")
def get_project_planning_baseline(
    project_id: int,
    current_user=Depends(require_permissions("view-scope")),
    db: Session = Depends(get_db),
):
    baseline = service.get_project_baseline(db, project_id)
    return _fmt_project_baseline(baseline)


@router.put("/projects/{project_id}/planning-baseline")
def save_project_planning_baseline(
    project_id: int,
    body: ProjectBaselineIn,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    baseline = service.save_project_baseline(db, project_id, body, actor_id=current_user.id)
    return _fmt_project_baseline(baseline)


@router.delete("/projects/{project_id}/planning-baseline")
def delete_project_planning_baseline(
    project_id: int,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    success = service.delete_project_baseline(db, project_id, actor_id=current_user.id)
    if not success:
        raise HTTPException(404, "Planning baseline not found.")
    return {"message": "Planning baseline deleted successfully."}


@router.post("/projects/{project_id}/start-planning")
def start_project_planning(
    project_id: int,
    current_user=Depends(require_permissions("edit-scope")),
    db: Session = Depends(get_db),
):
    result = service.start_planning(db, project_id, actor_id=current_user.id)
    if not result:
        raise HTTPException(404, "Project not found.")
    return result


@router.get("/projects/{project_id}/planning-intelligence")
def get_project_planning_intelligence(
    project_id: int,
    current_user=Depends(require_permissions("view-scope")),
    db: Session = Depends(get_db),
):
    payload = service.get_project_planning_intelligence(db, project_id)
    if not payload:
        raise HTTPException(404, "Project not found.")
    return payload


@router.get("/planning/executive-dashboard")
def get_planning_executive_dashboard(
    current_user=Depends(require_permissions("view-scope")),
    db: Session = Depends(get_db),
):
    roles = _get_user_roles(current_user.id, db)
    allowed = None if is_system_admin(roles) else accessible_project_ids(db, current_user.id, roles)
    return service.get_executive_dashboard(db, allowed)
