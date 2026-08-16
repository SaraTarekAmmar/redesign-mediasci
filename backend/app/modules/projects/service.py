from __future__ import annotations

from datetime import date, datetime, timedelta

from app.modules.milestones.repository import format_deliverable, format_milestone_reference
from app.modules.projects import performance_repository as repo


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
            return date.fromisoformat(value[:10])
        except (ValueError, TypeError):
            return None
    return None


def _date_str(value) -> str | None:
    d = _date_only(value)
    return d.isoformat() if d else None


def _today() -> date:
    return datetime.utcnow().date()


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
        "planned_progress_pct": round(_as_float(milestone.planned_progress, 0.0), 2),
        "actual_progress_pct": max(0, min(100, round(issue_progress if issue_progress is not None else completion_pct))),
        "forecast_progress_pct": max(
            0,
            min(
                100,
                round(
                    issue_progress
                    if issue_progress is not None
                    else completion_pct if completion_pct is not None else _as_float(milestone.planned_progress, 0.0)
                ),
            ),
        ),
        "progress_variance_pct": round(max(0, min(100, completion_pct)) - _as_float(milestone.planned_progress, 0.0), 2),
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
        "blocking_milestones": [format_milestone_reference(item) for item in blocking],
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


def get_project_performance(db, project_id: int):
    project = repo.get_project_for_performance(db, project_id)
    if not project:
        return None

    milestones = repo.get_project_milestones(db, project_id)
    dependencies = repo.get_project_milestone_dependencies(db, project_id)
    issues = repo.get_project_issues(db, project_id)
    budgets = repo.get_project_budgets(db, project_id)
    expenses = repo.get_project_expenses(db, project_id)
    risks = repo.get_project_risks(db, project_id)

    milestones_by_id = {milestone.id: milestone for milestone in milestones}
    dependencies_by_successor = {}
    for dependency in dependencies:
        dependencies_by_successor.setdefault(dependency.successor_milestone_id, []).append(dependency)
    milestone_performance = [
        {
            **{
                "id": milestone.id,
                "project_id": milestone.project_id,
                "name": milestone.name,
                "title": milestone.name,
                "description": milestone.description,
                "planned_start_date": _date_str(milestone.planned_start_date),
                "planned_end_date": _date_str(milestone.planned_end_date),
                "actual_start_date": _date_str(milestone.actual_start_date),
                "actual_end_date": _date_str(milestone.actual_end_date),
                "planned_hours": _as_float(milestone.planned_hours, 0.0),
                "planned_budget": _as_float(milestone.planned_budget, 0.0),
                "planned_progress": _as_float(milestone.planned_progress, 0.0),
                "planned_progress_pct": round(_as_float(milestone.planned_progress, 0.0), 2),
                "status": milestone.status,
                "owner_resource_id": milestone.owner_resource_id,
                "owner_resource": {
                    "id": milestone.owner_resource.id,
                    "name": milestone.owner_resource.name,
                    "email": milestone.owner_resource.email,
                    "position": milestone.owner_resource.position,
                    "seniority": milestone.owner_resource.seniority,
                    "availability_status": milestone.owner_resource.availability_status,
                }
                if milestone.owner_resource
                else None,
                "sort_order": milestone.sort_order or 0,
                "date": _date_str(milestone.planned_end_date or milestone.planned_start_date),
                "deliverables": [format_deliverable(deliverable) for deliverable in (milestone.deliverables or [])],
                "deliverables_count": len(milestone.deliverables or []),
                "created_at": milestone.created_at.isoformat() if milestone.created_at else None,
                "updated_at": milestone.updated_at.isoformat() if milestone.updated_at else None,
            },
            **_milestone_performance(milestone, milestones_by_id, dependencies_by_successor, issues),
        }
        for milestone in milestones
    ]

    total_issues = len(issues)
    completed_issues = sum(1 for issue in issues if _is_issue_done(issue))
    open_issues = max(total_issues - completed_issues, 0)
    completed_story_points = sum(_as_int(issue.story_points, 0) for issue in issues if _is_issue_done(issue))
    remaining_story_points = sum(_as_int(issue.story_points, 0) for issue in issues if not _is_issue_done(issue))
    issue_completion_pct = round((completed_issues / total_issues) * 100) if total_issues else 0

    milestone_completion_values = [item["completion_percentage"] for item in milestone_performance]
    milestone_completion_pct = round(sum(milestone_completion_values) / len(milestone_completion_values)) if milestone_completion_values else 0

    blocked_milestones = [item for item in milestone_performance if item["blocked"]]
    overdue_milestones = [
        item
        for item in milestone_performance
        if item.get("planned_end_date")
        and item.get("completion_percentage", 0) < 100
        and _date_only(item["planned_end_date"]) is not None
        and _date_only(item["planned_end_date"]) < _today()
    ]
    blocked_project = bool(blocked_milestones)
    blocking_milestone = blocked_milestones[0] if blocked_milestones else None
    blocking_reason = blocking_milestone["blocking_reason"] if blocking_milestone else None

    baseline = getattr(project, "planning_baseline", None)
    baseline_planned_duration_days = _as_int(getattr(baseline, "planned_duration_days", 0), 0) if baseline else 0
    planned_start = _planned_start(milestones) or _date_only(project.start_date)
    planned_finish = _planned_finish(milestones, baseline_planned_duration_days, planned_start)
    actual_start = _actual_start(milestones, issues)
    actual_finish = _actual_finish(milestones)

    actual_hours = _actual_hours(issues)
    planned_hours = _as_float(getattr(baseline, "planned_hours", 0), 0.0) if baseline and _as_float(getattr(baseline, "planned_hours", 0), 0.0) > 0 else sum(_as_float(milestone.planned_hours, 0.0) for milestone in milestones)
    if planned_hours <= 0:
        planned_hours = sum(_as_float(issue.estimated_hours, 0.0) for issue in issues)
    remaining_hours = _remaining_hours(issues, planned_hours, actual_hours)
    hours_variance = round(actual_hours - planned_hours, 2)

    planned_budget = _as_float(getattr(baseline, "planned_budget", 0), 0.0) if baseline and _as_float(getattr(baseline, "planned_budget", 0), 0.0) > 0 else sum(_as_float(milestone.planned_budget, 0.0) for milestone in milestones)
    if planned_budget <= 0:
        planned_budget = sum(_as_float(budget.total_budget, 0.0) for budget in budgets)
    actual_cost = _actual_cost(issues, budgets, expenses)
    remaining_budget = round(max(planned_budget - actual_cost, 0.0), 2)
    budget_variance = round(actual_cost - planned_budget, 2)

    project_progress_pct = issue_completion_pct if total_issues else milestone_completion_pct
    forecast_finish = actual_finish
    if not forecast_finish and planned_start:
        if project_progress_pct > 0:
            elapsed_days = max((_today() - planned_start).days, 1)
            projected_total_days = max(1, round(elapsed_days * (100 / max(project_progress_pct, 1))))
            forecast_finish = planned_start + timedelta(days=projected_total_days)
        elif planned_finish:
            forecast_finish = planned_finish

    if planned_finish and forecast_finish:
        schedule_variance_days = (forecast_finish - planned_finish).days
    elif planned_finish and actual_finish:
        schedule_variance_days = (actual_finish - planned_finish).days
    else:
        schedule_variance_days = 0

    days_late = max(schedule_variance_days, 0)
    days_ahead = max(-schedule_variance_days, 0)

    open_risks = 0
    critical_risks = 0
    for risk in risks:
        status = (risk.status or "").strip().lower()
        if status not in {"closed", "accepted"}:
            open_risks += 1
        if (risk.severity or "").strip().lower() in {"critical", "high"}:
            critical_risks += 1

    health = _project_health(
        {
            "milestone_completion_pct": milestone_completion_pct,
            "issue_completion_pct": issue_completion_pct,
            "budget_variance": budget_variance,
            "planned_budget": planned_budget,
            "days_late": days_late,
        },
        len(blocked_milestones),
        len(overdue_milestones),
        open_risks,
        critical_risks,
    )

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "key": project.key,
            "status": project.status,
            "classification": project.classification,
            "type": project.type,
            "client_id": project.client_id,
            "team_id": project.team_id,
        },
        "summary": {
            "health": health,
            "completion_pct": project_progress_pct,
            "schedule_variance_days": schedule_variance_days,
            "days_late": days_late,
            "days_ahead": days_ahead,
            "planned_start": _date_str(planned_start),
            "actual_start": _date_str(actual_start),
            "planned_finish": _date_str(planned_finish),
            "forecast_finish": _date_str(forecast_finish),
            "actual_finish": _date_str(actual_finish),
            "planned_hours": round(planned_hours, 2),
            "actual_hours": actual_hours,
            "remaining_hours": remaining_hours,
            "hours_variance": hours_variance,
            "planned_budget": round(planned_budget, 2),
            "actual_cost": actual_cost,
            "remaining_budget": remaining_budget,
            "budget_variance": budget_variance,
            "blocked_milestones": len(blocked_milestones),
            "open_risks": open_risks,
            "blocked_project": blocked_project,
            "blocking_milestone": blocking_milestone if blocking_milestone else None,
            "blocking_reason": blocking_reason,
            "milestone_completion_pct": milestone_completion_pct,
            "issue_completion_pct": issue_completion_pct,
            "completed_issues": completed_issues,
            "remaining_issues": open_issues,
            "completed_story_points": completed_story_points,
            "remaining_story_points": remaining_story_points,
            "overdue_milestones": len(overdue_milestones),
        },
        "baseline_comparison": {
            "planning": {
                "planned_hours": round(planned_hours, 2),
                "actual_hours": actual_hours,
                "variance": hours_variance,
            },
            "budget": {
                "planned": round(planned_budget, 2),
                "actual": actual_cost,
                "variance": budget_variance,
            },
            "dates": {
                "planned_finish": _date_str(planned_finish),
                "forecast_finish": _date_str(forecast_finish),
                "variance_days": schedule_variance_days,
            },
            "resources": {
                "planned_count": _as_int(getattr(baseline, "planned_resources_count", 0), 0) if baseline else 0,
                "actual_count": len({issue.assignee_id for issue in issues if issue.assignee_id is not None}),
            },
        },
        "milestones": milestone_performance,
    }
