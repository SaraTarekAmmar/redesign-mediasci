"""
Operation Hub demo seed.

Small, linked, idempotent demo data for end-to-end UI testing.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.security import hash_password
from app.models.user import User, Role, user_roles_table
from app.models.team import Department, Team
from app.models.resource import Resource, Skill, ResourceSkill, ResourceAllocation
from app.models.client import Client, ClientContact, ClientRequest
from app.models.partner import Partner, PartnerMember, project_partner_members
from app.models.project import Project
from app.models.roadmap import Task
from app.models.planning import (
    ProjectPlanningBaseline,
    ProjectMilestone,
    ProjectDeliverable,
    ProjectMilestoneDependency,
)
from app.models.board import Board, BoardColumn
from app.models.workflow import WorkflowStage
from app.models.issue import Issue, IssueType, IssueStatus, IssuePriority
from app.models.sprint import Sprint, SprintMetric
from app.models.time_tracking import TimeLog
from app.models.risk import Risk
from app.models.budget import (
    Budget,
    ProjectBudget,
    Expense,
    ExpenseCategory,
    CloudService,
    SoftwareLicense,
    FinancialAlert,
)
from app.models.misc import (
    AdminTask,
    CustomField,
    IssueCustomFieldValue,
    ProjectSetting,
    ProjectPhase,
    ProjectDocument,
    ValidationRule,
    ValidationResult,
    ExecutiveSnapshot,
    UserWorkload,
    Event,
)


def dec(value):
    return Decimal(str(value))


def upsert(db: Session, model, filters: dict, values: dict):
    obj = db.query(model).filter_by(**filters).first()
    if obj is None:
        obj = model(**filters, **values)
        db.add(obj)
    else:
        for key, val in values.items():
            setattr(obj, key, val)
    db.flush()
    return obj


def ensure_link(collection, item):
    if item not in collection:
        collection.append(item)


def ensure_role_assignment(db: Session, user: User, role: Role):
    exists = db.execute(
        select(user_roles_table.c.role_id).where(
            user_roles_table.c.role_id == role.id,
            user_roles_table.c.model_type == "App\\Models\\User",
            user_roles_table.c.model_id == user.id,
        )
    ).first()
    if not exists:
        db.execute(
            user_roles_table.insert().values(
                role_id=role.id,
                model_type="App\\Models\\User",
                model_id=user.id,
            )
        )


def seed_demo_data():
    db: Session = SessionLocal()
    try:
        today = date.today()
        now = datetime.now(timezone.utc)

        roles = {
            slug: upsert(db, Role, {"name": slug}, {"guard_name": "web"})
            for slug in ["super-admin", "admin", "project-manager", "team-leader", "developer", "viewer", "partner", "client"]
        }

        departments = {
            "Engineering": upsert(db, Department, {"name": "Engineering"}, {"description": "Product engineering, APIs, and infrastructure", "color": "#111827"}),
            "Design": upsert(db, Department, {"name": "Design"}, {"description": "UX, product design, and prototyping", "color": "#ec4899"}),
            "Operations": upsert(db, Department, {"name": "Operations"}, {"description": "Delivery management, QA, and support", "color": "#f59e0b"}),
        }

        teams = {
            "Backend Team": upsert(db, Team, {"name": "Backend Team"}, {"department_id": departments["Engineering"].id, "description": "FastAPI, Python, SQL, and integrations", "color": "#111827", "is_active": True}),
            "Frontend Team": upsert(db, Team, {"name": "Frontend Team"}, {"department_id": departments["Design"].id, "description": "React, TypeScript, and UI delivery", "color": "#ec4899", "is_active": True}),
            "QA Team": upsert(db, Team, {"name": "QA Team"}, {"department_id": departments["Operations"].id, "description": "Test planning, automation, and release support", "color": "#10b981", "is_active": True}),
        }

        skills = {
            name: upsert(db, Skill, {"name": name}, {"category": category})
            for name, category in [
                ("Python", "Backend"),
                ("FastAPI", "Backend"),
                ("React", "Frontend"),
                ("TypeScript", "Frontend"),
                ("SQL", "Data"),
                ("Docker", "DevOps"),
                ("UI Design", "Design"),
                ("Testing", "Quality"),
            ]
        }

        hashed_pwd = hash_password("password123")
        users_seed = [
            ("superadmin@taskflow.dev", "System Admin", "super-admin", departments["Operations"], teams["QA Team"], "Platform Admin", 120, 40, ["Python", "SQL"]),
            ("sarah.pm@operationhub.com", "Sarah Jenkins", "project-manager", departments["Operations"], teams["QA Team"], "Senior Project Manager", 95, 40, ["Testing", "SQL"]),
            ("alex.be@operationhub.com", "Alex Rivera", "team-leader", departments["Engineering"], teams["Backend Team"], "Lead Backend Engineer", 110, 40, ["Python", "FastAPI", "SQL"]),
            ("elena.fe@operationhub.com", "Elena Rostova", "team-leader", departments["Design"], teams["Frontend Team"], "Lead Frontend Engineer", 105, 40, ["React", "TypeScript", "UI Design"]),
            ("marcus.be@operationhub.com", "Marcus Chen", "developer", departments["Engineering"], teams["Backend Team"], "Senior Python Developer", 85, 40, ["Python", "FastAPI"]),
            ("lisa.fe@operationhub.com", "Lisa Vance", "developer", departments["Design"], teams["Frontend Team"], "Frontend UI Developer", 80, 40, ["React", "TypeScript"]),
            ("david.qa@operationhub.com", "David Miller", "developer", departments["Operations"], teams["QA Team"], "QA Automation Engineer", 75, 40, ["Testing", "Python"]),
            ("nora.des@operationhub.com", "Nora Al-Mansoor", "developer", departments["Design"], teams["Frontend Team"], "UI/UX Designer", 90, 40, ["UI Design", "React"]),
        ]

        users = {}
        resources = {}
        for email, name, role_slug, dept, team, title, hourly_cost, weekly_capacity, skill_names in users_seed:
            user = upsert(
                db,
                User,
                {"email": email},
                {
                    "name": name,
                    "password": hashed_pwd,
                    "role_id": roles[role_slug].id,
                    "department_id": dept.id,
                    "job_title": title,
                    "capacity": int(weekly_capacity),
                    "availability": "Available",
                    "hourly_cost": dec(hourly_cost),
                    "is_active": True,
                },
            )
            ensure_role_assignment(db, user, roles[role_slug])
            ensure_link(user.teams, team)
            users[email] = user

            resource = upsert(
                db,
                Resource,
                {"user_id": user.id},
                {
                    "name": name,
                    "email": email,
                    "department_id": dept.id,
                    "role": role_slug.replace("-", " ").title(),
                    "position": title,
                    "seniority": "Senior" if ("Lead" in title or "Senior" in title) else "Mid",
                    "salary": dec(hourly_cost) * dec(160),
                    "cost_per_hour": dec(hourly_cost),
                    "weekly_capacity": dec(weekly_capacity),
                    "daily_capacity_hours": dec(8),
                    "availability_status": "available",
                    "availability_pct": 100,
                    "contract_type": "full_time",
                    "experience_years": 8 if "Lead" in title else 4,
                    "is_active": 1,
                },
            )
            ensure_link(resource.teams, team)
            resources[email] = resource

            for skill_name in skill_names:
                skill = skills[skill_name]
                ensure_link(user.skills, skill)
                existing = db.query(ResourceSkill).filter_by(resource_id=resource.id, skill_id=skill.id).first()
                if not existing:
                    db.add(
                        ResourceSkill(
                            resource_id=resource.id,
                            skill_id=skill.id,
                            proficiency="expert" if skill_name in {"Python", "React", "UI Design"} else "advanced",
                            years_of_experience=5 if skill_name in {"Python", "React", "UI Design"} else 3,
                            verified=True,
                        )
                    )

        client_rows = [
            ("ABC Bank", "ABC Financial Group", "finance@abcbank.com", "+1-555-0192", "Financial services and digital banking"),
            ("MedCare", "MedCare Health Systems", "hello@medcare.org", "+1-555-0144", "Healthcare operations and patient management"),
            ("RetailX", "RetailX Global Commerce", "info@retailx.com", "+1-555-0188", "Retail, inventory, and ERP modernization"),
        ]

        clients = {}
        client_requests = {}
        for idx, (name, company, email, phone, notes) in enumerate(client_rows, start=1):
            client = upsert(
                db,
                Client,
                {"name": name},
                {
                    "company": company,
                    "industry": "Technology",
                    "website": f"https://{name.lower().replace(' ', '')}.example.com",
                    "email": email,
                    "phone": phone,
                    "notes": notes,
                    "status": "active",
                },
            )
            clients[name] = client
            contact = upsert(
                db,
                ClientContact,
                {"client_id": client.id, "email": f"contact{idx}@{name.lower().replace(' ', '')}.example.com"},
                {
                    "name": f"{company.split()[0]} Contact",
                    "phone": phone,
                    "role": "Primary Contact",
                    "is_primary": 1,
                },
            )
            _ = contact
            req = upsert(
                db,
                ClientRequest,
                {"client_id": client.id, "title": f"{name} platform delivery request"},
                {
                    "user_id": users["sarah.pm@operationhub.com"].id,
                    "description": f"Request to deliver the {company} engagement.",
                    "type": "implementation",
                    "status": "approved",
                    "priority": "high",
                    "estimated_hours": dec(1200 if name == "ABC Bank" else 900 if name == "MedCare" else 650),
                    "estimated_cost": dec(450000 if name == "ABC Bank" else 320000 if name == "MedCare" else 180000),
                    "due_date": today + timedelta(days=90),
                    "attachments": [],
                },
            )
            client_requests[name] = req

        project_specs = [
            {
                "name": "Digital Banking Platform",
                "key": "DBP",
                "client": "ABC Bank",
                "team": "Backend Team",
                "classification": "delivery",
                "category": "banking",
                "status": "in_progress",
                "budget": dec(450000),
                "spent": dec(398500),
                "start": today - timedelta(days=75),
                "end": today + timedelta(days=135),
                "planned_duration": 180,
                "planned_hours": 1680,
                "planned_resources": 6,
                "issues": [
                    ("Core Banking Integration Adapter", "Connect the new portal to the legacy banking core.", "Story", "High", "Done", 13, 48, "alex.be@operationhub.com", 1, 1, 1),
                    ("OAuth2 + MFA Authentication", "Harden sign-in, password reset, and second-factor flows.", "Task", "High", "In Progress", 8, 30, "marcus.be@operationhub.com", 1, 2, 1),
                    ("Customer Onboarding Workflow", "Build the onboarding wizard and completion checks.", "Story", "Medium", "In Review", 5, 24, "elena.fe@operationhub.com", 2, 2, 1),
                    ("Executive Plan vs Actual Dashboard", "Show schedule variance, forecast finish, and burn down.", "Task", "Medium", "Backlog", 8, 28, "lisa.fe@operationhub.com", 2, 1, 2),
                    ("Release Regression Test Suite", "Automate critical path regression and smoke checks.", "Spike", "Low", "In Progress", 3, 18, "david.qa@operationhub.com", 4, 2, 2),
                ],
                "risk": ("Legacy Core Integration Delays", "The banking core exposes limited test windows.", 3, 4, "active"),
                "project_team": "Backend Team",
                "budget_split": (dec(410000), dec(395000)),
                "phase_color": "#2563EB",
            },
            {
                "name": "Hospital Management System",
                "key": "HMS",
                "client": "MedCare",
                "team": "Frontend Team",
                "classification": "implementation",
                "category": "healthcare",
                "status": "at_risk",
                "budget": dec(320000),
                "spent": dec(301250),
                "start": today - timedelta(days=45),
                "end": today + timedelta(days=120),
                "planned_duration": 140,
                "planned_hours": 1220,
                "planned_resources": 5,
                "issues": [
                    ("Patient Intake Workflow", "Create intake forms, triage, and queueing for admissions.", "Story", "High", "Done", 8, 32, "elena.fe@operationhub.com", 1, 1, 1),
                    ("Doctor Scheduling API", "Expose availability, booking, and slot conflict handling.", "Task", "High", "In Progress", 13, 45, "alex.be@operationhub.com", 3, 1, 1),
                    ("Billing and Claims Export", "Map encounters to billing batches and exports.", "Bug", "Medium", "In Review", 5, 22, "marcus.be@operationhub.com", 3, 2, 1),
                    ("Lab Results Dashboard", "Display completed tests, pending samples, and alerts.", "Story", "Medium", "Backlog", 8, 28, "lisa.fe@operationhub.com", 2, 1, 2),
                    ("UAT Scenario Pack", "Prepare test cases, evidence, and release sign-off.", "Spike", "Low", "In Progress", 3, 16, "david.qa@operationhub.com", 4, 2, 2),
                ],
                "risk": ("Clinical Review Delays", "Healthcare stakeholders require extra compliance review.", 2, 4, "identified"),
                "project_team": "Frontend Team",
                "budget_split": (dec(305000), dec(296000)),
                "phase_color": "#14B8A6",
            },
            {
                "name": "Retail ERP",
                "key": "RERP",
                "client": "RetailX",
                "team": "QA Team",
                "classification": "presale",
                "category": "retail",
                "status": "planning",
                "budget": dec(180000),
                "spent": dec(196400),
                "start": today - timedelta(days=15),
                "end": today + timedelta(days=95),
                "planned_duration": 90,
                "planned_hours": 640,
                "planned_resources": 4,
                "issues": [
                    ("Inventory Sync Service", "Sync warehouse, POS, and catalog updates across channels.", "Story", "High", "Done", 8, 28, "alex.be@operationhub.com", 1, 1, 1),
                    ("Purchase Order Approvals", "Route orders through procurement and finance approvals.", "Task", "High", "In Progress", 5, 20, "marcus.be@operationhub.com", 1, 2, 1),
                    ("Invoice Export and Reconciliation", "Generate clean invoice exports for finance teams.", "Bug", "Medium", "In Review", 5, 18, "elena.fe@operationhub.com", 3, 2, 1),
                    ("Retail Executive Dashboard", "Show stock, revenue, and delivery KPIs.", "Story", "Medium", "Backlog", 8, 24, "lisa.fe@operationhub.com", 2, 1, 2),
                    ("Load and Security Smoke Tests", "Validate peak traffic and security guardrails.", "Spike", "Low", "In Progress", 3, 16, "david.qa@operationhub.com", 4, 2, 2),
                ],
                "risk": ("Parallel Rollout Resource Bottleneck", "The retail rollout competes with other delivery work.", 3, 3, "active"),
                "project_team": "QA Team",
                "budget_split": (dec(190000), dec(201000)),
                "phase_color": "#F59E0B",
            },
        ]

        milestone_defs = [
            ("Requirements & Architecture", "Scope, architecture, and approvals", -45, -25, "completed", 1),
            ("UI/UX Design & Prototype", "Design system and prototypes", -24, -5, "in_progress", 2),
            ("Core Development & APIs", "Implementation and integrations", -4, 45, "in_progress", 3),
            ("QA Testing & UAT Launch", "Verification and release readiness", 46, 80, "pending", 4),
        ]
        deliverables_by_phase = {
            1: [("BRD & Specs", "Business requirements and scope"), ("Architecture Blueprint", "System design and data model")],
            2: [("Wireframes", "User journeys and screen maps"), ("UI Prototype", "Clickable design prototype")],
            3: [("Backend APIs", "Core services and endpoints"), ("Frontend Screens", "Primary UI flows and dashboards")],
            4: [("Test Report", "Automation and UAT results"), ("Deployment Package", "Release artifacts and rollout guide")],
        }

        issue_types = {
            name: upsert(db, IssueType, {"name": name}, {"icon": name.lower(), "color": color, "is_subtask": 0})
            for name, color in [("Story", "#2563EB"), ("Task", "#14B8A6"), ("Bug", "#F97316"), ("Spike", "#A855F7")]
        }
        issue_priorities = {
            name: upsert(db, IssuePriority, {"name": name}, {"level": level, "icon": name.lower(), "color": color})
            for name, level, color in [("Critical", 4, "#DC2626"), ("High", 3, "#EF4444"), ("Medium", 2, "#F59E0B"), ("Low", 1, "#22C55E")]
        }

        all_projects = {}
        project_users = {}
        project_issues = {}
        project_sprints = {}
        project_boards = {}
        project_milestones = {}

        for spec in project_specs:
            client = clients[spec["client"]]
            project = upsert(
                db,
                Project,
                {"key": spec["key"]},
                {
                    "name": spec["name"],
                    "company_name": client.company,
                    "description": f"Enterprise delivery for {spec['client']}.",
                    "classification": spec["classification"],
                    "category": spec["category"],
                    "status": spec["status"],
                    "type": "software",
                    "color": spec["phase_color"],
                    "owner_id": users["sarah.pm@operationhub.com"].id,
                    "team_id": teams[spec["team"]].id,
                    "start_date": spec["start"],
                    "end_date": spec["end"],
                    "client_id": client.id,
                    "client_request_id": client_requests[spec["client"]].id,
                    "settings": {
                        "planned_finish": spec["end"].isoformat(),
                        "planned_budget": float(spec["budget"]),
                        "critical_path": ["Requirements", "Design", "Development", "Testing"],
                    },
                    "notes": f"Demo delivery for {spec['name']}",
                },
            )
            all_projects[spec["key"]] = project

            ensure_link(project.members, users["sarah.pm@operationhub.com"])
            for email in ["superadmin@taskflow.dev", "alex.be@operationhub.com", "elena.fe@operationhub.com", "marcus.be@operationhub.com", "lisa.fe@operationhub.com", "david.qa@operationhub.com", "nora.des@operationhub.com"]:
                ensure_link(project.members, users[email])
            project_users[spec["key"]] = [users[email] for email in [
                "sarah.pm@operationhub.com",
                "alex.be@operationhub.com",
                "elena.fe@operationhub.com",
                "marcus.be@operationhub.com",
                "lisa.fe@operationhub.com",
                "david.qa@operationhub.com",
                "nora.des@operationhub.com",
            ]]

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
                    "budget_baseline": spec["budget"],
                    "risk_threshold": "medium",
                },
            )

            upsert(
                db,
                ProjectPlanningBaseline,
                {"project_id": project.id},
                {
                    "planned_duration_days": spec["planned_duration"],
                    "planned_budget": spec["budget"],
                    "planned_hours": spec["planned_hours"],
                    "planned_resources_count": spec["planned_resources"],
                },
            )

            phases = [
                ("Initiation", "Project intake and approval", spec["start"], spec["start"] + timedelta(days=10), "completed", 25),
                ("Discovery", "Requirements and architecture", spec["start"] + timedelta(days=11), spec["start"] + timedelta(days=30), "completed", 100),
                ("Build", "Implementation and integration", spec["start"] + timedelta(days=31), spec["end"] - timedelta(days=30), "in_progress", 60),
                ("Release", "Testing and rollout", spec["end"] - timedelta(days=29), spec["end"], "pending", 20),
            ]
            for order, (phase_name, desc, start_d, end_d, status, progress) in enumerate(phases, start=1):
                upsert(
                    db,
                    ProjectPhase,
                    {"project_id": project.id, "name": phase_name},
                    {
                        "description": desc,
                        "start_date": start_d,
                        "end_date": end_d,
                        "status": status,
                        "position": order,
                        "color": spec["phase_color"],
                        "progress": progress,
                        "deliverables": [phase_name, spec["name"]],
                    },
                )

            milestones = []
            for phase_index, (m_name, m_desc, start_off, end_off, m_status, sort_order) in enumerate(milestone_defs, start=1):
                milestone = upsert(
                    db,
                    ProjectMilestone,
                    {"project_id": project.id, "name": m_name},
                    {
                        "description": m_desc,
                        "planned_start_date": spec["start"] + timedelta(days=start_off),
                        "planned_end_date": spec["start"] + timedelta(days=end_off),
                        "actual_start_date": None if m_status == "pending" else spec["start"] + timedelta(days=start_off),
                        "actual_end_date": spec["start"] + timedelta(days=end_off) if m_status == "completed" else None,
                        "planned_hours": dec(300),
                        "planned_budget": dec(75000 if phase_index < 4 else 60000),
                        "planned_progress": 100 if m_status == "completed" else 55 if m_status == "in_progress" else 0,
                        "status": m_status,
                        "owner_resource_id": resources["sarah.pm@operationhub.com"].id if phase_index == 1 else resources["nora.des@operationhub.com"].id if phase_index == 2 else resources["alex.be@operationhub.com"].id if phase_index == 3 else resources["david.qa@operationhub.com"].id,
                        "sort_order": sort_order,
                    },
                )
                milestones.append(milestone)
                for d_idx, (d_name, d_desc) in enumerate(deliverables_by_phase[phase_index], start=1):
                    upsert(
                        db,
                        ProjectDeliverable,
                        {"milestone_id": milestone.id, "title": d_name},
                        {
                            "description": d_desc,
                            "acceptance_criteria": f"Accepted when {d_name.lower()} is approved by {spec['client']}.",
                            "planned_completion_date": spec["start"] + timedelta(days=end_off),
                            "actual_completion_date": spec["start"] + timedelta(days=end_off) if m_status == "completed" and d_idx == 1 else None,
                            "status": m_status,
                            "owner_resource_id": milestone.owner_resource_id,
                        },
                    )
            project_milestones[project.id] = milestones

            for pred, succ in zip(milestones, milestones[1:]):
                exists = db.query(ProjectMilestoneDependency).filter_by(predecessor_milestone_id=pred.id, successor_milestone_id=succ.id).first()
                if not exists:
                    db.add(ProjectMilestoneDependency(predecessor_milestone_id=pred.id, successor_milestone_id=succ.id, dependency_type="finish_to_start"))

            workflow_statuses = [
                ("Backlog", "todo", "#94A3B8", 0, True, False),
                ("In Progress", "in_progress", "#3B82F6", 1, False, False),
                ("In Review", "review", "#F59E0B", 2, False, False),
                ("Done", "done", "#10B981", 3, False, True),
            ]
            for name, category, color, position, is_initial, is_final in workflow_statuses:
                upsert(
                    db,
                    WorkflowStage,
                    {"project_id": project.id, "name": name},
                    {
                        "slug": name.lower().replace(" ", "_"),
                        "category": category,
                        "color": color,
                        "position": position,
                        "is_initial": is_initial,
                        "is_final": is_final,
                        "is_active": True,
                    },
                )

            issue_status_rows = {}
            for name, category, color, position, *_ in workflow_statuses:
                issue_status_rows[name] = upsert(
                    db,
                    IssueStatus,
                    {"project_id": project.id, "name": name},
                    {"category": category, "color": color, "position": position},
                )

            board = upsert(
                db,
                Board,
                {"project_id": project.id, "name": f"{spec['key']} Delivery Board"},
                {"type": "kanban", "filter_query": {"project_id": project.id}, "is_default": True},
            )
            project_boards[project.id] = board
            for status_name, *_ in workflow_statuses:
                status_row = issue_status_rows[status_name]
                upsert(
                    db,
                    BoardColumn,
                    {"board_id": board.id, "name": status_name},
                    {"issue_status_id": status_row.id, "position": workflow_statuses.index(next(item for item in workflow_statuses if item[0] == status_name)), "wip_limit": 8 if status_name == "In Progress" else 5 if status_name == "In Review" else None},
                )

            budget_total, budget_spent = spec["budget_split"]
            upsert(db, Budget, {"project_id": project.id, "name": "Delivery Budget"}, {"total_budget": budget_total, "spent": budget_spent, "currency": "USD", "start_date": spec["start"], "end_date": spec["end"]})
            upsert(db, ProjectBudget, {"project_id": project.id}, {"total_budget": budget_total, "spent_budget": budget_spent, "currency": "USD"})

            expense_categories = {
                "Cloud": upsert(db, ExpenseCategory, {"name": "Cloud"}, {}),
                "Licenses": upsert(db, ExpenseCategory, {"name": "Licenses"}, {}),
                "Contractors": upsert(db, ExpenseCategory, {"name": "Contractors"}, {}),
            }
            upsert(
                db,
                Expense,
                {"project_id": project.id, "name": "Cloud hosting"},
                {"category_id": expense_categories["Cloud"].id, "amount": dec(12000), "currency": "USD", "date": today - timedelta(days=20), "description": "Production and staging hosting", "vendor": "AWS", "status": "approved"},
            )
            upsert(
                db,
                Expense,
                {"project_id": project.id, "name": "Design tooling"},
                {"category_id": expense_categories["Licenses"].id, "amount": dec(8500), "currency": "USD", "date": today - timedelta(days=12), "description": "Figma, test, and collaboration licenses", "vendor": "Figma", "status": "approved"},
            )

            upsert(
                db,
                CloudService,
                {"project_id": project.id, "name": "AWS Production"},
                {"provider": "AWS", "monthly_cost": dec(2400), "annual_cost": dec(28800), "status": "active", "renewal_date": spec["end"]},
            )
            upsert(
                db,
                SoftwareLicense,
                {"project_id": project.id, "name": "Figma Enterprise"},
                {"vendor": "Figma", "license_type": "enterprise", "seats": 10, "cost": dec(7200), "renewal_date": spec["end"], "status": "active"},
            )

            upsert(
                db,
                ProjectDocument,
                {"project_id": project.id, "original_name": f"{spec['key']}_architecture.pdf"},
                {
                    "name": f"{spec['name']} Architecture",
                    "file_path": f"/docs/{spec['key'].lower()}_architecture.pdf",
                    "uploaded_by": users["sarah.pm@operationhub.com"].id,
                    "mime_type": "application/pdf",
                    "file_size": 204800,
                    "category": "specification",
                    "visibility": "project",
                },
            )
            upsert(
                db,
                ProjectDocument,
                {"project_id": project.id, "original_name": f"{spec['key']}_release_plan.pdf"},
                {
                    "name": f"{spec['name']} Release Plan",
                    "file_path": f"/docs/{spec['key'].lower()}_release_plan.pdf",
                    "uploaded_by": users["sarah.pm@operationhub.com"].id,
                    "mime_type": "application/pdf",
                    "file_size": 122880,
                    "category": "plan",
                    "visibility": "project",
                },
            )

            upsert(
                db,
                ProjectDocument,
                {"project_id": project.id, "original_name": f"{spec['key']}_msa.pdf"},
                {
                    "name": f"{spec['name']} MSA",
                    "file_path": f"/docs/{spec['key'].lower()}_msa.pdf",
                    "uploaded_by": users["sarah.pm@operationhub.com"].id,
                    "mime_type": "application/pdf",
                    "file_size": 102400,
                    "category": "contract",
                    "visibility": "project",
                },
            )

            rule = upsert(
                db,
                ValidationRule,
                {"project_id": project.id, "name": "No missing assignee"},
                {"description": "Every work item should have a resource owner.", "rule_type": "issue", "parameters": "assignee_required=1", "is_active": 1},
            )
            upsert(
                db,
                ValidationResult,
                {"project_id": project.id, "rule_id": rule.id},
                {"passed": 1, "details": {"checked_issues": 5, "missing_assignees": 0}, "verified_by": users["sarah.pm@operationhub.com"].id},
            )

            field_names = ["External Ticket", "Business Impact"]
            project_fields = []
            for pos, field_name in enumerate(field_names, start=1):
                project_fields.append(
                    upsert(
                        db,
                        CustomField,
                        {"project_id": project.id, "name": field_name},
                        {"type": "text", "options": None, "is_required": 0, "position": pos},
                    )
                )

            for issue_idx, issue_seed in enumerate(spec["issues"], start=1):
                title, desc, type_name, priority_name, status_name, points, est_hours, assignee_email, milestone_idx, deliverable_idx, sprint_idx = issue_seed
                milestone = milestones[milestone_idx - 1]
                deliverable = db.query(ProjectDeliverable).filter_by(milestone_id=milestone.id).order_by(ProjectDeliverable.id).all()[deliverable_idx - 1]
                issue = upsert(
                    db,
                    Issue,
                    {"project_id": project.id, "title": title},
                    {
                        "milestone_id": milestone.id,
                        "deliverable_id": deliverable.id,
                        "issue_type_id": issue_types[type_name].id,
                        "issue_status_id": issue_status_rows[status_name].id,
                        "issue_priority_id": issue_priorities[priority_name].id,
                        "assignee_id": users[assignee_email].id,
                        "reporter_id": users["sarah.pm@operationhub.com"].id,
                        "story_points": points,
                        "estimate_minutes": int(est_hours * 60),
                        "remaining_minutes": int(est_hours * 20),
                        "due_date": datetime.now(timezone.utc) + timedelta(days=issue_idx * 8),
                        "start_date": datetime.now(timezone.utc) - timedelta(days=issue_idx * 3),
                        "acceptance_criteria": f"{title} is complete when the client accepts the final result.",
                        "definition_of_ready": "Requirements approved and designs available.",
                        "definition_of_done": "Code, tests, and review complete.",
                        "estimated_hours": dec(est_hours),
                        "actual_hours": dec(round(est_hours * (0.7 if status_name == 'Done' else 0.5), 2)),
                        "remaining_hours": dec(round(est_hours * (0.3 if status_name != 'Done' else 0), 2)),
                        "completion_percentage": 100 if status_name == "Done" else 70 if status_name == "In Review" else 45 if status_name == "In Progress" else 0,
                        "triage_status": "triaged",
                        "triaged_by": users["sarah.pm@operationhub.com"].id,
                    },
                )

                sprint_name = f"{spec['key']} Sprint {sprint_idx}"
                sprint_status = "completed" if sprint_idx == 1 and status_name == "Done" else "active" if sprint_idx == 1 else "planning"
                sprint = upsert(
                    db,
                    Sprint,
                    {"project_id": project.id, "name": sprint_name},
                    {
                        "board_id": board.id,
                        "goal": f"Deliver the {sprint_name.lower()} scope.",
                        "notes": "Demo sprint with linked issues and metrics.",
                        "start_date": datetime.combine(spec["start"] + timedelta(days=14 * sprint_idx), datetime.min.time(), tzinfo=timezone.utc),
                        "end_date": datetime.combine(spec["start"] + timedelta(days=14 * sprint_idx + 13), datetime.min.time(), tzinfo=timezone.utc),
                        "status": sprint_status,
                        "completed_at": datetime.now(timezone.utc) if sprint_status == "completed" else None,
                        "completed_by": users["sarah.pm@operationhub.com"].id if sprint_status == "completed" else None,
                        "capacity_hours": 160 if sprint_idx == 1 else 120,
                        "velocity": 28 if sprint_idx == 1 else 22,
                        "acceptance_criteria": "Issues are linked, estimated, and tracked.",
                        "duration": 14,
                    },
                )
                ensure_link(sprint.issues, issue)
                project_issues.setdefault(project.id, []).append(issue)
                project_sprints.setdefault(project.id, []).append(sprint)

                upsert(
                    db,
                    IssueCustomFieldValue,
                    {"issue_id": issue.id, "custom_field_id": project_fields[0].id},
                    {"value": f"{spec['key']}-EXT-{issue_idx:03d}"},
                )
                upsert(
                    db,
                    IssueCustomFieldValue,
                    {"issue_id": issue.id, "custom_field_id": project_fields[1].id},
                    {"value": "High" if points >= 8 else "Medium"},
                )

                log = upsert(
                    db,
                    TimeLog,
                    {"issue_id": issue.id, "user_id": users[assignee_email].id},
                    {
                        "duration_minutes": int(est_hours * 0.8 * 60),
                        "description": f"Work completed for {title}",
                        "logged_at": now - timedelta(days=issue_idx),
                        "billable": True,
                        "rate": resources[assignee_email].cost_per_hour,
                        "approved": True,
                        "approved_by": users["sarah.pm@operationhub.com"].id,
                        "approved_at": now,
                    },
                )
                _ = log

                task = upsert(
                    db,
                    Task,
                    {"project_id": project.id, "title": title},
                    {
                        "sprint_id": sprint.id,
                        "description": desc,
                        "assigned_to": users[assignee_email].id,
                        "status": status_name.lower().replace(" ", "_"),
                        "priority": priority_name.lower(),
                        "start_date": spec["start"] + timedelta(days=issue_idx * 2),
                        "end_date": spec["start"] + timedelta(days=issue_idx * 2 + 10),
                        "duration": max(int(round(est_hours / 8)), 1),
                        "progress": 100 if status_name == "Done" else 70 if status_name == "In Review" else 45 if status_name == "In Progress" else 0,
                        "wbs_code": f"{spec['key']}-{issue_idx:02d}",
                        "is_milestone": 0,
                        "cost": dec(est_hours) * resources[assignee_email].cost_per_hour,
                        "actual_start": spec["start"] + timedelta(days=issue_idx * 2),
                        "actual_end": spec["start"] + timedelta(days=issue_idx * 2 + 8) if status_name == "Done" else None,
                    },
                )

                alloc = db.query(ResourceAllocation).filter_by(resource_id=resources[assignee_email].id, project_id=project.id, task_id=task.id).first()
                if not alloc:
                    db.add(
                        ResourceAllocation(
                            resource_id=resources[assignee_email].id,
                            project_id=project.id,
                            task_id=task.id,
                            allocation_pct=60,
                            allocated_hours=dec(est_hours),
                            start_date=spec["start"],
                            end_date=spec["end"],
                            role=resources[assignee_email].position,
                        )
                    )

                ensure_link(sprint.issues, issue)

            sprint_list = db.query(Sprint).filter_by(project_id=project.id).order_by(Sprint.id).all()
            for s_idx, sprint in enumerate(sprint_list, start=1):
                base_remaining = 90 - (s_idx * 20)
                for day_offset in range(0, 5, 2):
                    metric_date = spec["start"] + timedelta(days=14 * s_idx + day_offset)
                    exists = db.query(SprintMetric).filter_by(sprint_id=sprint.id, date=metric_date).first()
                    if not exists:
                        db.add(
                            SprintMetric(
                                sprint_id=sprint.id,
                                date=metric_date,
                                remaining_points=max(base_remaining - day_offset * 5, 0),
                                completed_points=10 + day_offset * 3,
                                added_points=2 + day_offset,
                                scope_change=1 if day_offset == 4 else 0,
                            )
                        )

            risk_title, risk_desc, prob, impact, risk_status = spec["risk"]
            upsert(
                db,
                Risk,
                {"project_id": project.id, "title": risk_title},
                {
                    "created_by": users["sarah.pm@operationhub.com"].id,
                    "owner_user_id": users["sarah.pm@operationhub.com"].id,
                    "description": risk_desc,
                    "category": "delivery",
                    "probability": prob,
                    "impact": impact,
                    "risk_score": prob * impact,
                    "severity": "High" if prob * impact >= 12 else "Medium",
                    "status": risk_status,
                    "owner": "Project Manager",
                    "response_plan": "Escalate early and re-sequence dependent work.",
                    "contingency_plan": "Shift capacity from lower priority tasks.",
                    "due_date": spec["end"] - timedelta(days=14),
                },
            )

            upsert(
                db,
                FinancialAlert,
                {"project_id": project.id, "type": "budget_variance"},
                {"message": f"{spec['name']} is running with visible budget variance.", "severity": "medium" if spec["spent"] <= spec["budget"] else "high", "acknowledged": 0},
            )

            upsert(
                db,
                Event,
                {"project_id": project.id, "title": f"{spec['key']} sprint planning"},
                {
                    "description": f"{spec['name']} sprint planning session.",
                    "start": datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc),
                    "end": datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=2),
                    "all_day": 0,
                    "color": spec["phase_color"],
                    "user_id": users["sarah.pm@operationhub.com"].id,
                    "type": "meeting",
                    "location": "Operations Room",
                },
            )

            project_users[project.id] = [users[email] for email in users]

        for project in all_projects.values():
            db.query(Project).filter_by(id=project.id).update({"status": project.status}, synchronize_session=False)

        for email, user in users.items():
            week_start = today - timedelta(days=today.weekday())
            assigned_minutes = sum((tl.duration_minutes or 0) for tl in db.query(TimeLog).filter_by(user_id=user.id).all())
            allocated_hours = round(assigned_minutes / 60, 1)
            upsert(
                db,
                UserWorkload,
                {"user_id": user.id, "week_start": week_start},
                {"allocated_hours": dec(max(allocated_hours, 16)), "actual_hours": dec(round(allocated_hours * 0.85, 1))},
            )

        snapshot_payload = {
            "projects": {
                spec["key"]: {
                    "status": spec["status"],
                    "planned_budget": float(spec["budget"]),
                    "actual_budget": float(spec["spent"]),
                }
                for spec in project_specs
            },
            "summary": {
                "schedule_variance": -6,
                "budget_variance": 11,
                "resource_utilization": 78,
                "critical_path": ["Requirements", "Design", "Development", "Testing"],
            },
        }
        upsert(
            db,
            ExecutiveSnapshot,
            {"user_id": users["superadmin@taskflow.dev"].id, "period": "current"},
            {"data": snapshot_payload},
        )

        upsert(
            db,
            AdminTask,
            {"title": "Review demo dashboard health"},
            {"description": "Check plan vs actual cards after seed refresh.", "category": "reporting", "priority": "high", "status": "open", "assigned_to": users["sarah.pm@operationhub.com"].id, "due_date": today + timedelta(days=2), "created_by": users["superadmin@taskflow.dev"].id},
        )
        upsert(
            db,
            AdminTask,
            {"title": "Review delivery health signals"},
            {"description": "Check project health and reporting alerts after the latest refresh.", "category": "reporting", "priority": "medium", "status": "open", "assigned_to": users["superadmin@taskflow.dev"].id, "due_date": today + timedelta(days=3), "created_by": users["superadmin@taskflow.dev"].id},
        )

        # ── Demo partner login: external org assigned to DBP, can receive/reassign tasks ──
        partner_user = upsert(
            db,
            User,
            {"email": "jordan@nimbusconsulting.example.com"},
            {
                "name": "Jordan Blake",
                "password": hashed_pwd,
                "role_id": roles["partner"].id,
                "is_active": True,
            },
        )
        ensure_role_assignment(db, partner_user, roles["partner"])

        partner_org = upsert(
            db,
            Partner,
            {"name": "Nimbus Consulting"},
            {
                "company": "Nimbus Consulting LLC",
                "specialty": "QA & Regression Testing",
                "email": "hello@nimbusconsulting.example.com",
                "status": "active",
                "notes": "External QA partner engaged for release regression coverage.",
            },
        )
        partner_member = upsert(
            db,
            PartnerMember,
            {"partner_id": partner_org.id, "email": "jordan@nimbusconsulting.example.com"},
            {"user_id": partner_user.id, "name": "Jordan Blake", "role": "QA Lead", "is_active": 1},
        )
        dbp_project = all_projects.get("DBP")
        if dbp_project is not None:
            ensure_link(partner_org.projects, dbp_project)
            member_link_exists = db.execute(
                select(project_partner_members.c.id).where(
                    project_partner_members.c.project_id == dbp_project.id,
                    project_partner_members.c.partner_member_id == partner_member.id,
                )
            ).first()
            if not member_link_exists:
                db.execute(
                    project_partner_members.insert().values(
                        project_id=dbp_project.id, partner_member_id=partner_member.id
                    )
                )
            # Hand them a real task so "we give partners tasks, they can reassign to us" is live.
            regression_issue = (
                db.query(Issue)
                .filter(Issue.project_id == dbp_project.id, Issue.title.ilike("%Regression%"))
                .first()
            )
            if regression_issue is not None:
                regression_issue.external_assignee_id = partner_member.id
                regression_issue.assignee_id = None

        # ── Demo client login: sees DBP end-to-end, no visibility into our internal team ──
        client_user = upsert(
            db,
            User,
            {"email": "contact@abcbank.example.com"},
            {
                "name": "Morgan Lee",
                "password": hashed_pwd,
                "role_id": roles["client"].id,
                "is_active": True,
            },
        )
        ensure_role_assignment(db, client_user, roles["client"])
        abc_bank = clients.get("ABC Bank")
        if abc_bank is not None:
            upsert(
                db,
                ClientContact,
                {"client_id": abc_bank.id, "email": "contact@abcbank.example.com"},
                {"name": "Morgan Lee", "role": "Client Sponsor", "is_primary": 0, "user_id": client_user.id},
            )

        db.commit()
        print("Operation Hub demo seed applied.")
        print(f"Users: {db.query(User).count()}")
        print(f"Resources: {db.query(Resource).count()}")
        print(f"Clients: {db.query(Client).count()}")
        print(f"Projects: {db.query(Project).count()}")
        print(f"Milestones: {db.query(ProjectMilestone).count()}")
        print(f"Deliverables: {db.query(ProjectDeliverable).count()}")
        print(f"Sprints: {db.query(Sprint).count()}")
        print(f"Issues: {db.query(Issue).count()}")
        print(f"Time logs: {db.query(TimeLog).count()}")
        print(f"Risks: {db.query(Risk).count()}")

    except Exception as exc:
        db.rollback()
        print("Error seeding demo data:", exc)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
