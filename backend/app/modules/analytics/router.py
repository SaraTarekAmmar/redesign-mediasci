"""Analytics router — burndown, velocity, workload, executive dashboard, SPA analytics, export."""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_permissions, _get_user_roles
from app.modules.projects.access import accessible_project_ids, filter_query_by_project_access, is_system_admin
from app.models.issue import Issue, IssueStatus, sprint_issues
from app.models.sprint import Sprint
from app.models.misc import AuditLog
from app.models.project import Project
from app.models.user import User, project_members
from app.models.time_tracking import TimeLog

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class ProjectNotesIn(BaseModel):
    notes: Optional[str] = None


def _time_ago(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - dt
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return "just now"
    if seconds < 3600:
        mins = seconds // 60
        return f"{mins}m ago"
    if seconds < 86400:
        hours = seconds // 3600
        return f"{hours}h ago"
    days = seconds // 86400
    if days < 30:
        return f"{days}d ago"
    return dt.date().isoformat()


def _status_ids_by_category(db: Session, categories: list[str]) -> set[int]:
    rows = db.query(IssueStatus.id).filter(IssueStatus.category.in_(categories)).all()
    return {r.id for r in rows}


def _build_user_stats(db: Session, user_id: int, days: int, allowed_project_ids: set[int] | None = None) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=max(days, 1))
    done_ids = _status_ids_by_category(db, ["done"])
    in_progress_ids = _status_ids_by_category(db, ["in_progress", "review"])

    base = db.query(Issue).filter(
        Issue.assignee_id == user_id,
        Issue.deleted_at.is_(None),
    )
    if allowed_project_ids is not None:
        base = base.filter(Issue.project_id.in_(allowed_project_ids or {-1}))
    assigned_total = base.count()
    completed = base.filter(Issue.issue_status_id.in_(done_ids or [-1])).count()
    in_progress = base.filter(Issue.issue_status_id.in_(in_progress_ids or [-1])).count()
    overdue = base.filter(
        Issue.due_date.isnot(None),
        Issue.due_date < datetime.now(timezone.utc),
        or_(Issue.issue_status_id.is_(None), ~Issue.issue_status_id.in_(done_ids or [-1])),
    ).count()

    logged_query = (
        db.query(func.coalesce(func.sum(TimeLog.duration_minutes), 0))
        .outerjoin(Issue, Issue.id == TimeLog.issue_id)
        .filter(
            TimeLog.user_id == user_id,
            or_(TimeLog.logged_at >= since.date(), TimeLog.created_at >= since),
        )
    )
    if allowed_project_ids is not None:
        logged_query = logged_query.filter(Issue.project_id.in_(allowed_project_ids or {-1}))
    logged_minutes = logged_query.scalar()
    logged_hours = round(float(logged_minutes or 0) / 60.0, 1)

    completion_rate = round((completed / max(assigned_total, 1)) * 100, 1)
    efficiency_rate = round(min(100.0, completion_rate + (10 if overdue == 0 else -min(overdue * 5, 30))), 1)

    # Average resolution speed: days from created_at → updated_at for done issues in window
    done_issues_query = (
        db.query(Issue)
        .filter(
            Issue.assignee_id == user_id,
            Issue.deleted_at.is_(None),
            Issue.issue_status_id.in_(done_ids or [-1]),
            Issue.updated_at >= since,
        )
    )
    if allowed_project_ids is not None:
        done_issues_query = done_issues_query.filter(Issue.project_id.in_(allowed_project_ids or {-1}))
    done_issues = done_issues_query.all()
    speeds = []
    for issue in done_issues:
        if issue.created_at and issue.updated_at:
            speeds.append(max(0.0, (issue.updated_at - issue.created_at).total_seconds() / 86400.0))
    speed_avg_days = round(sum(speeds) / max(len(speeds), 1), 1) if speeds else 0.0

    performance_score = int(
        max(
            0,
            min(
                100,
                round(
                    completion_rate * 0.55
                    + efficiency_rate * 0.25
                    + (20 if overdue == 0 else max(0, 20 - overdue * 4))
                    + min(logged_hours, 20) * 0.5
                ),
            ),
        )
    )

    # Daily completed chart
    chart_map: dict[str, int] = {}
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).date().isoformat()
        chart_map[d] = 0
    for issue in done_issues:
        if issue.updated_at:
            key = issue.updated_at.date().isoformat()
            if key in chart_map:
                chart_map[key] += 1
    chart_data = [{"date": k, "count": v} for k, v in chart_map.items()]

    # Per-project breakdown for this assignee
    project_rows_query = (
        db.query(
            Project.id,
            Project.name,
            Issue.issue_status_id,
            func.count(Issue.id),
        )
        .join(Issue, Issue.project_id == Project.id)
        .filter(
            Issue.assignee_id == user_id,
            Issue.deleted_at.is_(None),
            Project.deleted_at.is_(None),
        )
    )
    if allowed_project_ids is not None:
        project_rows_query = project_rows_query.filter(Project.id.in_(allowed_project_ids or {-1}))
    project_rows = project_rows_query.group_by(Project.id, Project.name, Issue.issue_status_id).all()
    project_stats_map: dict[int, dict] = {}
    for project_id, name, status_id, count in project_rows:
        entry = project_stats_map.setdefault(
            project_id, {"name": name, "completed": 0, "in_progress": 0}
        )
        if status_id in done_ids:
            entry["completed"] += count
        elif status_id in in_progress_ids:
            entry["in_progress"] += count
        else:
            entry["in_progress"] += count
    project_stats = list(project_stats_map.values())

    return {
        "completed": completed,
        "assigned_total": assigned_total,
        "in_progress": in_progress,
        "overdue": overdue,
        "logged_hours": logged_hours,
        "completion_rate": completion_rate,
        "efficiency_rate": efficiency_rate,
        "speed_avg_days": speed_avg_days,
        "performance_score": performance_score,
        "chart_data": chart_data,
        "project_stats": project_stats,
    }


# ── SPA analytics contract (used by AnalyticsPage) ─────────────────────────

@router.get("/feed")
def analytics_feed(
    limit: int = Query(40, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs_query = db.query(AuditLog)
    roles = _get_user_roles(current_user.id, db)
    if not is_system_admin(roles):
        logs_query = logs_query.filter(AuditLog.user_id == current_user.id)
    logs = (
        logs_query
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )
    user_ids = {log.user_id for log in logs if log.user_id}
    users = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(user_ids or [-1])).all()
    }
    items = []
    for log in logs:
        action = (log.action or "updated").replace("_", " ")
        entity = (log.entity_type or "item").replace("_", " ")
        label = f"{action} <strong>{entity}</strong>"
        if log.entity_id:
            label += f" #{log.entity_id}"
        user = users.get(log.user_id)
        items.append({
            "id": log.id,
            "label": label,
            "time_ago": _time_ago(log.created_at),
            "user": {"name": user.name} if user else None,
        })
    return {"data": items}


@router.get("/me")
def analytics_me(
    days: int = Query(30, ge=1, le=365),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    roles = _get_user_roles(current_user.id, db)
    allowed_ids = None if is_system_admin(roles) else accessible_project_ids(db, current_user.id, roles)
    return _build_user_stats(db, current_user.id, days, allowed_ids)


@router.get("/users/{user_id}")
def analytics_user(
    user_id: int,
    days: int = Query(30, ge=1, le=365),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(404, "User not found.")
    roles = _get_user_roles(current_user.id, db)
    if not is_system_admin(roles) and user_id != current_user.id:
        raise HTTPException(403, "You can only view your own analytics.")
    allowed_ids = None if is_system_admin(roles) else accessible_project_ids(db, current_user.id, roles)
    return _build_user_stats(db, user_id, days, allowed_ids)


@router.get("/projects/{project_id}")
def analytics_project(
    project_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()
    if not project:
        raise HTTPException(404, "Project not found.")

    done_ids = _status_ids_by_category(db, ["done"])
    in_progress_ids = _status_ids_by_category(db, ["in_progress", "review"])
    todo_ids = _status_ids_by_category(db, ["todo"])

    issues_q = db.query(Issue).filter(Issue.project_id == project_id, Issue.deleted_at.is_(None))
    total = issues_q.count()
    completed = issues_q.filter(Issue.issue_status_id.in_(done_ids or [-1])).count()
    in_progress = issues_q.filter(Issue.issue_status_id.in_(in_progress_ids or [-1])).count()
    todo = issues_q.filter(Issue.issue_status_id.in_(todo_ids or [-1])).count()
    completion_rate = round((completed / max(total, 1)) * 100, 1)

    member_rows = db.execute(
        select(project_members.c.user_id, project_members.c.role)
        .where(project_members.c.project_id == project_id)
    ).all()
    user_ids = [r.user_id for r in member_rows]
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids or [-1])).all()}
    members = []
    for row in member_rows:
        user = users.get(row.user_id)
        if not user:
            continue
        members.append({
            "id": user.id,
            "name": user.name,
            "role": row.role,
            "avatar_url": getattr(user, "avatar_url", None) or getattr(user, "avatar", None),
        })

    return {
        "id": project.id,
        "name": project.name,
        "key": project.key,
        "status": project.status,
        "type": project.type,
        "description": project.description,
        "notes": project.notes,
        "members": members,
        "stats": {
            "total": total,
            "completed": completed,
            "in_progress": in_progress,
            "todo": todo,
            "completion_rate": completion_rate,
        },
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


@router.put("/projects/{project_id}/notes")
def update_project_notes(
    project_id: int,
    body: ProjectNotesIn,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id, Project.deleted_at.is_(None)).first()
    if not project:
        raise HTTPException(404, "Project not found.")
    project.notes = body.notes
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(project)
    return {"id": project.id, "notes": project.notes}


@router.get("/burndown")
def burndown(
    sprint_id: int = Query(...),
    current_user=Depends(require_permissions("view-analytics")),
    db: Session = Depends(get_db),
):
    """Sprint burndown data — story points remaining per day."""
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        return {"error": "Sprint not found"}

    # Get all issues in sprint
    issue_ids = db.execute(
        select(sprint_issues.c.issue_id).where(sprint_issues.c.sprint_id == sprint_id)
    ).scalars().all()

    total_points = db.query(func.sum(Issue.story_points)).filter(
        Issue.id.in_(issue_ids or [-1])
    ).scalar() or 0

    done_statuses = db.query(IssueStatus).filter(IssueStatus.category == "done").all()
    done_ids = {s.id for s in done_statuses}

    completed_points = db.query(func.sum(Issue.story_points)).filter(
        Issue.id.in_(issue_ids or [-1]),
        Issue.issue_status_id.in_(done_ids),
    ).scalar() or 0

    # Generate daily ideal line
    start = sprint.start_date or datetime.now().date()
    end = sprint.end_date or (datetime.now() + timedelta(days=14)).date()
    days = (end - start).days or 1

    ideal = [
        {
            "date": (start + timedelta(days=i)).isoformat(),
            "ideal": round(total_points * (1 - i / days), 1),
            "remaining": None,
        }
        for i in range(days + 1)
    ]
    # Inject today's actual remaining
    today_idx = min((datetime.now().date() - start).days, days)
    if 0 <= today_idx < len(ideal):
        ideal[today_idx]["remaining"] = float(total_points - completed_points)

    return {
        "sprint_id": sprint_id,
        "sprint_name": sprint.name,
        "total_points": float(total_points),
        "completed_points": float(completed_points),
        "remaining_points": float(total_points - completed_points),
        "burndown": ideal,
    }


@router.get("/velocity")
def velocity(
    project_id: int = Query(...),
    limit: int = Query(5),
    current_user=Depends(require_permissions("view-analytics")),
    db: Session = Depends(get_db),
):
    """Sprint velocity — story points completed per sprint."""
    sprints = db.query(Sprint).filter(
        Sprint.project_id == project_id,
        Sprint.status == "completed",
    ).order_by(Sprint.end_date.desc()).limit(limit).all()

    done_statuses = db.query(IssueStatus).filter(IssueStatus.category == "done").all()
    done_ids = {s.id for s in done_statuses}

    result = []
    for s in sprints:
        issue_ids = db.execute(
            select(sprint_issues.c.issue_id).where(sprint_issues.c.sprint_id == s.id)
        ).scalars().all()
        points = db.query(func.sum(Issue.story_points)).filter(
            Issue.id.in_(issue_ids or [-1]),
            Issue.issue_status_id.in_(done_ids),
        ).scalar() or 0
        result.append({
            "sprint_id": s.id,
            "sprint_name": s.name,
            "start_date": s.start_date.isoformat() if s.start_date else None,
            "end_date": s.end_date.isoformat() if s.end_date else None,
            "completed_points": float(points),
        })

    avg = sum(r["completed_points"] for r in result) / max(len(result), 1)
    return {"project_id": project_id, "average_velocity": round(avg, 1), "sprints": list(reversed(result))}


@router.get("/team-workload")
def team_workload(
    project_id: Optional[int] = Query(None),
    current_user=Depends(require_permissions("view-analytics")),
    db: Session = Depends(get_db),
):
    """Team workload — open issues per assignee."""
    q = db.query(
        Issue.assignee_id,
        func.count(Issue.id).label("issue_count"),
        func.sum(Issue.story_points).label("total_points"),
    ).filter(Issue.deleted_at.is_(None))
    q = filter_query_by_project_access(q, Issue.project_id, current_user.id, _get_user_roles(current_user.id, db))
    if project_id:
        q = q.filter(Issue.project_id == project_id)
    q = q.group_by(Issue.assignee_id)
    rows = q.all()

    user_ids = [r.assignee_id for r in rows if r.assignee_id]
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    return [
        {
            "userId": row.assignee_id,
            "userName": users.get(row.assignee_id, User(name="Unassigned")).name if row.assignee_id else "Unassigned",
            "issueCount": row.issue_count,
            "totalPoints": float(row.total_points or 0),
        }
        for row in rows
    ]


@router.get("/project-health")
def project_health(
    project_id: int = Query(...),
    current_user=Depends(require_permissions("view-analytics")),
    db: Session = Depends(get_db),
):
    """High-level project health indicators."""
    from app.models.risk import Risk

    total_issues = db.query(func.count(Issue.id)).filter(Issue.project_id == project_id, Issue.deleted_at.is_(None)).scalar()
    done_statuses = db.query(IssueStatus).filter(IssueStatus.category == "done").all()
    done_ids = {s.id for s in done_statuses}
    completed_issues = db.query(func.count(Issue.id)).filter(Issue.project_id == project_id, Issue.issue_status_id.in_(done_ids), Issue.deleted_at.is_(None)).scalar()
    open_risks = db.query(func.count(Risk.id)).filter(Risk.project_id == project_id, Risk.status == "identified").scalar()
    active_sprint = db.query(Sprint).filter(Sprint.project_id == project_id, Sprint.status == "active").first()

    progress = round((completed_issues / max(total_issues, 1)) * 100, 1)
    return {
        "project_id": project_id,
        "progress_pct": progress,
        "total_issues": total_issues,
        "completed_issues": completed_issues,
        "open_risks": open_risks,
        "active_sprint": {"id": active_sprint.id, "name": active_sprint.name} if active_sprint else None,
        "health_status": "green" if progress >= 70 else "yellow" if progress >= 40 else "red",
    }


@router.get("/executive-dashboard")
def executive_dashboard(
    current_user=Depends(require_permissions("view-analytics")),
    db: Session = Depends(get_db),
):
    """Cross-project executive overview."""
    from app.models.risk import Risk

    projects_query = db.query(Project).filter(Project.deleted_at.is_(None), Project.status == "active")
    roles = _get_user_roles(current_user.id, db)
    projects_query = filter_query_by_project_access(projects_query, Project.id, current_user.id, roles)
    projects = projects_query.all()
    done_statuses = db.query(IssueStatus).filter(IssueStatus.category == "done").all()
    done_ids = {s.id for s in done_statuses}

    summary = []
    for p in projects:
        total = db.query(func.count(Issue.id)).filter(Issue.project_id == p.id, Issue.deleted_at.is_(None)).scalar()
        completed = db.query(func.count(Issue.id)).filter(Issue.project_id == p.id, Issue.issue_status_id.in_(done_ids), Issue.deleted_at.is_(None)).scalar()
        risks = db.query(func.count(Risk.id)).filter(Risk.project_id == p.id, Risk.status.in_(["identified", "mitigated"])).scalar()
        summary.append({
            "projectId": p.id,
            "projectName": p.name,
            "progress": round((completed / max(total, 1)) * 100, 1),
            "totalIssues": total,
            "openRisks": risks,
            "status": p.status,
        })

    return {
        "total_projects": len(projects),
        "projects": summary,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/reports/export")
def export_report(
    format: str = Query("json"),
    project_id: Optional[int] = Query(None),
    current_user=Depends(require_permissions("export-reports")),
    db: Session = Depends(get_db),
):
    """Export project data (JSON or CSV)."""
    q = db.query(Issue).filter(Issue.deleted_at.is_(None))
    q = filter_query_by_project_access(
        q,
        Issue.project_id,
        current_user.id,
        _get_user_roles(current_user.id, db),
    )
    if project_id:
        q = q.filter(Issue.project_id == project_id)
    issues = q.all()

    if format == "csv":
        import io, csv
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Key", "Title", "Status", "Priority", "Assignee", "Created"])
        for i in issues:
            writer.writerow([i.id, i.key, i.title, i.issue_status_id, i.issue_priority_id, i.assignee_id, i.created_at])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=report.csv"},
        )

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "total": len(issues),
        "issues": [{"id": i.id, "key": i.key, "title": i.title, "status_id": i.issue_status_id} for i in issues],
    }
