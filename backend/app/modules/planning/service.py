from __future__ import annotations

from collections import defaultdict, deque
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.roadmap import Plan, PlanTask, Milestone, PlanTaskDependency
from app.models.resource import Resource, ResourceAllocation
from app.modules.administration.repository import write_audit_log
from app.modules.planning import repository as repo
from app.modules.milestones import repository as milestone_repo
from app.modules.planning.schemas import (
    PlanCreateIn,
    PlanUpdateIn,
    PlanTaskCreateIn,
    PlanTaskUpdateIn,
    MilestoneCreateIn,
    DependencyCreateIn,
    ProjectBaselineIn,
)
from app.modules.projects import service as project_service
from app.modules.projects import performance_repository as project_perf_repo
from app.modules.resources import repository as resource_repo


def _as_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _as_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _date_only(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            return None
    return None


def _date_str(value) -> str | None:
    d = _date_only(value)
    return d.isoformat() if d else None


def _today() -> date:
    return datetime.utcnow().date()


def _snapshot_dict(value: dict | None, keys: list[str]) -> dict:
    if not value:
        return {}
    return {key: value.get(key) for key in keys}


def _resolve_assignee_id(db: Session, value) -> int | None:
    """Frontend Enterprise Gantt sends assignee display name; accept id or name."""
    if value is None or value == "" or value == "unassigned":
        return None
    if isinstance(value, int):
        return value
    text = str(value).strip()
    if text.isdigit():
        return int(text)
    from app.models.user import User

    user = db.query(User).filter(User.name == text, User.deleted_at.is_(None)).first()
    return user.id if user else None


def _compute_end_date(start: date | None, duration: int | None) -> date | None:
    if not start:
        return None
    days = max(int(duration or 1), 1)
    return start + timedelta(days=days - 1)


def _task_type(body_type: str | None, is_milestone: bool | None) -> str:
    if is_milestone or body_type == "milestone":
        return "milestone"
    return body_type or "task"


def create_plan(db: Session, body: PlanCreateIn, owner_id: int) -> Plan:
    start_date = datetime.fromisoformat(body.start_date).date() if body.start_date else None
    end_date = datetime.fromisoformat(body.end_date).date() if body.end_date else None
    plan = Plan(
        name=body.name,
        description=body.description,
        status=body.status or "draft",
        type=body.type or "Detailed Plan",
        project_id=body.project_id,
        owner_id=owner_id,
        start_date=start_date,
        end_date=end_date,
        created_at=datetime.now(timezone.utc),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def update_plan(db: Session, plan: Plan, body: PlanUpdateIn) -> Plan:
    for field, val in body.model_dump(exclude_unset=True).items():
        if field in ("start_date", "end_date") and val:
            setattr(plan, field, datetime.fromisoformat(val).date())
        elif hasattr(plan, field):
            setattr(plan, field, val)
    plan.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(plan)
    return plan


def create_plan_task(db: Session, body: PlanTaskCreateIn) -> PlanTask:
    plan = repo.get_plan_by_id(db, body.plan_id) if body.plan_id else None
    if body.plan_id and not plan:
        raise ValueError("Plan not found")

    start_date = datetime.fromisoformat(body.start_date[:10]).date() if body.start_date else None
    duration = body.duration if body.duration is not None else 1
    end_date = (
        datetime.fromisoformat(body.end_date[:10]).date()
        if body.end_date
        else _compute_end_date(start_date, duration)
    )
    task_type = _task_type(body.type, body.is_milestone)

    task = PlanTask(
        plan_id=body.plan_id,
        project_id=body.project_id or (plan.project_id if plan else None),
        title=body.text,
        description=body.description,
        assigned_to=_resolve_assignee_id(db, body.assigned_to),
        status=body.status or "not_started",
        priority=body.priority or "medium",
        type=task_type,
        is_milestone=1 if task_type == "milestone" else 0,
        start_date=start_date,
        end_date=end_date,
        duration=duration,
        progress=body.progress or 0,
        wbs_code=body.wbs_code,
        parent_id=body.parent_id,
        milestone_id=body.milestone_id,
        cost=body.cost,
        created_at=datetime.now(timezone.utc),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_plan_task(db: Session, task: PlanTask, body: PlanTaskUpdateIn) -> PlanTask:
    data = body.model_dump(exclude_unset=True)
    if "assigned_to" in data:
        task.assigned_to = _resolve_assignee_id(db, data.pop("assigned_to"))
    if "text" in data:
        task.title = data.pop("text")
    if "is_milestone" in data or "type" in data:
        task_type = _task_type(data.get("type", task.type), data.get("is_milestone"))
        task.type = task_type
        task.is_milestone = 1 if task_type == "milestone" else 0
        data.pop("type", None)
        data.pop("is_milestone", None)
    if "start_date" in data and data["start_date"]:
        task.start_date = datetime.fromisoformat(str(data.pop("start_date"))[:10]).date()
    if "duration" in data:
        task.duration = data.pop("duration")
        task.end_date = _compute_end_date(task.start_date, task.duration)
    for field, val in data.items():
        if hasattr(task, field):
            setattr(task, field, val)
    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return task


def delete_plan_task(db: Session, task: PlanTask):
    # Remove dependencies that reference this task to avoid orphan links.
    db.query(PlanTaskDependency).filter(
        (PlanTaskDependency.predecessor_id == task.id)
        | (PlanTaskDependency.successor_id == task.id)
    ).delete(synchronize_session=False)
    db.delete(task)
    db.commit()


def create_milestone(db: Session, body: MilestoneCreateIn, owner_id: int) -> Milestone:
    m = Milestone(
        name=body.resolved_title,
        description=body.description,
        date=datetime.fromisoformat(body.date[:10]).date() if body.date else None,
        status=body.status or "pending",
        priority=body.priority or "medium",
        owner_id=owner_id,
        created_at=datetime.now(timezone.utc),
    )
    if body.projects:
        from app.models.project import Project

        projects = db.query(Project).filter(Project.id.in_(body.projects)).all()
        m.projects = projects

    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def create_dependency(db: Session, body: DependencyCreateIn) -> PlanTaskDependency:
    source = int(body.source)
    target = int(body.target)
    if source == target:
        raise ValueError("Dependency source and target must differ")

    existing = repo.get_dependency(db, source, target)
    if existing:
        return existing

    pred = repo.get_plan_task_by_id(db, source)
    succ = repo.get_plan_task_by_id(db, target)
    if not pred or not succ:
        raise ValueError("Dependency task not found")
    if pred.plan_id != succ.plan_id:
        raise ValueError("Dependencies must be within the same plan")

    dep = PlanTaskDependency(
        predecessor_id=source,
        successor_id=target,
        type=body.type or "FS",
        lag=body.lag or 0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(dep)
    db.commit()
    db.refresh(dep)
    return dep


def delete_dependency(db: Session, dep: PlanTaskDependency):
    db.delete(dep)
    db.commit()


def compute_critical_task_ids(tasks: list[PlanTask], deps: list[PlanTaskDependency]) -> set[int]:
    """Longest duration-weighted chain on the plan-task dependency graph."""
    if not tasks:
        return set()

    duration = {t.id: max(int(t.duration or 1), 1) for t in tasks}
    successors: dict[int, list[int]] = {t.id: [] for t in tasks}
    indegree: dict[int, int] = {t.id: 0 for t in tasks}
    for dep in deps:
        if dep.predecessor_id in successors and dep.successor_id in indegree:
            successors[dep.predecessor_id].append(dep.successor_id)
            indegree[dep.successor_id] += 1

    best_score = {tid: duration[tid] for tid in duration}
    best_prev: dict[int, int | None] = {tid: None for tid in duration}
    order = sorted(duration.keys(), key=lambda tid: indegree[tid])
    # Relax edges repeatedly (DAG / almost-DAG safe for small graphs)
    for _ in range(len(duration) + 1):
        changed = False
        for pred, succs in successors.items():
            for succ in succs:
                candidate = best_score[pred] + duration[succ]
                if candidate > best_score[succ]:
                    best_score[succ] = candidate
                    best_prev[succ] = pred
                    changed = True
        if not changed:
            break

    if not best_score:
        return set()
    end = max(best_score, key=best_score.get)
    chain: set[int] = set()
    cur: int | None = end
    while cur is not None and cur not in chain:
        chain.add(cur)
        cur = best_prev.get(cur)
    return chain


def build_gantt_payload(db: Session, plan_id: int) -> dict:
    from app.models.user import User

    tasks = repo.get_plan_tasks(db, plan_id)
    deps = repo.get_plan_dependencies(db, plan_id)
    critical_ids = compute_critical_task_ids(tasks, deps)

    user_ids = {t.assigned_to for t in tasks if t.assigned_to}
    users = {
        u.id: u.name
        for u in db.query(User).filter(User.id.in_(user_ids)).all()
    } if user_ids else {}

    status_colors = {
        "completed": "#22c55e",
        "in_progress": "#ec4899",
        "review": "#f59e0b",
        "blocked": "#ef4444",
        "not_started": "#64748b",
        "pending": "#64748b",
    }

    data = []
    for t in sorted(tasks, key=lambda x: (x.start_date or date.max, x.id)):
        progress = int(t.progress or 0)
        task_type = t.type or ("milestone" if t.is_milestone else "task")
        start = t.start_date.isoformat() if t.start_date else None
        end = t.end_date.isoformat() if t.end_date else None
        # Frontend chart expects "Y-m-d H:i" style; date-only is accepted via slice(0,10)
        start_fmt = f"{start} 00:00" if start else None
        assignee_name = users.get(t.assigned_to, "") if t.assigned_to else ""
        data.append(
            {
                "id": str(t.id),
                "text": t.title,
                "description": t.description or "",
                "start_date": start_fmt or "",
                "end_date": end,
                "duration": int(t.duration or 1),
                "progress": progress / 100.0,
                "completion_pct": progress,
                "status": t.status or "not_started",
                "priority": t.priority or "medium",
                "assigned_to": assignee_name,
                "type": task_type,
                "critical": t.id in critical_ids,
                "color": status_colors.get((t.status or "").lower(), "#64748b"),
                "parent": t.parent_id,
            }
        )

    links = [
        {
            "id": str(d.id),
            "source": str(d.predecessor_id),
            "target": str(d.successor_id),
            "type": d.type or "FS",
            "lag": int(d.lag or 0),
        }
        for d in deps
    ]
    return {"data": data, "links": links}


def format_plan_option(plan: Plan) -> dict:
    return {
        "id": plan.id,
        "project_id": plan.project_id,
        "name": plan.name,
        "type": plan.type or "Detailed Plan",
        "tasks_count": len(plan.tasks) if plan.tasks is not None else 0,
        "description": plan.description,
        "status": plan.status,
    }


def format_legacy_milestone(m: Milestone) -> dict:
    return {
        "id": m.id,
        "title": m.name,
        "name": m.name,
        "description": m.description,
        "date": m.date.isoformat() if m.date else None,
        "status": m.status or "pending",
        "priority": m.priority or "medium",
    }


def get_project_baseline(db: Session, project_id: int):
    return repo.get_project_baseline(db, project_id)


def save_project_baseline(db: Session, project_id: int, body: ProjectBaselineIn, actor_id: int | None = None):
    previous = repo.get_project_baseline(db, project_id)
    payload = body.model_dump(exclude_unset=True)
    baseline = repo.upsert_project_baseline(db, project_id, payload)
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="update" if previous else "create",
            entity_type="planning_baseline",
            entity_id=baseline.id,
            old_values=_snapshot_dict(
                {
                    "planned_duration_days": int(getattr(previous, "planned_duration_days", 0) or 0),
                    "planned_budget": float(getattr(previous, "planned_budget", 0) or 0),
                    "planned_hours": float(getattr(previous, "planned_hours", 0) or 0),
                    "planned_resources_count": int(getattr(previous, "planned_resources_count", 0) or 0),
                } if previous else {},
                ["planned_duration_days", "planned_budget", "planned_hours", "planned_resources_count"],
            ),
            new_values={
                "planned_duration_days": int(baseline.planned_duration_days or 0),
                "planned_budget": float(baseline.planned_budget or 0),
                "planned_hours": float(baseline.planned_hours or 0),
                "planned_resources_count": int(baseline.planned_resources_count or 0),
            },
        )
        db.commit()
    db.expire_all()
    return baseline


def delete_project_baseline(db: Session, project_id: int, actor_id: int | None = None) -> bool:
    baseline = repo.get_project_baseline(db, project_id)
    if not baseline:
        return False
    db.delete(baseline)
    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="delete",
            entity_type="planning_baseline",
            entity_id=baseline.id,
            old_values={
                "planned_duration_days": int(baseline.planned_duration_days or 0),
                "planned_budget": float(baseline.planned_budget or 0),
                "planned_hours": float(baseline.planned_hours or 0),
                "planned_resources_count": int(baseline.planned_resources_count or 0),
            },
        )
    db.commit()
    db.expire_all()
    return True


def start_planning(db: Session, project_id: int, actor_id: int | None = None):
    from app.models.planning import ProjectMilestone, ProjectDeliverable
    from app.modules.projects.repository import get_project_by_id

    project = get_project_by_id(db, project_id)
    if not project:
        return None

    baseline = repo.get_project_baseline(db, project_id)
    if not baseline:
        repo.upsert_project_baseline(
            db,
            project_id,
            {
                "planned_duration_days": 30,
                "planned_budget": 10000.0,
                "planned_hours": 160.0,
                "planned_resources_count": 3,
            },
        )

    milestones = db.query(ProjectMilestone).filter(
        ProjectMilestone.project_id == project_id,
    ).all()

    if not milestones:
        today = datetime.now(timezone.utc).date()
        m1 = ProjectMilestone(
            project_id=project_id,
            name="Phase 1 — Initial Setup & Requirements",
            description="Initial project setup, architecture, and requirements signoff.",
            status="pending",
            planned_start_date=today,
            planned_end_date=today + timedelta(days=14),
            planned_hours=80.0,
            planned_budget=5000.0,
            sort_order=1,
        )
        db.add(m1)
        db.flush()

        d1 = ProjectDeliverable(
            milestone_id=m1.id,
            title="System Requirements & Blueprint Document",
            description="Initial requirements specification.",
            status="pending",
            planned_completion_date=today + timedelta(days=14),
        )
        db.add(d1)
        db.commit()

    if actor_id:
        write_audit_log(
            db,
            user_id=actor_id,
            action="initialize_planning",
            entity_type="project_planning",
            entity_id=project_id,
            new_values={"project_id": project_id, "status": "initialized"},
        )
        db.commit()

    db.expire_all()
    return get_project_planning_intelligence(db, project_id)



def _is_issue_done(issue) -> bool:
    status = getattr(issue, "status", None)
    category = (getattr(status, "category", None) or "").strip().lower()
    name = (getattr(status, "name", "") or "").strip().lower()
    return category == "done" or name in {"done", "closed", "complete", "completed"}


def _is_milestone_done(milestone) -> bool:
    status = (getattr(milestone, "status", "") or "").strip().lower()
    return status in {"completed", "done", "closed"} or milestone.actual_end_date is not None


def _milestone_issue_scope(milestone, issues):
    direct = [issue for issue in issues if getattr(issue, "milestone_id", None) == milestone.id]
    if direct:
        return direct

    planned_start = _date_only(milestone.planned_start_date)
    planned_end = _date_only(milestone.planned_end_date)
    if not planned_start and not planned_end:
        return []

    scoped = []
    for issue in issues:
        due_date = _date_only(issue.due_date)
        if not due_date:
            continue
        if planned_start and due_date < planned_start:
            continue
        if planned_end and due_date > planned_end:
            continue
        scoped.append(issue)
    return scoped


def _deliverable_issue_scope(deliverable, milestone, issues):
    deliv_id = deliverable.get("id") if isinstance(deliverable, dict) else getattr(deliverable, "id", None)
    direct = [issue for issue in issues if getattr(issue, "deliverable_id", None) == deliv_id]
    if direct:
        return direct
    return _milestone_issue_scope(milestone, issues)


def _milestone_progress(milestone, issues):
    scoped_issues = _milestone_issue_scope(milestone, issues)
    completed_issues = sum(1 for issue in scoped_issues if _is_issue_done(issue))
    remaining_issues = max(len(scoped_issues) - completed_issues, 0)
    completed_story_points = sum(_as_int(issue.story_points) for issue in scoped_issues if _is_issue_done(issue))
    remaining_story_points = sum(_as_int(issue.story_points) for issue in scoped_issues if not _is_issue_done(issue))
    issue_progress = (completed_issues / len(scoped_issues) * 100.0) if scoped_issues else None

    deliverables = list(milestone.deliverables or [])
    completed_deliverables = sum(
        1
        for deliverable in deliverables
        if (deliverable.status or "").strip().lower() in {"completed", "done", "closed"} or deliverable.actual_completion_date
    )
    remaining_deliverables = max(len(deliverables) - completed_deliverables, 0)
    deliverable_progress = (completed_deliverables / len(deliverables) * 100.0) if deliverables else None

    components = []
    if issue_progress is not None:
        components.append(issue_progress)
    if deliverable_progress is not None:
        components.append(deliverable_progress)
    if components:
        completion_pct = round(sum(components) / len(components))
    else:
        completion_pct = round(_as_float(milestone.planned_progress, 0.0))

    if deliverables:
        deliverable_status = "completed" if remaining_deliverables == 0 else ("in_progress" if completed_deliverables > 0 else "pending")
    else:
        deliverable_status = "pending"

    return {
        "completion_percentage": max(0, min(100, completion_pct)),
        "planned_progress_pct": planned_progress,
        "actual_progress_pct": progress_pct,
        "forecast_progress_pct": max(progress_pct, planned_progress),
        "progress_variance_pct": variance_pct,
        "completed_issues": completed_issues,
        "remaining_issues": remaining_issues,
        "completed_story_points": completed_story_points,
        "remaining_story_points": remaining_story_points,
        "deliverable_progress": {
            "progress_pct": round(deliverable_progress or 0),
            "completed_tasks": completed_deliverables,
            "remaining_tasks": remaining_deliverables,
            "status": deliverable_status,
        },
    }


def _milestone_readiness(milestone, milestones_by_id, dependencies_by_successor):
    incoming = []
    for dependency in dependencies_by_successor.get(milestone.id, []):
        predecessor = milestones_by_id.get(dependency.predecessor_milestone_id) or getattr(dependency, "predecessor_milestone", None)
        if predecessor:
            incoming.append((dependency, predecessor))

    dependencies_completed = sum(1 for _dependency, predecessor in incoming if _is_milestone_done(predecessor))
    blocking = [predecessor for _dependency, predecessor in incoming if not _is_milestone_done(predecessor)]
    dependencies_remaining = len(blocking)
    blocked = dependencies_remaining > 0 and not _is_milestone_done(milestone)
    ready_to_start = dependencies_remaining == 0 and not _is_milestone_done(milestone)

    return {
        "ready_to_start": ready_to_start,
        "blocked": blocked,
        "dependencies_completed": dependencies_completed,
        "dependencies_remaining": dependencies_remaining,
        "blocking_reason": None if not blocking else f"Waiting for {', '.join(item.name for item in blocking)}",
        "blocking_milestones": [milestone_repo.format_milestone_reference(item) for item in blocking],
    }


def _milestone_performance(milestone, milestones_by_id, dependencies_by_successor, issues):
    readiness = _milestone_readiness(milestone, milestones_by_id, dependencies_by_successor)
    progress = _milestone_progress(milestone, issues)
    return {
        **readiness,
        **progress,
        "is_completed": _is_milestone_done(milestone),
    }


def _planned_start(milestones):
    dates = [_date_only(item.planned_start_date) for item in milestones if _date_only(item.planned_start_date)]
    return min(dates) if dates else None


def _planned_finish(milestones, baseline_planned_duration_days: int | None, planned_start: date | None):
    dates = [_date_only(item.planned_end_date) for item in milestones if _date_only(item.planned_end_date)]
    if dates:
        return max(dates)
    if planned_start and baseline_planned_duration_days:
        return planned_start + timedelta(days=max(_as_int(baseline_planned_duration_days), 0))
    return None


def _actual_start(milestones, issues):
    milestone_dates = [_date_only(item.actual_start_date) for item in milestones if _date_only(item.actual_start_date)]
    issue_dates = [_date_only(issue.created_at) for issue in issues if _date_only(issue.created_at)]
    dates = milestone_dates + issue_dates
    return min(dates) if dates else None


def _actual_finish(milestones):
    dates = [_date_only(item.actual_end_date) for item in milestones if _date_only(item.actual_end_date)]
    return max(dates) if dates else None


def _actual_hours(issues):
    total = 0.0
    for issue in issues:
        time_log_hours = sum((_as_float(log.duration_minutes, 0.0) / 60.0) for log in (issue.time_logs or []))
        issue_hours = time_log_hours if time_log_hours > 0 else _as_float(issue.actual_hours, 0.0)
        total += issue_hours or 0.0
    return round(total, 2)


def _remaining_hours(issues, planned_hours: float, actual_hours: float):
    issue_remaining = 0.0
    for issue in issues:
        if getattr(issue, "remaining_hours", None) is not None:
            issue_remaining += _as_float(issue.remaining_hours, 0.0)
            continue
        estimated = _as_float(issue.estimated_hours, 0.0)
        logged = _as_float(issue.actual_hours, 0.0)
        if logged == 0.0 and issue.time_logs:
            logged = sum((_as_float(log.duration_minutes, 0.0) / 60.0) for log in issue.time_logs)
        issue_remaining += max(0.0, estimated - logged)

    if issue_remaining > 0:
        return round(issue_remaining, 2)
    return round(max(planned_hours - actual_hours, 0.0), 2)


def _actual_cost(issues, budgets, expenses):
    expense_cost = sum(_as_float(expense.amount, 0.0) for expense in expenses)
    recorded_spent = sum(_as_float(budget.spent, 0.0) for budget in budgets)

    time_cost = 0.0
    for issue in issues:
        for log in issue.time_logs or []:
            if not bool(log.billable):
                continue
            rate = _as_float(log.rate, 0.0)
            time_cost += (_as_float(log.duration_minutes, 0.0) / 60.0) * rate

    baseline_spent = expense_cost if expenses else recorded_spent
    return round(baseline_spent + time_cost, 2)


def _project_health(score_components: dict, blocked_milestones: int, overdue_milestones: int, open_risks: int, critical_risks: int):
    milestone_completion_pct = score_components.get("milestone_completion_pct", 0)
    issue_completion_pct = score_components.get("issue_completion_pct", 0)
    schedule_penalty = min(100, (overdue_milestones * 10) + (blocked_milestones * 8) + max(score_components.get("days_late", 0), 0) * 3)
    schedule_factor = max(0, 100 - schedule_penalty)

    budget_variance = max(score_components.get("budget_variance", 0), 0)
    planned_budget = max(score_components.get("planned_budget", 0), 1)
    budget_factor = max(0, 100 - min(100, round((budget_variance / planned_budget) * 100)))

    risk_penalty = min(100, (open_risks * 8) + (critical_risks * 15))
    risk_factor = max(0, 100 - risk_penalty)

    score = round(
        (milestone_completion_pct * 0.25)
        + (issue_completion_pct * 0.25)
        + (schedule_factor * 0.2)
        + (budget_factor * 0.2)
        + (risk_factor * 0.1)
    )

    if blocked_milestones > 0:
        score -= min(15, blocked_milestones * 4)

    score = max(0, min(100, score))

    if score >= 80 and blocked_milestones == 0 and overdue_milestones == 0:
        state = "Green"
        tone = "success"
    elif score >= 55:
        state = "Yellow"
        tone = "warning"
    else:
        state = "Red"
        tone = "danger"

    return {
        "score": score,
        "state": state,
        "tone": tone,
    }


def _traffic_light_from_variance(variance_days: int, blocked: bool = False, delayed: bool = False) -> str:
    if blocked:
        return "Red"
    if delayed:
        return "Red" if abs(variance_days) >= 15 else "Yellow"
    if abs(variance_days) >= 15:
        return "Red"
    if abs(variance_days) >= 5:
        return "Yellow"
    return "Green"


def _dependency_graph(milestones, dependencies):
    adjacency: dict[int, list[int]] = defaultdict(list)
    reverse: dict[int, list[int]] = defaultdict(list)
    for dependency in dependencies:
        adjacency[dependency.predecessor_milestone_id].append(dependency.successor_milestone_id)
        reverse[dependency.successor_milestone_id].append(dependency.predecessor_milestone_id)
    milestone_map = {milestone.id: milestone for milestone in milestones}
    return milestone_map, adjacency, reverse


def _milestone_duration_days(milestone) -> int:
    start = _date_only(milestone.planned_start_date)
    end = _date_only(milestone.planned_end_date)
    if start and end:
        return max((end - start).days, 1)
    hours = _as_float(milestone.planned_hours, 0.0)
    if hours > 0:
        return max(1, round(hours / 8))
    return 1


def _longest_chain(milestones, dependencies):
    milestone_map, adjacency, reverse = _dependency_graph(milestones, dependencies)
    weights = {milestone.id: _milestone_duration_days(milestone) for milestone in milestones}
    memo: dict[int, tuple[int, list[int]]] = {}

    def walk(node_id: int) -> tuple[int, list[int]]:
        if node_id in memo:
            return memo[node_id]
        best = (weights.get(node_id, 1), [node_id])
        for successor in adjacency.get(node_id, []):
            child_length, child_path = walk(successor)
            candidate = (weights.get(node_id, 1) + child_length, [node_id] + child_path)
            if candidate[0] > best[0]:
                best = candidate
        memo[node_id] = best
        return best

    candidates = [milestone.id for milestone in milestones if not reverse.get(milestone.id)]
    if not candidates:
        candidates = [milestone.id for milestone in milestones]
    best_chain = (0, [])
    for node_id in candidates:
        chain = walk(node_id)
        if chain[0] > best_chain[0]:
            best_chain = chain
    return milestone_map, adjacency, reverse, best_chain


def _milestone_confidence(progress_pct: float, blocked: bool, delayed: bool, actual_start: date | None, actual_finish: date | None) -> str:
    if actual_finish:
        return "High"
    if blocked:
        return "High" if progress_pct > 0 else "Medium"
    if delayed:
        return "Medium"
    if actual_start and progress_pct >= 50:
        return "High"
    if progress_pct >= 25:
        return "Medium"
    return "Low"


def _resource_utilization_pct(db: Session, resource: Resource | None) -> float:
    if not resource:
        return 0.0
    total_hours = (
        db.query(func.coalesce(func.sum(ResourceAllocation.allocated_hours), 0))
        .filter(ResourceAllocation.resource_id == resource.id)
        .scalar()
    )
    cap = float(resource.weekly_capacity or 40.0)
    if cap <= 0:
        return 0.0
    return round((float(total_hours) / cap) * 100, 2)


def _resource_pool_for_project(db: Session, project_id: int, milestones, issues) -> list[Resource]:
    resource_ids: set[int] = set()
    allocation_rows = (
        db.query(ResourceAllocation.resource_id)
        .filter(
            ResourceAllocation.project_id == project_id,
            ResourceAllocation.task_id.is_(None),
        )
        .all()
    )
    resource_ids.update(int(row[0]) for row in allocation_rows)
    for milestone in milestones:
        if milestone.owner_resource_id:
            resource_ids.add(int(milestone.owner_resource_id))
    for issue in issues:
        assignee = getattr(issue, "assignee", None)
        if assignee and getattr(assignee, "resource", None):
            resource_ids.add(int(assignee.resource.id))
    if not resource_ids:
        return []
    return db.query(Resource).filter(Resource.id.in_(list(resource_ids))).all()


def _resource_planning_for_milestone(db: Session, milestone, issues, project_resources: list[Resource]) -> dict:
    milestone_issues = _milestone_issue_scope(milestone, issues)
    issue_resource_ids = {
        int(issue.assignee.resource.id)
        for issue in milestone_issues
        if getattr(issue, "assignee", None) and getattr(issue.assignee, "resource", None)
    }
    owner = milestone.owner_resource
    owner_utilization = _resource_utilization_pct(db, owner) if owner else 0.0
    owner_overloaded = owner_utilization > 100 or (owner and (owner.availability_status or "").lower() not in {"available", "partially_available"})
    available_resources = []
    for resource in project_resources:
        utilization = _resource_utilization_pct(db, resource)
        if utilization <= 100 and (resource.availability_status or "").lower() in {"available", "partially_available", ""}:
            available_resources.append(
                {
                    "id": resource.id,
                    "name": resource.name,
                    "position": resource.position,
                    "availability_status": resource.availability_status,
                    "utilization_percentage": utilization,
                    "weekly_capacity": float(resource.weekly_capacity or 0),
                }
            )
    available_resources.sort(key=lambda item: (item["utilization_percentage"], item["name"]))
    suggested = available_resources[:3]

    return {
        "owner_resource": milestone_repo.format_owner(owner),
        "owner_capacity": float(owner.weekly_capacity or 0) if owner else 0.0,
        "owner_utilization": owner_utilization,
        "owner_overloaded": owner_overloaded,
        "assigned_resource_ids": sorted(issue_resource_ids),
        "available_resources": available_resources[:8],
        "suggested_replacements": suggested,
    }


def _deliverable_intelligence(milestone, milestone_perf: dict, project_summary: dict, issues) -> list[dict]:
    deliverables = milestone_perf.get("deliverables", [])
    forecast_date = _date_only(milestone_perf.get("forecast_finish")) if milestone_perf.get("forecast_finish") else _date_only(milestone.planned_end_date)
    items = []
    for deliverable in deliverables:
        planned = _date_only(deliverable.get("planned_completion_date"))
        actual = _date_only(deliverable.get("actual_completion_date"))
        linked_issues = _deliverable_issue_scope(deliverable, milestone, issues)
        completed_issue_count = sum(1 for issue in linked_issues if _is_issue_done(issue))
        issue_completion_pct = round((completed_issue_count / len(linked_issues)) * 100) if linked_issues else 0
        completed = (deliverable.get("status") or "").lower() in {"completed", "done", "closed"} or actual is not None or issue_completion_pct >= 100
        late = bool(planned and not completed and planned < _today()) or bool(planned and actual and actual > planned)
        blocked = bool(milestone_perf.get("blocked")) and not completed
        progress_pct = 100 if completed else issue_completion_pct
        items.append(
            {
                **deliverable,
                "progress_pct": progress_pct,
                "late": late,
                "blocked": blocked,
                "linked_issues": [
                    {
                        "id": issue.id,
                        "key": getattr(issue, "key", f"TASK-{issue.id}"),
                        "title": issue.title,
                        "status": getattr(issue.status, "name", None) or getattr(issue, "status", None),
                        "done": _is_issue_done(issue),
                    }
                    for issue in linked_issues
                ],
                "linked_issues_count": len(linked_issues),
                "waiting_for_milestone": bool(milestone_perf.get("blocked")),
                "waiting_for_dependency": bool(milestone_perf.get("dependencies_remaining")),
                "forecast_finish": forecast_date.isoformat() if forecast_date else None,
                "health": "red" if blocked or late else "yellow" if planned and forecast_date and forecast_date > planned else "green",
            }
        )
    return items


def _milestone_planning_row(
    db: Session,
    milestone,
    milestone_perf: dict,
    issues,
    dependencies_by_successor,
    dependencies_by_predecessor,
    project_resources,
    project_summary: dict,
    milestone_map: dict,
) -> dict:
    planned_start = _date_only(milestone.planned_start_date)
    planned_end = _date_only(milestone.planned_end_date)
    actual_start = _date_only(milestone.actual_start_date)
    actual_end = _date_only(milestone.actual_end_date)
    progress_pct = _as_float(milestone_perf.get("completion_percentage"), 0.0)
    planned_progress = _as_float(milestone.planned_progress, 0.0)
    variance_pct = round(progress_pct - planned_progress, 2)

    milestone_issues = _milestone_issue_scope(milestone, issues)
    actual_hours = round(
        sum(sum((_as_float(log.duration_minutes, 0.0) / 60.0) for log in (issue.time_logs or [])) for issue in milestone_issues),
        2,
    )
    planned_hours = _as_float(milestone.planned_hours, 0.0)
    hours_variance = round(actual_hours - planned_hours, 2)

    milestone_deps = dependencies_by_successor.get(milestone.id, [])
    blocking_milestones = [
        milestone_map.get(dep.predecessor_milestone_id) or getattr(dep, "predecessor_milestone", None)
        for dep in milestone_deps
        if dep.predecessor_milestone_id in milestone_map
    ]
    blocking_milestones = [item for item in blocking_milestones if item]

    blocked = bool(milestone_perf.get("blocked"))
    delayed = bool(planned_end and progress_pct < 100 and (actual_end or _today()) > planned_end and not blocked)
    schedule_variance_days = 0
    forecast_finish = actual_end
    if not forecast_finish:
        if blocked and blocking_milestones:
            last_blocker = max(
                (dep.predecessor_milestone for dep in milestone_deps if dep.predecessor_milestone),
                key=lambda item: _date_only(item.planned_end_date) or _today(),
                default=None,
            )
            blocker_end = _date_only(last_blocker.planned_end_date) if last_blocker else planned_end
            forecast_finish = (blocker_end or _today()) + timedelta(days=max(1, len(blocking_milestones) * 2))
        elif actual_start and progress_pct > 0:
            elapsed_days = max((_today() - actual_start).days, 1)
            projected_total_days = max(1, round(elapsed_days * (100 / max(progress_pct, 1))))
            forecast_finish = actual_start + timedelta(days=projected_total_days)
        elif planned_end:
            forecast_finish = planned_end

    if planned_end and forecast_finish:
        schedule_variance_days = (forecast_finish - planned_end).days
    elif planned_end and actual_end:
        schedule_variance_days = (actual_end - planned_end).days

    health_status = "Completed" if progress_pct >= 100 or actual_end else (
        "Blocked" if blocked else (
            "Delayed" if delayed or schedule_variance_days > 0 else (
                "At Risk" if variance_pct < -10 or _resource_utilization_pct(db, milestone.owner_resource) > 100 else (
                    "On Track" if progress_pct >= planned_progress else "Not Started"
                )
            )
        )
    )
    traffic_light = _traffic_light_from_variance(schedule_variance_days, blocked=blocked, delayed=delayed)
    confidence = _milestone_confidence(progress_pct, blocked, delayed, actual_start, actual_end)

    main_cause = "Blocked by dependencies" if blocked and milestone_perf.get("blocking_reason") else (
        f"Forecast finish moved {abs(schedule_variance_days)} days" if schedule_variance_days else "Progress tracking within baseline"
    )

    dependency_impact = {
        "waiting_for": [item["name"] for item in milestone_perf.get("blocking_milestones", [])],
        "blocked_by": [item["name"] for item in milestone_perf.get("blocking_milestones", [])],
        "blocking": [
            milestone_repo.format_milestone_reference(item)
            for item in (
                milestone_map.get(dep.successor_milestone_id) or getattr(dep, "successor_milestone", None)
                for dep in dependencies_by_predecessor.get(milestone.id, [])
            )
            if item
        ],
        "estimated_delay_days": max(schedule_variance_days, 0),
        "risk_level": "High" if blocked or schedule_variance_days >= 10 else "Medium" if schedule_variance_days >= 5 else "Low",
        "critical_dependency": milestone_perf.get("blocking_milestones", [None])[0] if milestone_perf.get("blocking_milestones") else None,
        "estimated_project_impact": project_summary.get("forecast_finish"),
    }

    resource_planning = _resource_planning_for_milestone(db, milestone, issues, project_resources)
    deliverables = _deliverable_intelligence(milestone, milestone_perf, project_summary, issues)
    milestone_issues_payload = [
        {
            "id": issue.id,
            "key": issue.key,
            "title": issue.title,
            "status": getattr(issue.status, "name", None),
            "done": _is_issue_done(issue),
            "milestone_id": getattr(issue, "milestone_id", None),
            "deliverable_id": getattr(issue, "deliverable_id", None),
            "story_points": _as_int(issue.story_points, 0),
            "due_date": _date_str(issue.due_date),
            "assignee": getattr(issue.assignee, "name", None) if getattr(issue, "assignee", None) else None,
        }
        for issue in milestone_issues
    ]

    activity_timeline = []
    for item in deliverables:
        if item.get("created_at"):
            activity_timeline.append(
                {
                    "entity_type": "deliverable",
                    "entity_id": item["id"],
                    "action": "updated" if item.get("updated_at") else "created",
                    "title": item.get("title"),
                    "old_values": {},
                    "new_values": _snapshot_dict(item, ["title", "status", "planned_completion_date", "actual_completion_date"]),
                    "created_at": item.get("updated_at") or item.get("created_at"),
                }
            )

    return {
        "id": milestone.id,
        "project_id": milestone.project_id,
        "name": milestone.name,
        "title": milestone.name,
        "description": milestone.description,
        "planned_start_date": _date_str(planned_start),
        "planned_end_date": _date_str(planned_end),
        "actual_start_date": _date_str(actual_start),
        "actual_end_date": _date_str(actual_end),
        "planned_hours": planned_hours,
        "actual_hours": actual_hours,
        "hours_variance": hours_variance,
        "planned_budget": _as_float(milestone.planned_budget, 0.0),
        "actual_budget": 0.0,
        "budget_variance": 0.0,
        "planned_progress": _as_float(milestone.planned_progress, 0.0),
        "completion_percentage": progress_pct,
        "variance_percentage": variance_pct,
        "planned_progress_pct": planned_progress,
        "actual_progress_pct": progress_pct,
        "forecast_progress_pct": max(progress_pct, planned_progress),
        "progress_variance_pct": variance_pct,
        "schedule_variance_days": schedule_variance_days,
        "delay_days": max(schedule_variance_days, 0),
        "status": milestone.status,
        "health_status": health_status,
        "traffic_light": traffic_light,
        "risk_level": dependency_impact["risk_level"],
        "ready_to_start": bool(milestone_perf.get("ready_to_start")),
        "blocked": blocked,
        "blocking_reason": milestone_perf.get("blocking_reason"),
        "dependencies_completed": milestone_perf.get("dependencies_completed", 0),
        "dependencies_remaining": milestone_perf.get("dependencies_remaining", 0),
        "blocking_milestones": milestone_perf.get("blocking_milestones", []),
        "forecast_finish": _date_str(forecast_finish),
        "forecast_confidence": confidence,
        "main_cause": main_cause,
        "owner_resource_id": milestone.owner_resource_id,
        "owner_resource": milestone_repo.format_owner(milestone.owner_resource),
        "sort_order": milestone.sort_order or 0,
        "date": _date_str(milestone.planned_end_date or milestone.planned_start_date),
        "deliverables": deliverables,
        "deliverables_count": len(deliverables),
        "issues": milestone_issues_payload,
        "dependency_impact": dependency_impact,
        "resource_planning": resource_planning,
        "activity_timeline": activity_timeline,
        "created_at": milestone.created_at.isoformat() if milestone.created_at else None,
        "updated_at": milestone.updated_at.isoformat() if milestone.updated_at else None,
    }


def _project_health_breakdown(summary: dict, milestones: list[dict], project_resources: list[Resource]) -> dict:
    schedule = max(0, 100 - min(100, abs(_as_int(summary.get("schedule_variance_days", 0))) * 4 + summary.get("blocked_milestones", 0) * 8))
    budget = max(0, 100 - min(100, abs(_as_float(summary.get("budget_variance", 0.0))) * 100 / max(_as_float(summary.get("planned_budget", 1.0)), 1.0)))
    completion = _as_float(summary.get("completion_pct", 0.0))
    deliverables = round(
        sum(_as_float((item.get("deliverable_progress") or {}).get("progress_pct", 0), 0.0) for item in milestones) / max(len(milestones), 1),
        1,
    )
    dependencies = max(0, 100 - (summary.get("blocked_milestones", 0) * 12) - (summary.get("overdue_milestones", 0) * 6))
    risks = max(0, 100 - (summary.get("open_risks", 0) * 8))
    resource_utilizations = [_resource_utilization_pct_for_resource(resource) for resource in project_resources]
    resources = round(sum(resource_utilizations) / max(len(resource_utilizations), 1), 1) if resource_utilizations else 100.0

    overall = round(
        (completion * 0.22)
        + (schedule * 0.2)
        + (budget * 0.16)
        + (dependencies * 0.16)
        + (deliverables * 0.12)
        + (resources * 0.08)
        + (risks * 0.06)
    )
    overall = max(0, min(100, overall))

    if overall >= 80:
        state = "Green"
        tone = "success"
    elif overall >= 55:
        state = "Yellow"
        tone = "warning"
    else:
        state = "Red"
        tone = "danger"

    return {
        "overall": overall,
        "state": state,
        "tone": tone,
        "schedule": round(schedule, 1),
        "budget": round(budget, 1),
        "completion": round(completion, 1),
        "dependencies": round(dependencies, 1),
        "deliverables": round(deliverables, 1),
        "resources": round(resources, 1),
        "risks": round(risks, 1),
    }


def _resource_utilization_pct_for_resource(resource: Resource) -> float:
    try:
        total_hours = float(sum((allocation.allocated_hours or 0) for allocation in (resource.allocations or [])))
    except Exception:
        total_hours = 0.0
    cap = float(resource.weekly_capacity or 40.0)
    if cap <= 0:
        return 0.0
    return round(min(150.0, (total_hours / cap) * 100), 1)


def _executive_summary_text(project_name: str, summary: dict, health_breakdown: dict) -> dict:
    attention = []
    if summary.get("blocked_project"):
        attention.append(f"{summary.get('blocked_milestones', 0)} blocked milestone(s) are holding the plan.")
    if summary.get("budget_variance", 0) > 0:
        attention.append(f"Budget is over plan by {summary.get('budget_variance', 0):,.0f}.")
    if summary.get("schedule_variance_days", 0) > 0:
        attention.append(f"Forecast finish is delayed by {summary.get('schedule_variance_days', 0)} day(s).")
    if summary.get("open_risks", 0):
        attention.append(f"{summary.get('open_risks', 0)} open risk(s) remain active.")
    if not attention:
        attention.append("Delivery is broadly aligned with the current baseline.")

    headline = f"{project_name} is {summary.get('health', {}).get('state', 'Yellow').lower()} with a {health_breakdown['overall']}/100 executive score."
    return {
        "headline": headline,
        "attention": attention,
        "summary": " ".join(attention),
    }


def _critical_dependencies_from_path(path_ids: list[int], adjacency: dict[int, list[int]], milestone_map: dict[int, object]):
    critical_dependencies = []
    for index in range(len(path_ids) - 1):
        predecessor = path_ids[index]
        successor = path_ids[index + 1]
        critical_dependencies.append(
            {
                "predecessor_milestone": milestone_repo.format_milestone_reference(milestone_map.get(predecessor)) if milestone_map.get(predecessor) else {"id": predecessor},
                "successor_milestone": milestone_repo.format_milestone_reference(milestone_map.get(successor)) if milestone_map.get(successor) else {"id": successor},
                "dependency_type": "finish_to_start",
            }
        )
    return critical_dependencies


def get_project_planning_intelligence(db: Session, project_id: int):
    performance = project_service.get_project_performance(db, project_id)
    if not performance:
        return None

    milestones = milestone_repo.get_project_milestones(db, project_id)
    dependencies = milestone_repo.get_project_milestone_dependencies(db, project_id)
    issues = project_perf_repo.get_project_issues(db, project_id)
    baseline = repo.get_project_baseline(db, project_id)

    milestone_map, adjacency, reverse, best_chain = _longest_chain(milestones, dependencies)
    critical_path_ids = best_chain[1]
    critical_milestone_ids = set(critical_path_ids)
    project_resources = _resource_pool_for_project(db, project_id, milestones, issues)

    base_summary = performance["summary"]
    base_comparison = performance["baseline_comparison"]
    plan_start = _planned_start(milestones) or _date_only(performance["summary"].get("planned_start"))
    plan_finish = _planned_finish(milestones, _as_int(getattr(baseline, "planned_duration_days", 0), 0), plan_start)
    actual_start = _actual_start(milestones, issues)
    actual_finish = _actual_finish(milestones)

    dependencies_by_successor: dict[int, list] = defaultdict(list)
    dependencies_by_predecessor: dict[int, list] = defaultdict(list)
    for dependency in dependencies:
        dependencies_by_successor[dependency.successor_milestone_id].append(dependency)
        dependencies_by_predecessor[dependency.predecessor_milestone_id].append(dependency)

    enriched_milestones = [
        _milestone_planning_row(
            db,
            milestone,
            next((item for item in performance["milestones"] if str(item["id"]) == str(milestone.id)), {}),
            issues,
            dependencies_by_successor,
            dependencies_by_predecessor,
            project_resources,
            base_summary,
            milestone_map,
        )
        for milestone in milestones
    ]
    for row in enriched_milestones:
        row["critical_path"] = row["id"] in critical_milestone_ids

    health_breakdown = _project_health_breakdown(base_summary, enriched_milestones, project_resources)
    ceo_summary = _executive_summary_text(performance["project"]["name"], base_summary, health_breakdown)

    resource_details = [
        {
            "id": resource.id,
            "name": resource.name,
            "position": resource.position,
            "availability_status": resource.availability_status,
            "weekly_capacity": float(resource.weekly_capacity or 0),
            "utilization_percentage": _resource_utilization_pct_for_resource(resource),
            "overloaded": _resource_utilization_pct_for_resource(resource) > 100,
        }
        for resource in project_resources
    ]
    resource_details.sort(key=lambda item: (-item["utilization_percentage"], item["name"]))

    audit_log_rows = repo.get_planning_audit_logs(
        db,
        {
            "planning_milestone": [item.id for item in milestones],
            "planning_deliverable": [deliverable.id for milestone in milestones for deliverable in (milestone.deliverables or [])],
            "planning_dependency": [dependency.id for dependency in dependencies],
            "planning_baseline": [baseline.id] if baseline else [],
        },
        limit=60,
    )
    audit_trail = [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in audit_log_rows
    ]

    critical_dependencies = _critical_dependencies_from_path(critical_path_ids, adjacency, milestone_map)
    longest_chain_length = best_chain[0]

    return {
        **performance,
        "project": performance["project"],
        "summary": {
            **base_summary,
            "health_breakdown": health_breakdown,
            "executive_score": health_breakdown["overall"],
            "executive_summary": ceo_summary,
            "forecast": {
                "original_finish": _date_str(plan_finish),
                "forecast_finish": base_summary.get("forecast_finish"),
                "delay_days": base_summary.get("schedule_variance_days", 0),
                "confidence": "High" if base_summary.get("blocked_project") is False and base_summary.get("schedule_variance_days", 0) <= 5 else "Medium" if base_summary.get("schedule_variance_days", 0) <= 10 else "Low",
                "main_cause": "Dependencies" if base_summary.get("blocked_project") else ("Budget pressure" if base_summary.get("budget_variance", 0) > 0 else "Progress variance"),
            },
            "traffic_light": health_breakdown["state"],
            "critical_path_length": longest_chain_length,
            "critical_path": [milestone_repo.format_milestone_reference(milestone_map[mid]) for mid in critical_path_ids if milestone_map.get(mid)],
            "critical_dependencies": critical_dependencies,
            "projects_needing_attention": 1 if health_breakdown["overall"] < 80 else 0,
            "expected_delays": max(base_summary.get("schedule_variance_days", 0), 0),
            "estimated_budget_overrun": max(base_summary.get("budget_variance", 0), 0),
            "total_blocked_work": base_summary.get("blocked_milestones", 0),
        },
        "health_breakdown": health_breakdown,
        "ceo_summary": {
            "overall_portfolio_health": health_breakdown["overall"],
            "projects_needing_attention": 1 if health_breakdown["overall"] < 80 else 0,
            "critical_milestones": len([item for item in enriched_milestones if item.get("critical_path")]),
            "expected_delays": max(base_summary.get("schedule_variance_days", 0), 0),
            "estimated_budget_overrun": max(base_summary.get("budget_variance", 0), 0),
            "total_blocked_work": base_summary.get("blocked_milestones", 0),
            "summary": ceo_summary["summary"],
        },
        "forecast": {
            "original_finish": _date_str(plan_finish),
            "forecast_finish": base_summary.get("forecast_finish"),
            "delay_days": base_summary.get("schedule_variance_days", 0),
            "confidence": "High" if base_summary.get("blocked_project") is False and base_summary.get("schedule_variance_days", 0) <= 5 else "Medium" if base_summary.get("schedule_variance_days", 0) <= 10 else "Low",
            "main_cause": "Dependencies" if base_summary.get("blocked_project") else ("Budget pressure" if base_summary.get("budget_variance", 0) > 0 else "Progress variance"),
        },
        "critical_path": {
            "milestones": [milestone_repo.format_milestone_reference(milestone_map[mid]) for mid in critical_path_ids if milestone_map.get(mid)],
            "critical_dependencies": critical_dependencies,
            "critical_chain_length": longest_chain_length,
            "non_critical_milestones": [milestone_repo.format_milestone_reference(milestone) for milestone in milestones if milestone.id not in critical_milestone_ids],
        },
        "resource_planning": {
            "resources": resource_details,
            "overloaded_resources": [item for item in resource_details if item["overloaded"]],
            "available_resources": [item for item in resource_details if not item["overloaded"]][:6],
            "suggested_replacement_candidates": [item for item in resource_details if not item["overloaded"]][:3],
        },
        "audit_trail": audit_trail,
        "milestones": enriched_milestones,
        "plan_vs_actual": enriched_milestones,
        "baseline": {
            "id": baseline.id,
            "planned_duration_days": int(baseline.planned_duration_days or 0),
            "planned_budget": float(baseline.planned_budget or 0),
            "planned_hours": float(baseline.planned_hours or 0),
            "planned_resources_count": int(baseline.planned_resources_count or 0),
            "planning": {
                "planned_hours": float(baseline.planned_hours or 0),
                "actual_hours": base_summary.get("actual_hours", 0.0),
                "variance": base_summary.get("hours_variance", 0.0),
            },
            "budget": {
                "planned": float(baseline.planned_budget or 0),
                "actual": base_summary.get("actual_cost", 0.0),
                "variance": base_summary.get("budget_variance", 0.0),
            },
            "dates": {
                "planned_finish": _date_str(plan_finish),
                "forecast_finish": base_summary.get("forecast_finish"),
                "variance_days": base_summary.get("schedule_variance_days", 0),
            },
            "resources": {
                "planned_count": int(baseline.planned_resources_count or 0),
                "actual_count": len(resource_details),
            },
        } if baseline else None,
    }


def get_executive_dashboard(db: Session, project_ids: set[int] | None = None):
    projects = repo.get_active_projects(db, project_ids)
    summaries = []
    for project in projects:
        perf = get_project_planning_intelligence(db, project.id)
        if not perf:
            continue
        summary = perf["summary"]
        health_score = perf["summary"]["health"]["score"]
        summaries.append(
            {
                "id": perf["project"]["id"],
                "name": perf["project"]["name"],
                "key": perf["project"]["key"],
                "status": perf["project"]["status"],
                "health": perf["summary"]["health"],
                "completion_pct": perf["summary"]["completion_pct"],
                "schedule_variance_days": perf["summary"]["schedule_variance_days"],
                "budget_variance": perf["summary"]["budget_variance"],
                "blocked_milestones": perf["summary"]["blocked_milestones"],
                "open_risks": perf["summary"]["open_risks"],
                "forecast_finish": perf["summary"]["forecast_finish"],
                "health_score": health_score,
                "blocked_project": perf["summary"]["blocked_project"],
            }
        )

    if not summaries:
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "summary": {
                "projects_on_track": 0,
                "projects_at_risk": 0,
                "projects_delayed": 0,
                "average_schedule_variance": 0,
                "average_budget_variance": 0,
                "average_completion": 0,
                "average_health": 0,
                "blocked_milestones": 0,
                "critical_dependencies": 0,
                "upcoming_milestones": 0,
                "overloaded_resources": 0,
                "delayed_deliverables": 0,
                "largest_variance": None,
                "worst_project": None,
                "top_project": None,
                "portfolio_health": 0,
                "summary": "No active projects found.",
            },
            "projects": [],
            "health_distribution": {"green": 0, "yellow": 0, "red": 0},
        }

    on_track = sum(1 for item in summaries if item["health"]["state"] == "Green")
    at_risk = sum(1 for item in summaries if item["health"]["state"] == "Yellow")
    delayed = sum(1 for item in summaries if item["health"]["state"] == "Red")
    average_schedule = round(sum(item["schedule_variance_days"] for item in summaries) / len(summaries), 1)
    average_budget = round(sum(item["budget_variance"] for item in summaries) / len(summaries), 1)
    average_completion = round(sum(item["completion_pct"] for item in summaries) / len(summaries), 1)
    average_health = round(sum(item["health_score"] for item in summaries) / len(summaries), 1)
    blocked_milestones = sum(item["blocked_milestones"] for item in summaries)
    critical_dependencies = sum(item["blocked_milestones"] for item in summaries)
    portfolio_health = round((average_health * 0.7) + (average_completion * 0.3), 1)
    largest_variance = max(summaries, key=lambda item: abs(item["schedule_variance_days"]))
    worst_project = min(summaries, key=lambda item: item["health_score"])
    top_project = max(summaries, key=lambda item: item["health_score"])

    upcoming_milestones = 0
    delayed_deliverables = 0
    overloaded_resources = 0
    for project in projects:
        perf = get_project_planning_intelligence(db, project.id)
        if not perf:
            continue
        for milestone in perf["milestones"]:
            planned_end = _date_only(milestone.get("planned_end_date"))
            if planned_end and 0 <= (planned_end - _today()).days <= 30 and milestone.get("completion_percentage", 0) < 100:
                upcoming_milestones += 1
            for deliverable in milestone.get("deliverables", []):
                if deliverable.get("late"):
                    delayed_deliverables += 1
        overloaded_resources += len(perf.get("resource_planning", {}).get("overloaded_resources", [])) if perf.get("resource_planning") else 0

    health_distribution = {
        "green": sum(1 for item in summaries if item["health"]["state"] == "Green"),
        "yellow": sum(1 for item in summaries if item["health"]["state"] == "Yellow"),
        "red": sum(1 for item in summaries if item["health"]["state"] == "Red"),
    }

    summary_text = (
        f"{on_track} projects are on track, {at_risk} are at risk, and {delayed} are delayed. "
        f"The portfolio health score is {portfolio_health}/100."
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "projects_on_track": on_track,
            "projects_at_risk": at_risk,
            "projects_delayed": delayed,
            "average_schedule_variance": average_schedule,
            "average_budget_variance": average_budget,
            "average_completion": average_completion,
            "average_health": average_health,
            "blocked_milestones": blocked_milestones,
            "critical_dependencies": critical_dependencies,
            "upcoming_milestones": upcoming_milestones,
            "overloaded_resources": overloaded_resources,
            "delayed_deliverables": delayed_deliverables,
            "largest_variance": largest_variance,
            "worst_project": worst_project,
            "top_project": top_project,
            "portfolio_health": portfolio_health,
            "summary": summary_text,
        },
        "projects": summaries,
        "health_distribution": health_distribution,
    }
