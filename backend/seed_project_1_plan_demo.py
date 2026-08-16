"""
Seed project 1 with a complete planning demo.

This only inserts / updates demo data. It does not change schema or app logic.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.security import hash_password
from app.models.user import User, Role
from app.models.team import Department, Team
from app.models.resource import Resource, Skill, ResourceAllocation, ResourceSkill
from app.models.client import Client, ClientRequest
from app.models.project import Project
from app.models.roadmap import Task
from app.models.planning import (
    ProjectPlanningBaseline,
    ProjectMilestone,
    ProjectDeliverable,
    ProjectMilestoneDependency,
)
from app.models.issue import Issue, IssueType, IssueStatus, IssuePriority
from app.models.sprint import Sprint, SprintMetric
from app.models.time_tracking import TimeLog
from app.models.risk import Risk
from app.models.budget import Budget, ProjectBudget, Expense, ExpenseCategory, FinancialAlert
from app.models.misc import ProjectDocument, ProjectSetting

from seed_operation_hub_demo import dec, ensure_link, ensure_role_assignment, upsert


def d(value) -> Decimal:
    return Decimal(str(value))


def get_one(db, model, **filters):
    row = db.query(model).filter_by(**filters).first()
    if not row:
        raise RuntimeError(f"Missing {model.__name__}: {filters}")
    return row


def seed():
    db = SessionLocal()
    try:
        today = date.today()
        now = datetime.now(timezone.utc)

        superadmin = get_one(db, User, email="superadmin@taskflow.dev")
        superadmin.password = hash_password("super-admin")
        superadmin.name = superadmin.name or "Super Admin"
        superadmin.is_active = True

        role = db.query(Role).filter(Role.name == "super-admin").first()
        if role:
            ensure_role_assignment(db, superadmin, role)

        dept = {
            item.name: item
            for item in db.query(Department).filter(Department.name.in_(["Engineering", "Design", "Operations"])).all()
        }
        team = {
            item.name: item
            for item in db.query(Team).filter(Team.name.in_(["Backend Team", "Frontend Team", "QA Team"])).all()
        }
        client = get_one(db, Client, name="ABC Bank")
        pm = get_one(db, User, email="sarah.pm@operationhub.com")
        backend = get_one(db, User, email="alex.be@operationhub.com")
        frontend = get_one(db, User, email="lisa.fe@operationhub.com")
        qa = get_one(db, User, email="david.qa@operationhub.com")
        designer = get_one(db, User, email="nora.des@operationhub.com")
        lead_fe = get_one(db, User, email="elena.fe@operationhub.com")
        lead_be = get_one(db, User, email="marcus.be@operationhub.com")

        resources = {
            user.email: upsert(
                db,
                Resource,
                {"user_id": user.id},
                {
                    "name": user.name,
                    "email": user.email,
                    "department_id": user.department_id,
                    "role": user.job_title or user.position or "Team Member",
                    "position": user.job_title or user.position or "Team Member",
                    "seniority": user.seniority or "Mid",
                    "salary": d(user.hourly_cost or 0) * d(160),
                    "currency": "USD",
                    "cost_per_hour": d(user.hourly_cost or 0),
                    "weekly_capacity": d(user.capacity or 40),
                    "daily_capacity_hours": d(8),
                    "availability_status": "available",
                    "availability_pct": 100,
                    "contract_type": "full_time",
                    "experience_years": 6,
                    "is_active": 1,
                },
            )
            for user in [superadmin, pm, backend, frontend, qa, designer, lead_fe, lead_be]
        }

        skills = {
            item.name: item
            for item in db.query(Skill).filter(Skill.name.in_(["Python", "FastAPI", "React", "TypeScript", "SQL", "Docker", "UI Design", "Testing"])).all()
        }
        skill_map = {
            "superadmin@taskflow.dev": ["Python", "SQL"],
            "sarah.pm@operationhub.com": ["Testing", "SQL"],
            "alex.be@operationhub.com": ["Python", "FastAPI", "SQL"],
            "elena.fe@operationhub.com": ["React", "TypeScript", "UI Design"],
            "marcus.be@operationhub.com": ["Python", "FastAPI"],
            "lisa.fe@operationhub.com": ["React", "TypeScript"],
            "david.qa@operationhub.com": ["Testing", "Python"],
            "nora.des@operationhub.com": ["UI Design", "React"],
        }
        for email, names in skill_map.items():
            resource = resources[email]
            for name in names:
                skill = skills[name]
                exists = db.query(ResourceSkill).filter_by(resource_id=resource.id, skill_id=skill.id).first()
                if not exists:
                    db.add(
                        ResourceSkill(
                            resource_id=resource.id,
                            skill_id=skill.id,
                            proficiency="expert" if name in {"Python", "React", "UI Design"} else "advanced",
                            years_of_experience=5 if name in {"Python", "React", "UI Design"} else 3,
                            verified=True,
                        )
                    )

        project = upsert(
            db,
            Project,
            {"id": 1},
            {
                "name": "Digital Banking Platform",
                "company_name": client.company,
                "key": "DBP",
                "description": "Enterprise banking platform planning workspace.",
                "type": "software",
                "classification": "standard",
                "status": "in_progress",
                "category": "banking",
                "color": "#2563EB",
                "owner_id": pm.id,
                "team_id": team["Backend Team"].id,
                "start_date": today - timedelta(days=90),
                "end_date": today + timedelta(days=120),
                "client_id": client.id,
                "client_request_id": (
                    db.query(ClientRequest)
                    .filter(ClientRequest.client_id == client.id)
                    .order_by(ClientRequest.id.asc())
                    .first()
                    .id
                ),
                "notes": "Seeded planning demo for project 1.",
            },
        )

        for user in [superadmin, pm, backend, frontend, qa, designer, lead_fe, lead_be]:
            ensure_link(project.members, user)

        upsert(
            db,
            ProjectSetting,
            {"project_id": project.id},
            {
                "working_days": [1, 2, 3, 4, 5],
                "working_hours_per_day": 8,
                "sprint_duration_weeks": 2,
                "default_priority": "High",
                "auto_assign": 1,
                "budget_baseline": d(450000),
                "risk_threshold": "medium",
            },
        )

        upsert(
            db,
            ProjectPlanningBaseline,
            {"project_id": project.id},
            {
                "planned_duration_days": 180,
                "planned_budget": d(450000),
                "planned_hours": d(1680),
                "planned_resources_count": 6,
            },
        )

        issue_types = {
            name: upsert(db, IssueType, {"name": name}, {"icon": name.lower(), "color": color, "is_subtask": 0})
            for name, color in [("Story", "#2563EB"), ("Task", "#14B8A6"), ("Bug", "#F97316"), ("Spike", "#A855F7")]
        }
        priorities = {
            name: upsert(db, IssuePriority, {"name": name}, {"level": level, "icon": name.lower(), "color": color})
            for name, level, color in [("Critical", 4, "#DC2626"), ("High", 3, "#EF4444"), ("Medium", 2, "#F59E0B"), ("Low", 1, "#22C55E")]
        }
        statuses = {
            name: upsert(db, IssueStatus, {"project_id": project.id, "name": name}, {"category": category, "color": color, "position": pos})
            for name, category, color, pos in [
                ("Backlog", "todo", "#94A3B8", 0),
                ("In Progress", "in_progress", "#3B82F6", 1),
                ("In Review", "review", "#F59E0B", 2),
                ("Done", "done", "#10B981", 3),
            ]
        }

        milestones = []
        milestone_rows = [
            ("Requirements", "Business scope and approval", today - timedelta(days=80), today - timedelta(days=60), "Done", 1, pm),
            ("Design", "UX flows and prototypes", today - timedelta(days=59), today - timedelta(days=35), "In Review", 2, lead_fe),
            ("Development", "Backend and frontend implementation", today - timedelta(days=34), today + timedelta(days=18), "In Progress", 3, lead_be),
            ("Testing", "System testing and release readiness", today + timedelta(days=19), today + timedelta(days=44), "Backlog", 4, qa),
        ]
        for name, desc, start_d, end_d, status, order, owner in milestone_rows:
            milestone = upsert(
                db,
                ProjectMilestone,
                {"project_id": project.id, "name": name},
                {
                    "description": desc,
                    "planned_start_date": start_d,
                    "planned_end_date": end_d,
                    "actual_start_date": start_d if status != "Backlog" else None,
                    "actual_end_date": end_d if status == "Done" else None,
                    "planned_hours": d(420 if order == 3 else 320 if order == 2 else 260 if order == 1 else 180),
                    "planned_budget": d(150000 if order == 3 else 90000 if order == 2 else 120000 if order == 1 else 90000),
                    "planned_progress": d(100 if status == "Done" else 65 if status == "In Review" else 45 if status == "In Progress" else 0),
                    "status": status.lower().replace(" ", "_"),
                    "owner_resource_id": resources[owner.email].id,
                    "sort_order": order,
                },
            )
            milestones.append(milestone)

        deliverables_by_milestone = {
            "Requirements": ["BRD", "User Stories"],
            "Design": ["Wireframes", "UI Prototype"],
            "Development": ["Backend APIs", "Frontend Screens"],
            "Testing": ["Test Report", "Deployment Package"],
        }
        deliverables = {}
        for milestone in milestones:
            for idx, title in enumerate(deliverables_by_milestone[milestone.name], start=1):
                deliverables[(milestone.id, title)] = upsert(
                    db,
                    ProjectDeliverable,
                    {"milestone_id": milestone.id, "title": title},
                    {
                        "description": f"{title} for {milestone.name.lower()}",
                        "acceptance_criteria": f"{title} approved by ABC Bank.",
                        "planned_completion_date": milestone.planned_end_date,
                        "actual_completion_date": milestone.planned_end_date if milestone.name == "Requirements" and idx == 1 else None,
                        "status": "completed" if milestone.name == "Requirements" and idx == 1 else milestone.status,
                        "owner_resource_id": milestone.owner_resource_id,
                    },
                )

        for predecessor, successor in zip(milestones, milestones[1:]):
            exists = (
                db.query(ProjectMilestoneDependency)
                .filter_by(predecessor_milestone_id=predecessor.id, successor_milestone_id=successor.id)
                .first()
            )
            if not exists:
                db.add(
                    ProjectMilestoneDependency(
                        predecessor_milestone_id=predecessor.id,
                        successor_milestone_id=successor.id,
                        dependency_type="finish_to_start",
                    )
                )

        sprint1 = upsert(
            db,
            Sprint,
            {"project_id": project.id, "name": "DBP Sprint 1"},
            {
                "board_id": None,
                "goal": "Complete the current demo slice.",
                "notes": "Seeded sprint for planning UI.",
                "start_date": datetime.combine(today - timedelta(days=28), datetime.min.time(), tzinfo=timezone.utc),
                "end_date": datetime.combine(today - timedelta(days=15), datetime.min.time(), tzinfo=timezone.utc),
                "status": "active",
                "capacity_hours": 160,
                "velocity": 28,
                "duration": 14,
            },
        )
        sprint2 = upsert(
            db,
            Sprint,
            {"project_id": project.id, "name": "DBP Sprint 2"},
            {
                "board_id": None,
                "goal": "Complete the remaining demo slice.",
                "notes": "Seeded sprint for planning UI.",
                "start_date": datetime.combine(today - timedelta(days=14), datetime.min.time(), tzinfo=timezone.utc),
                "end_date": datetime.combine(today - timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc),
                "status": "planning",
                "capacity_hours": 120,
                "velocity": 22,
                "duration": 14,
            },
        )

        tasks = {}
        issues_seed = [
            ("Core Banking Integration Adapter", "Story", "High", "Done", 13, 48, backend, milestones[0], "BRD"),
            ("Customer Onboarding Workflow", "Task", "High", "In Review", 8, 32, frontend, milestones[1], "Wireframes"),
            ("Digital Banking UI Shell", "Story", "Medium", "In Progress", 5, 24, frontend, milestones[2], "Frontend Screens"),
            ("OAuth2 + MFA Authentication", "Task", "High", "In Progress", 8, 30, backend, milestones[2], "Backend APIs"),
            ("Release Regression Suite", "Spike", "Low", "Backlog", 3, 18, qa, milestones[3], "Test Report"),
        ]
        issues = []
        for idx, (title, type_name, priority_name, status_name, points, hours, assignee, milestone, deliverable_title) in enumerate(issues_seed, start=1):
            task = upsert(
                db,
                Task,
                {"project_id": project.id, "title": title},
                {
                    "sprint_id": sprint1.id if idx <= 3 else sprint2.id,
                    "description": f"{title} planning task",
                    "assigned_to": assignee.id,
                    "status": "done" if status_name == "Done" else "in_progress" if status_name in {"In Progress", "In Review"} else "pending",
                    "priority": priority_name,
                    "start_date": datetime.combine(today - timedelta(days=idx * 4), datetime.min.time(), tzinfo=timezone.utc),
                    "end_date": datetime.combine(today + timedelta(days=idx * 9), datetime.min.time(), tzinfo=timezone.utc),
                    "duration": hours,
                    "progress": 100 if status_name == "Done" else 70 if status_name == "In Review" else 45 if status_name == "In Progress" else 0,
                    "wbs_code": f"DBP-{idx:02d}",
                    "depends_on": None,
                    "is_milestone": 0,
                    "cost": d(hours) * d(resources[assignee.email].cost_per_hour or 0),
                    "actual_start": datetime.combine(today - timedelta(days=idx * 5), datetime.min.time(), tzinfo=timezone.utc) if status_name != "Backlog" else None,
                    "actual_end": datetime.combine(today - timedelta(days=idx), datetime.min.time(), tzinfo=timezone.utc) if status_name == "Done" else None,
                },
            )
            tasks[title] = task

            issue = upsert(
                db,
                Issue,
                {"project_id": project.id, "title": title},
                {
                    "milestone_id": milestone.id,
                    "deliverable_id": deliverables[(milestone.id, deliverable_title)].id,
                    "issue_type_id": issue_types[type_name].id,
                    "issue_status_id": statuses[status_name].id,
                    "issue_priority_id": priorities[priority_name].id,
                    "assignee_id": assignee.id,
                    "reporter_id": pm.id,
                    "story_points": points,
                    "estimate_minutes": hours * 60,
                    "remaining_minutes": hours * 20,
                    "due_date": datetime.combine(today + timedelta(days=idx * 9), datetime.min.time(), tzinfo=timezone.utc),
                    "start_date": datetime.combine(today - timedelta(days=idx * 4), datetime.min.time(), tzinfo=timezone.utc),
                    "acceptance_criteria": f"{title} is complete when QA signs off.",
                    "definition_of_ready": "Requirements approved and designs available.",
                    "definition_of_done": "Code, tests, and review complete.",
                    "estimated_hours": d(hours),
                    "actual_hours": d(hours * (0.7 if status_name == "Done" else 0.5)),
                    "remaining_hours": d(0 if status_name == "Done" else hours * 0.5),
                    "completion_percentage": 100 if status_name == "Done" else 70 if status_name == "In Review" else 45 if status_name == "In Progress" else 0,
                    "triage_status": "triaged",
                    "triaged_by": pm.id,
                },
            )
            ensure_link(issue.sprints, sprint1 if idx <= 3 else sprint2)
            issues.append(issue)

            upsert(
                db,
                TimeLog,
                {"issue_id": issue.id, "user_id": assignee.id},
                {
                    "duration_minutes": int(hours * 0.8 * 60),
                    "description": f"Work completed for {title}",
                    "logged_at": today - timedelta(days=idx),
                    "billable": True,
                    "rate": resources[assignee.email].cost_per_hour,
                    "approved": True,
                    "approved_by": pm.id,
                    "approved_at": now,
                },
            )

            upsert(
                db,
                ResourceAllocation,
                {"resource_id": resources[assignee.email].id, "project_id": project.id, "task_id": task.id},
                {
                    "allocation_pct": 50 if status_name != "Done" else 25,
                    "allocated_hours": d(hours),
                    "start_date": today - timedelta(days=14),
                    "end_date": today + timedelta(days=28),
                    "role": assignee.job_title or assignee.position,
                },
            )

        for issue in issues[:3]:
            ensure_link(sprint1.issues, issue)
        for issue in issues[3:]:
            ensure_link(sprint2.issues, issue)

        upsert(
            db,
            SprintMetric,
            {"sprint_id": sprint1.id, "date": today - timedelta(days=7)},
            {"remaining_points": 13, "completed_points": 21, "added_points": 8, "scope_change": 2},
        )
        upsert(
            db,
            SprintMetric,
            {"sprint_id": sprint2.id, "date": today - timedelta(days=1)},
            {"remaining_points": 18, "completed_points": 12, "added_points": 5, "scope_change": 1},
        )

        risk_rows = [
            ("Legacy core integration delay", backend.id, 4, 4, "active"),
            ("UI sign-off may slip", frontend.id, 3, 3, "active"),
            ("Regression coverage gap", qa.id, 2, 4, "identified"),
        ]
        for title, owner_id, probability, impact, status in risk_rows:
            upsert(
                db,
                Risk,
                {"project_id": project.id, "title": title},
                {
                    "created_by": pm.id,
                    "owner_user_id": owner_id,
                    "description": title,
                    "category": "delivery",
                    "probability": probability,
                    "impact": impact,
                    "risk_score": probability * impact,
                    "severity": "high" if probability * impact >= 12 else "medium",
                    "status": status,
                    "owner": get_one(db, User, id=owner_id).name,
                    "response_plan": "Track daily and escalate blockers quickly.",
                    "contingency_plan": "Move resources from lower-priority work.",
                    "due_date": today + timedelta(days=21),
                },
            )

        budget = upsert(
            db,
            Budget,
            {"project_id": project.id, "name": "Digital Banking Delivery Budget"},
            {"total_budget": d(450000), "spent": d(398500), "currency": "USD", "start_date": today - timedelta(days=90), "end_date": today + timedelta(days=120)},
        )
        upsert(
            db,
            ProjectBudget,
            {"project_id": project.id},
            {"total_budget": d(450000), "spent_budget": d(398500), "currency": "USD"},
        )
        upsert(
            db,
            Expense,
            {"project_id": project.id, "name": "Cloud hosting"},
            {"category_id": None, "amount": d(12000), "currency": "USD", "date": today - timedelta(days=20), "description": "Production and staging hosting", "vendor": "AWS", "status": "approved"},
        )
        upsert(
            db,
            Expense,
            {"project_id": project.id, "name": "Design tooling"},
            {"category_id": None, "amount": d(8500), "currency": "USD", "date": today - timedelta(days=12), "description": "Figma and collaboration licenses", "vendor": "Figma", "status": "approved"},
        )
        upsert(
            db,
            FinancialAlert,
            {"project_id": project.id, "type": "budget_warning"},
            {"message": "Actual spend is trending above baseline.", "severity": "warning", "acknowledged": 0},
        )

        upsert(
            db,
            ProjectDocument,
            {"project_id": project.id, "original_name": "DBP_architecture.pdf"},
            {
                "name": "Digital Banking Platform Architecture",
                "file_path": "/docs/dbp_architecture.pdf",
                "uploaded_by": pm.id,
                "mime_type": "application/pdf",
                "file_size": 204800,
                "category": "specification",
                "visibility": "project",
            },
        )
        upsert(
            db,
            ProjectDocument,
            {"project_id": project.id, "original_name": "DBP_release_plan.pdf"},
            {
                "name": "Digital Banking Platform Release Plan",
                "file_path": "/docs/dbp_release_plan.pdf",
                "uploaded_by": pm.id,
                "mime_type": "application/pdf",
                "file_size": 122880,
                "category": "plan",
                "visibility": "project",
            },
        )

        db.commit()

        baseline_count = db.query(ProjectPlanningBaseline).filter(ProjectPlanningBaseline.project_id == project.id).count()
        milestone_count = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == project.id).count()
        deliverable_count = db.query(ProjectDeliverable).join(ProjectMilestone).filter(ProjectMilestone.project_id == project.id).count()
        issue_count = db.query(Issue).filter(Issue.project_id == project.id).count()

        assert baseline_count == 1
        assert milestone_count >= 4
        assert deliverable_count >= 8
        assert issue_count >= 5

        print("Project 1 planning demo seeded.")
        print(f"Project: {project.id} {project.name}")
        print(f"Baseline: {baseline_count}, milestones: {milestone_count}, deliverables: {deliverable_count}, issues: {issue_count}")
        print("Super admin password set to: super-admin")

    except Exception as exc:
        db.rollback()
        print(f"Seed failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
