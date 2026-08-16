"""
seed_dummy_data.py  --  Insert realistic fake data into every Operation Hub table.

Usage (from backend/):
    python scripts/seed_dummy_data.py
    python scripts/seed_dummy_data.py --clear   # wipe first
"""
import sys, os, argparse, uuid
from datetime import datetime, date, timedelta
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, Base
import app.models  # noqa

try:
    from passlib.context import CryptContext
    _pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    def hash_pw(p): return _pwd.hash(p)
except ImportError:
    import hashlib
    def hash_pw(p): return hashlib.sha256(p.encode()).hexdigest()

def d(n=0): return date.today() + timedelta(days=n)
def dt(n=0): return datetime.utcnow() + timedelta(days=n)
NOW = datetime.utcnow()

from app.models.user import (Permission, Role, User,
    role_has_permissions, user_roles_table,
    team_user, project_members, skill_user)
from app.models.team import Team, Department, department_team
from app.models.client import Client, ClientContact, ClientRequest, Proposal, ProposalVersion, Rfp
from app.models.project import Project, project_teams, milestone_projects, stakeholder_project
from app.models.issue import (IssueType, IssueStatus, IssuePriority, IssueLabel, Issue,
    IssueHistory, IssueLink, TaskDependency,
    sprint_issues, issue_label, issue_watchers, task_assignees)
from app.models.board import Board, BoardColumn
from app.models.epic import Epic, Story
from app.models.sprint import Sprint, SprintMetric
from app.models.comment import IssueComment, CommentReaction, Mention
from app.models.attachment import IssueAttachment, Attachment, AttachmentVersion
from app.models.time_tracking import TimeLog, TimeEntry
from app.models.risk import Risk, Resource, ResourceAllocation, ResourceAvailability
from app.models.roadmap import (Plan, PlanTask, PlanTaskComment, PlanTaskAttachment,
    PlanTaskBaseline, PlanTaskResource, PlanTaskDependency,
    Milestone, Roadmap, Task)
from app.models.stakeholder import (Stakeholder, StakeholderEngagement, StakeholderImpact,
    StakeholderInteraction, StakeholderMessage)
from app.models.scope import Scope, ScopeObjective, ScopeDeliverable, ScopeDocument, ScopeVersion, ScopeComment
from app.models.change_request import ChangeRequest, ChangeRequestFile
from app.models.budget import (Budget, ProjectBudget, Expense, ExpenseCategory,
    CloudService, SoftwareLicense, FinancialAlert, FinancialDocument)
from app.models.workflow import (Workflow, WorkflowStatus, WorkflowTransition,
    WorkflowCondition, WorkflowPostAction, WorkflowTemplate, WorkflowStep)
from app.models.automation import AutomationRule, AutomationTrigger, AutomationAction, AutomationLog
from app.models.notification import Notification, DatabaseNotification
from app.models.achievement import Achievement, AchievementComment
from app.models.misc import (AdminTask, CustomField, IssueCustomFieldValue, ProjectSetting,
    ProjectPhase, ProjectDocument, DocumentVersion, ActivityLog, AuditLog, Skill,
    Event, AiRecommendation, ValidationRule, ValidationResult,
    ExecutiveSnapshot, UserWorkload)
from app.models.chat import Chat, Message, MessageRead, ChatbotMessage
from app.models.integration import (SlackIntegration, CalendarIntegration, FigmaIntegration,
    GithubIntegration, GithubLink, JiraImport)


def get_or_create(db, model, defaults=None, **kwargs):
    """Fetch existing or create new; returns (instance, created_bool)."""
    instance = db.query(model).filter_by(**kwargs).first()
    if instance:
        return instance, False
    params = dict(kwargs)
    if defaults:
        params.update(defaults)
    instance = model(**params)
    db.add(instance)
    db.flush()
    return instance, True


def clear_all(db):
    print("  WARNING: Clearing all rows ...")
    for tbl in reversed(Base.metadata.sorted_tables):
        db.execute(tbl.delete())
    db.commit()
    print("  Done clearing.")


def seed(db):
    # ── Permissions & Roles ──────────────────────────────────────────────────
    print("-> permissions & roles")
    perm_names = [
        "view_projects", "manage_projects",
        "view-clients", "manage-clients",
        "view_issues", "manage_issues",
        "view_users", "manage_users",
        "view-users", "manage-users",
        "view-departments", "manage-departments",
        "view-teams", "manage-teams",
        "view-resources", "allocate-resources",
        "manage-project-members", "manage-skills",
        "view_reports", "manage_settings"
    ]
    perms = []
    for name in perm_names:
        p, _ = get_or_create(db, Permission, name=name,
                             defaults={"guard_name": "web", "created_at": NOW, "updated_at": NOW})
        perms.append(p)

    roles = {}
    for rname in ["admin", "manager", "developer", "viewer"]:
        r, _ = get_or_create(db, Role, name=rname,
                             defaults={"guard_name": "web", "created_at": NOW, "updated_at": NOW})
        roles[rname] = r
    # Link permissions to roles
    roles["admin"].permissions     = perms
    roles["manager"].permissions   = [
        p for p in perms
        if p.name.startswith("view-")
        or p.name in {
            "manage_projects",
            "manage_issues",
            "manage-clients",
            "manage-users",
            "manage-departments",
            "manage-teams",
            "allocate-resources",
            "manage-project-members",
            "manage-skills",
        }
    ]
    roles["developer"].permissions = [p for p in perms if p.name.startswith("view-") or p.name == "manage_issues"]
    roles["viewer"].permissions    = [p for p in perms if p.name.startswith("view-")]
    db.flush()

    # ── Departments ──────────────────────────────────────────────────────────
    print("-> departments")
    departments = []
    for dname, dcolor in [("Engineering","#4F46E5"),("Product","#7C3AED"),
                           ("Design","#EC4899"),("QA","#10B981"),("Management","#F59E0B")]:
        dept, _ = get_or_create(db, Department, name=dname,
                                defaults={"description": f"{dname} dept",
                                          "color": dcolor, "is_active": True,
                                          "created_at": NOW, "updated_at": NOW})
        departments.append(dept)
    db.flush()

    # ── Users ────────────────────────────────────────────────────────────────
    print("-> users")
    users_raw = [
        ("Alice Johnson",  "alice@mediasci.com",  "admin",     departments[4], "CTO"),
        ("Bob Smith",      "bob@mediasci.com",    "manager",   departments[0], "Engineering Manager"),
        ("Carol White",    "carol@mediasci.com",  "developer", departments[0], "Senior Developer"),
        ("Dave Brown",     "dave@mediasci.com",   "developer", departments[0], "Backend Developer"),
        ("Eve Davis",      "eve@mediasci.com",    "developer", departments[0], "Frontend Developer"),
        ("Frank Wilson",   "frank@mediasci.com",  "manager",   departments[1], "Product Manager"),
        ("Grace Lee",      "grace@mediasci.com",  "developer", departments[2], "UI/UX Designer"),
        ("Henry Martinez", "henry@mediasci.com",  "developer", departments[3], "QA Engineer"),
        ("Iris Taylor",    "iris@mediasci.com",   "viewer",    departments[4], "COO"),
        ("Jack Anderson",  "jack@mediasci.com",   "developer", departments[0], "Full-Stack Developer"),
    ]
    users = []
    for idx, (name, email, role_name, dept, title) in enumerate(users_raw):
        u, created = get_or_create(db, User, email=email,
                                   defaults=dict(
                                       name=name, password=hash_pw("password123"),
                                       email_verified_at=NOW,
                                       bio=f"Professional in {dept.name}.",
                                       phone=f"+1-555-{100+idx:04d}", timezone="UTC",
                                       job_title=title, dark_mode=(idx % 2 == 0),
                                       notification_preferences={"email": True, "push": True},
                                       last_active_at=dt(-idx),
                                       department_id=dept.id, is_active=True,
                                       created_at=dt(-30), updated_at=NOW))
        users.append(u)
    db.flush()

    departments[0].team_leader_id = users[1].id
    departments[1].team_leader_id = users[5].id
    departments[2].team_leader_id = users[6].id
    departments[3].team_leader_id = users[7].id
    departments[4].team_leader_id = users[0].id

    from sqlalchemy import text
    for idx, (_, _, role_name, _, _) in enumerate(users_raw):
        # Only insert role assignment if not already present
        existing = db.execute(
            user_roles_table.select().where(
                (user_roles_table.c.model_id == users[idx].id) &
                (user_roles_table.c.model_type == "App\\Models\\User")
            )
        ).fetchone()
        if not existing:
            db.execute(user_roles_table.insert().values(
                role_id=roles[role_name].id,
                model_type="App\\Models\\User",
                model_id=users[idx].id))
    db.flush()

    # ── Skills ───────────────────────────────────────────────────────────────
    print("-> skills")
    skills = []
    for sname, scat in [("Python","Backend"),("TypeScript","Frontend"),("React","Frontend"),
                         ("FastAPI","Backend"),("Docker","DevOps"),("AWS","DevOps"),
                         ("SQL","Database"),("GraphQL","Backend"),("Figma","Design"),("Agile","Management")]:
        s, _ = get_or_create(db, Skill, name=sname,
                             defaults={"category": scat, "created_at": NOW, "updated_at": NOW})
        skills.append(s)
    db.flush()

    for i, user in enumerate(users):
        for sk in skills[i % 3:(i % 3) + 3]:
            exists = db.execute(
                skill_user.select().where(
                    (skill_user.c.skill_id == sk.id) & (skill_user.c.user_id == user.id)
                )).fetchone()
            if not exists:
                db.execute(skill_user.insert().values(
                    skill_id=sk.id, user_id=user.id,
                    proficiency=["beginner","intermediate","expert"][i % 3],
                    created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Teams ────────────────────────────────────────────────────────────────
    print("-> teams")
    teams = []
    for tname, tcolor, owner in [("Alpha Squad","#4F46E5",users[1]),
                                   ("Beta Team","#10B981",users[5]),
                                   ("Gamma Force","#F59E0B",users[6])]:
        t, _ = get_or_create(db, Team, slug=tname.lower().replace(" ","-"),
                             defaults={"name": tname,
                                       "description": f"High-performance {tname}",
                                       "color": tcolor, "owner_id": owner.id, "is_active": True,
                                       "created_at": NOW, "updated_at": NOW})
        teams.append(t)
    db.flush()

    for i, user in enumerate(users):
        exists = db.execute(
            team_user.select().where(
                (team_user.c.team_id == teams[i % 3].id) & (team_user.c.user_id == user.id)
            )).fetchone()
        if not exists:
            db.execute(team_user.insert().values(
                team_id=teams[i % 3].id, user_id=user.id,
                role=["lead","member","member"][i % 3],
                created_at=NOW, updated_at=NOW))
    for i, team in enumerate(teams):
        exists = db.execute(
            department_team.select().where(
                (department_team.c.department_id == departments[i].id) & (department_team.c.team_id == team.id)
            )).fetchone()
        if not exists:
            db.execute(department_team.insert().values(
                department_id=departments[i].id, team_id=team.id,
                created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Clients ───────────────────────────────────────────────────────────────
    print("-> clients")
    clients = []
    for cname, cind, cweb in [("TechCorp Inc.","Technology","techcorp.com"),
                                ("MediaSci Ltd.","Media","mediasci.com"),
                                ("HealthPlus","Healthcare","healthplus.io")]:
        c, _ = get_or_create(db, Client, company=cname,
                             defaults={"name": cname, "industry": cind,
                                       "website": f"https://{cweb}",
                                       "email": f"hello@{cweb}",
                                       "phone": "+1-800-000-0000",
                                       "address": "123 Business Ave, New York, NY 10001",
                                       "status": "active",
                                       "notes": f"Key client in {cind}.",
                                       "created_at": NOW, "updated_at": NOW})
        clients.append(c)
    db.flush()

    for c in clients:
        exists = db.query(ClientContact).filter_by(client_id=c.id).first()
        if not exists:
            db.add(ClientContact(client_id=c.id, name=f"{c.name} Contact",
                                 email=f"contact@corp.com", phone="+1-555-9999",
                                 role="Account Manager", is_primary=1,
                                 created_at=NOW, updated_at=NOW))
    db.flush()

    client_requests = []
    for c in clients:
        cr = ClientRequest(client_id=c.id, user_id=users[0].id,
                           title=f"Feature request from {c.name}",
                           description="We need a new dashboard feature.",
                           type="feature", status="pending", priority="high",
                           estimated_hours=Decimal("40.00"),
                           estimated_cost=Decimal("5000.00"),
                           due_date=d(30), created_at=NOW, updated_at=NOW)
        db.add(cr); client_requests.append(cr)
    db.flush()

    rfps = []
    for c in clients:
        rfp = Rfp(title=f"RFP from {c.name} Q3",
                  content="Requirements for the project.",
                  client_id=c.id, status="open",
                  deadline=dt(45), budget_range="$50k-$100k",
                  requirements="REST API, mobile-responsive UI.",
                  created_by=users[0].id, created_at=NOW, updated_at=NOW)
        db.add(rfp); rfps.append(rfp)
    db.flush()

    # ── Projects ─────────────────────────────────────────────────────────────
    print("-> projects")
    projects = []
    for pname, pkey, pstatus, pclient in [
        ("Operation Hub","OP","active",clients[0]),
        ("MediaSci Portal","MP","active",clients[1]),
        ("HealthTrack App","HT","planning",clients[2]),
        ("Internal Tools","IT","active",None),
        ("AI Analytics Suite","AI","on_hold",clients[0]),
    ]:
        p = Project(name=pname, key=pkey, company_name="MediaSci Solutions",
                    description=f"Full-featured {pname} platform.",
                    type="software", classification="internal",
                    status=pstatus, category="Technology", color="#4F46E5",
                    owner_id=users[0].id, team_id=teams[0].id,
                    start_date=d(-60), end_date=d(120),
                    client_id=pclient.id if pclient else None,
                    client_request_id=client_requests[0].id if pclient else None,
                    created_at=dt(-60), updated_at=NOW)
        db.add(p); projects.append(p)
    db.flush()

    for i, user in enumerate(users):
        db.execute(project_members.insert().values(
            project_id=projects[i % len(projects)].id, user_id=user.id,
            role=["owner","manager","developer","developer","viewer"][i % 5],
            created_at=NOW, updated_at=NOW))
        db.execute(project_members.insert().values(
            project_id=projects[(i+1) % len(projects)].id, user_id=user.id,
            role="developer", created_at=NOW, updated_at=NOW))
    for i, p in enumerate(projects):
        db.execute(project_teams.insert().values(
            project_id=p.id, team_id=teams[i % len(teams)].id,
            created_at=NOW, updated_at=NOW))
    for p in projects:
        db.add(ProjectSetting(
            project_id=p.id,
            working_days=["Monday","Tuesday","Wednesday","Thursday","Friday"],
            working_hours_per_day=8, sprint_duration_weeks=2,
            default_priority="medium", auto_assign=0,
            budget_baseline=Decimal("100000.00"), risk_threshold="medium",
            created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Issue infrastructure ─────────────────────────────────────────────────
    print("-> issue types, priorities, statuses, labels")
    issue_types = []
    for name, icon, color, sub in [
        ("Bug","bug","#EF4444",False), ("Feature","star","#4F46E5",False),
        ("Task","check","#10B981",False), ("Story","book","#8B5CF6",False),
        ("Epic","rocket","#F59E0B",False), ("Sub-task","tool","#6B7280",True)]:
        it = IssueType(name=name, icon=icon, color=color, is_subtask=sub,
                       created_at=NOW, updated_at=NOW)
        db.add(it); issue_types.append(it)
    db.flush()

    issue_priorities = []
    for name, icon, color, lvl in [
        ("Critical","crit","#DC2626",4), ("High","high","#EA580C",3),
        ("Medium","med","#CA8A04",2), ("Low","low","#16A34A",1), ("None","none","#6B7280",0)]:
        ip = IssuePriority(name=name, icon=icon, color=color, level=lvl,
                           created_at=NOW, updated_at=NOW)
        db.add(ip); issue_priorities.append(ip)
    db.flush()

    status_defs = [("To Do","todo","#6B7280",0),("In Progress","in_progress","#4F46E5",1),
                   ("In Review","review","#F59E0B",2),("Done","done","#10B981",3),
                   ("Blocked","todo","#EF4444",4)]
    all_statuses = {}
    for p in projects:
        pstatuses = []
        for sname, scat, scolor, spos in status_defs:
            s = IssueStatus(project_id=p.id, name=sname, category=scat,
                            color=scolor, position=spos, created_at=NOW, updated_at=NOW)
            db.add(s); pstatuses.append(s)
        all_statuses[p.id] = pstatuses
    db.flush()

    all_labels = {}
    for p in projects:
        plabels = []
        for lname, lcolor in [("frontend","#4F46E5"),("backend","#10B981"),
                               ("bug","#EF4444"),("enhancement","#8B5CF6"),("docs","#F59E0B")]:
            lbl = IssueLabel(project_id=p.id, name=lname, color=lcolor,
                             created_at=NOW, updated_at=NOW)
            db.add(lbl); plabels.append(lbl)
        all_labels[p.id] = plabels
    db.flush()

    # ── Boards ───────────────────────────────────────────────────────────────
    print("-> boards")
    all_boards = {}
    for p in projects:
        b = Board(project_id=p.id, name=f"{p.name} Board",
                  type="kanban", is_default=True, created_at=NOW, updated_at=NOW)
        db.add(b); all_boards[p.id] = b
    db.flush()

    for p in projects:
        for i, status in enumerate(all_statuses[p.id]):
            db.add(BoardColumn(board_id=all_boards[p.id].id, name=status.name,
                               issue_status_id=status.id, position=i, wip_limit=10,
                               created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Epics & Stories ──────────────────────────────────────────────────────
    print("-> epics & stories")
    all_epics = {}
    for p in projects[:3]:
        pepics = []
        for i, etitle in enumerate(["Auth & Authorization","Dashboard Redesign"]):
            e = Epic(project_id=p.id, name=etitle,
                     description=f"Epic: {etitle} for {p.name}",
                     goal=f"Deliver {etitle} to production quality.",
                     color=["#4F46E5","#10B981"][i],
                     start_date=d(-30), end_date=d(60),
                     status="open", owner_id=users[i % len(users)].id,
                     position=i, created_at=NOW, updated_at=NOW)
            db.add(e); pepics.append(e)
        all_epics[p.id] = pepics
    db.flush()

    all_stories = {}
    for p in projects[:3]:
        pstories = []
        for i, epic in enumerate(all_epics.get(p.id, [])):
            for j in range(2):
                s = Story(project_id=p.id, epic_id=epic.id,
                          title=f"User story {i*2+j+1} for {epic.name[:20]}",
                          description="As a user I can ... so that ...",
                          color=epic.color, status="open",
                          priority=["high","medium","low"][j % 3],
                          start_date=d(-20), end_date=d(40),
                          position=j, created_at=NOW, updated_at=NOW)
                db.add(s); pstories.append(s)
        all_stories[p.id] = pstories
    db.flush()

    # ── Sprints ──────────────────────────────────────────────────────────────
    print("-> sprints")
    all_sprints = {}
    for p in projects[:3]:
        psprints = []
        for i in range(3):
            sp = Sprint(project_id=p.id, board_id=all_boards[p.id].id,
                        name=f"{p.key} Sprint {i+1}",
                        goal=f"Complete key deliverables for sprint {i+1}",
                        notes="Sprint planning notes.",
                        start_date=dt(-14*(3-i)), end_date=dt(-14*(2-i)),
                        status=["completed","active","planning"][i],
                        capacity_hours=80, velocity=42-i*5, duration=14,
                        created_at=dt(-60), updated_at=NOW)
            if i == 0:
                sp.completed_at = dt(-14)
                sp.completed_by = users[1].id
            db.add(sp); psprints.append(sp)
        all_sprints[p.id] = psprints
    db.flush()

    for p in projects[:3]:
        for sp in all_sprints[p.id]:
            for day in range(5):
                db.add(SprintMetric(sprint_id=sp.id, date=d(-14+day*2),
                                    remaining_points=max(0,50-day*10),
                                    completed_points=day*10,
                                    added_points=2 if day==2 else 0,
                                    scope_change=0,
                                    created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Issues ───────────────────────────────────────────────────────────────
    print("-> issues")
    issue_titles = [
        "Fix login redirect bug","Implement JWT refresh token",
        "Build project dashboard","Add dark mode toggle",
        "Optimize database queries","Write API documentation",
        "Setup CI/CD pipeline","Integrate Slack notifications",
    ]
    all_issues = {}
    for p in projects:
        pissues = []
        statuses = all_statuses[p.id]
        stories = all_stories.get(p.id, [])
        epics = all_epics.get(p.id, [])
        for i, title in enumerate(issue_titles):
            issue = Issue(
                title=title,
                description=f"## Overview\n\n{title} needs addressing.\n\n## Acceptance Criteria\n- [ ] Done\n- [ ] Tests pass",
                project_id=p.id,
                issue_type_id=issue_types[i % len(issue_types)].id,
                issue_status_id=statuses[i % len(statuses)].id,
                issue_priority_id=issue_priorities[i % len(issue_priorities)].id,
                assignee_id=users[i % len(users)].id,
                reporter_id=users[(i+1) % len(users)].id,
                epic_id=epics[i % len(epics)].id if epics else None,
                story_id=stories[i % len(stories)].id if stories else None,
                story_points=[1,2,3,5,8,13,1,2][i],
                estimate_minutes=(8+i)*60,
                remaining_minutes=max(0,(8+i-i//2))*60,
                due_date=dt(7+i*3), start_date=dt(-5),
                position=i, created_at=dt(-20+i), updated_at=NOW)
            db.add(issue); pissues.append(issue)
        all_issues[p.id] = pissues
    db.flush()

    for p in projects[:3]:
        for i, issue in enumerate(all_issues[p.id]):
            db.execute(sprint_issues.insert().values(
                sprint_id=all_sprints[p.id][i % len(all_sprints[p.id])].id,
                issue_id=issue.id, position=i,
                created_at=NOW, updated_at=NOW))

    for p in projects:
        plabels = all_labels[p.id]
        for i, issue in enumerate(all_issues[p.id]):
            db.execute(issue_label.insert().values(
                issue_id=issue.id,
                issue_label_id=plabels[i % len(plabels)].id))
    db.flush()

    for p in projects[:2]:
        parent = all_issues[p.id][0]
        child = Issue(
            title=f"Sub-task: Write tests for {parent.title[:30]}",
            description="Unit tests for the parent issue.",
            project_id=p.id, issue_type_id=issue_types[5].id,
            issue_status_id=all_statuses[p.id][0].id,
            issue_priority_id=issue_priorities[2].id,
            assignee_id=users[2].id, reporter_id=users[1].id,
            parent_id=parent.id, story_points=2, estimate_minutes=120,
            created_at=NOW, updated_at=NOW)
        db.add(child); all_issues[p.id].append(child)
    db.flush()

    for p in projects[:2]:
        issue = all_issues[p.id][0]
        for field, old_v, new_v in [("status","To Do","In Progress"),
                                     ("assignee","unassigned",users[2].name)]:
            db.add(IssueHistory(issue_id=issue.id, user_id=users[1].id,
                               field=field, old_value=old_v, new_value=new_v,
                               action="update", created_at=NOW, updated_at=NOW))
    for p in projects[:2]:
        iss = all_issues[p.id]
        if len(iss) >= 2:
            db.add(IssueLink(issue_id=iss[0].id, linked_issue_id=iss[1].id,
                            link_type="relates_to", created_at=NOW, updated_at=NOW))
        if len(iss) >= 3:
            db.add(TaskDependency(issue_id=iss[2].id, depends_on_id=iss[1].id,
                                  type="blocks", created_by=users[0].id,
                                  created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Comments & reactions ─────────────────────────────────────────────────
    print("-> comments")
    comments = []
    for p in projects[:3]:
        for i, issue in enumerate(all_issues[p.id][:3]):
            for j, body in enumerate([
                "Started working on this. Done by EOD.",
                "Can we get more context on the expected behavior?",
            ]):
                c = IssueComment(issue_id=issue.id,
                                 user_id=users[(i+j) % len(users)].id,
                                 body=body, created_at=dt(-5+j), updated_at=NOW)
                db.add(c); comments.append(c)
    db.flush()

    for c in comments[:5]:
        db.add(CommentReaction(comment_id=c.id, user_id=users[0].id,
                               reaction="thumbs_up", created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Time tracking ────────────────────────────────────────────────────────
    print("-> time logs & entries")
    for p in projects[:3]:
        for i, issue in enumerate(all_issues[p.id][:4]):
            db.add(TimeLog(issue_id=issue.id, user_id=users[i % len(users)].id,
                           duration_minutes=(i+1)*60,
                           description=f"Worked on {issue.title[:40]}",
                           logged_at=d(-i), billable=1, rate=Decimal("75.00"),
                           created_at=NOW, updated_at=NOW))
    for i, user in enumerate(users[:5]):
        p0_issues = all_issues[projects[0].id]
        db.add(TimeEntry(user_id=user.id,
                         issue_id=p0_issues[i % len(p0_issues)].id,
                         project_id=projects[i % len(projects)].id,
                         description=f"Time entry for {user.name}",
                         start_time=dt(-1), end_time=NOW,
                         duration_minutes=480, is_running=0, billable=1,
                         rate=Decimal("75.00"), created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Attachments ──────────────────────────────────────────────────────────
    print("-> attachments")
    for p in projects[:2]:
        for i, issue in enumerate(all_issues[p.id][:3]):
            db.add(IssueAttachment(issue_id=issue.id, user_id=users[0].id,
                                   filename=f"screenshot_{i+1}.png",
                                   original_filename=f"screenshot_{i+1}.png",
                                   path=f"uploads/issues/{issue.id}/sc_{i+1}.png",
                                   mime_type="image/png", size=204800,
                                   created_at=NOW, updated_at=NOW))
    db.flush()
    att = Attachment(attachable_type="Project", attachable_id=projects[0].id,
                     user_id=users[0].id, filename="project_brief.pdf",
                     original_filename="project_brief.pdf",
                     path="uploads/projects/1/project_brief.pdf",
                     disk="public", mime_type="application/pdf", size=512000,
                     created_at=NOW, updated_at=NOW)
    db.add(att); db.flush()
    db.add(AttachmentVersion(attachment_id=att.id, version=1,
                              path="uploads/projects/1/project_brief_v1.pdf",
                              size=512000, uploaded_by=users[0].id,
                              created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Risks ────────────────────────────────────────────────────────────────
    print("-> risks")
    risks = []
    for p in projects[:3]:
        for title, cat, prob, imp, sev, status in [
            ("Budget overrun","Financial",3,4,"high","identified"),
            ("Key developer leaves","Resource",2,5,"high","mitigated"),
            ("Scope creep","Scope",4,3,"high","identified"),
        ]:
            r = Risk(project_id=p.id, created_by=users[0].id,
                     owner_user_id=users[1].id,
                     title=title, description=f"Risk: {title}",
                     category=cat, probability=prob, impact=imp,
                     risk_score=prob*imp, severity=sev, status=status,
                     owner=users[1].name,
                     response_plan="Monitor weekly and escalate.",
                     contingency_plan="Activate backup plan within 24h.",
                     due_date=d(30), created_at=NOW, updated_at=NOW)
            db.add(r); risks.append(r)
    db.flush()

    # ── Resources ────────────────────────────────────────────────────────────
    print("-> resources & allocations")
    resources = []
    for i, user in enumerate(users[:5]):
        res = Resource(user_id=user.id,
                       department_id=departments[i % len(departments)].id,
                       name=user.name, role=user.job_title, email=user.email,
                       daily_capacity_hours=Decimal("8.0"),
                       cost_per_hour=Decimal(str(50+i*10)),
                       cost_per_day=Decimal(str((50+i*10)*8)),
                       availability_start=d(-60), availability_end=d(180),
                       availability_pct=100-i*5, color="#4F46E5", is_active=1,
                       skills=["Python","TypeScript"],
                       created_at=NOW, updated_at=NOW)
        db.add(res); resources.append(res)
    db.flush()

    for i, res in enumerate(resources[:3]):
        db.add(ResourceAllocation(resource_id=res.id,
                                   project_id=projects[i % len(projects)].id,
                                   allocation_pct=80,
                                   allocated_hours=Decimal("160.0"),
                                   allocated_days=Decimal("20.0"),
                                   start_date=d(-30), end_date=d(60),
                                   role=res.role, notes="Primary allocation",
                                   created_at=NOW, updated_at=NOW))
    for res in resources[:2]:
        db.add(ResourceAvailability(resource_id=res.id, date=d(10),
                                     available_hours=Decimal("0.0"),
                                     reason="vacation", note="Annual leave",
                                     created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Budgets & Finance ─────────────────────────────────────────────────────
    print("-> budgets, expenses, cloud services")
    expense_cats = []
    for cat_name in ["Development","Infrastructure","Marketing","Operations"]:
        ec = ExpenseCategory(name=cat_name, created_at=NOW, updated_at=NOW)
        db.add(ec); expense_cats.append(ec)
    db.flush()

    for p in projects:
        db.add(Budget(project_id=p.id, name=f"{p.name} Budget",
                      total_budget=Decimal("150000.00"), spent=Decimal("42000.00"),
                      currency="USD", start_date=d(-60), end_date=d(180),
                      created_at=NOW, updated_at=NOW))
        db.add(ProjectBudget(project_id=p.id,
                              total_budget=Decimal("150000.00"),
                              spent_budget=Decimal("42000.00"),
                              currency="USD", created_at=NOW, updated_at=NOW))
        for i, ec in enumerate(expense_cats[:3]):
            db.add(Expense(project_id=p.id, category_id=ec.id,
                           name=f"{ec.name} expense #{i+1}",
                           amount=Decimal(str(1000+i*500)), currency="USD",
                           date=d(-10-i), description=f"Monthly {ec.name.lower()} costs",
                           vendor=f"{ec.name} Vendor LLC",
                           status=["pending","approved","paid"][i % 3],
                           created_at=NOW, updated_at=NOW))
    db.flush()

    for p in projects[:3]:
        db.add(CloudService(project_id=p.id, name="AWS EC2 Instance",
                             provider="AWS", monthly_cost=Decimal("299.00"),
                             annual_cost=Decimal("3588.00"), status="active",
                             renewal_date=d(180), created_at=NOW, updated_at=NOW))
        db.add(SoftwareLicense(project_id=p.id, name="JetBrains All Products",
                                vendor="JetBrains", license_type="subscription",
                                seats=10, cost=Decimal("4999.00"),
                                renewal_date=d(365), status="active",
                                created_at=NOW, updated_at=NOW))
        db.add(FinancialAlert(project_id=p.id, type="budget_threshold",
                               message="Budget utilization exceeded 50%",
                               severity="warning", acknowledged=0,
                               created_at=NOW, updated_at=NOW))
        db.add(FinancialDocument(project_id=p.id, name="Invoice Q2-2026",
                                  path=f"uploads/projects/{p.id}/invoice_q2.pdf",
                                  type="invoice", created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Milestones ────────────────────────────────────────────────────────────
    print("-> milestones")
    milestones = []
    for i, mname in enumerate(["MVP Release","Beta Launch","Public Release","v2.0 Planning"]):
        m = Milestone(name=mname, description=f"Key milestone: {mname}",
                      date=d(30*(i+1)),
                      status=["pending","pending","done","pending"][i],
                      priority=["high","high","critical","medium"][i],
                      owner_id=users[i % len(users)].id,
                      created_at=NOW, updated_at=NOW)
        db.add(m); milestones.append(m)
    db.flush()

    for i, p in enumerate(projects[:3]):
        db.execute(milestone_projects.insert().values(
            milestone_id=milestones[i % len(milestones)].id, project_id=p.id))
    db.flush()

    # ── Plans & Gantt Tasks ───────────────────────────────────────────────────
    print("-> plans, plan tasks, gantt tasks, roadmap")
    plans = []
    for p in projects[:3]:
        plan = Plan(name=f"{p.name} Roadmap Plan",
                    description=f"Execution plan for {p.name}",
                    status="active", owner_id=users[0].id,
                    start_date=d(-30), end_date=d(150),
                    created_at=NOW, updated_at=NOW)
        db.add(plan); plans.append(plan)
    db.flush()

    plan_tasks = []
    for i, plan in enumerate(plans):
        p = projects[i]
        for j, phase_name in enumerate(["Analysis","Design","Development","Testing"]):
            pt = PlanTask(plan_id=plan.id, project_id=p.id,
                          title=f"Phase {j+1}: {phase_name}",
                          description=f"Work for phase {j+1}",
                          assigned_to=users[(i+j) % len(users)].id,
                          status=["completed","in_progress","pending","pending"][j],
                          priority=["high","high","medium","low"][j],
                          start_date=d(-30+j*20), end_date=d(-10+j*20),
                          duration=20, progress=[100,60,0,0][j],
                          wbs_code=f"1.{j+1}", story_points=13-j*2,
                          created_at=NOW, updated_at=NOW)
            db.add(pt); plan_tasks.append(pt)
    db.flush()

    for p in projects[:3]:
        for i in range(3):
            db.add(Task(project_id=p.id, sprint_id=all_sprints[p.id][0].id,
                        title=f"Gantt Task {i+1} - {p.name}",
                        description=f"Task {i+1} on the project plan.",
                        assigned_to=users[i % len(users)].id,
                        status=["in_progress","pending","pending"][i],
                        priority=["high","medium","low"][i],
                        start_date=d(-10+i*5), end_date=d(10+i*5),
                        duration=20, progress=[40,0,0][i],
                        wbs_code=f"2.{i+1}", is_milestone=0,
                        created_at=NOW, updated_at=NOW))
    db.add(Roadmap(name="MediaSci 2026 Roadmap",
                   description="Strategic roadmap for all products",
                   owner_id=users[0].id, created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Stakeholders ──────────────────────────────────────────────────────────
    print("-> stakeholders")
    stakeholders = []
    for name, role, org, infl, inter, sup in [
        ("Michael Chen","CEO","TechCorp Inc.","high","high","champion"),
        ("Sarah Johnson","CTO","MediaSci Ltd.","high","medium","supporter"),
        ("Tom Richards","Project Sponsor","HealthPlus","medium","high","neutral"),
        ("Linda Patel","End User Rep","Internal","low","high","supporter"),
    ]:
        stk = Stakeholder(name=name,
                          email=f"{name.lower().replace(' ','.')}@corp.com",
                          phone="+1-555-0001", organization=org,
                          role=role, department="Executive",
                          influence_level=infl, interest_level=inter,
                          support_level=sup, communication_preference="email",
                          status="Active", type="External",
                          engagement_score=Decimal("7.5"),
                          last_interaction_at=dt(-7),
                          created_at=NOW, updated_at=NOW)
        db.add(stk); stakeholders.append(stk)
    db.flush()

    for i, stk in enumerate(stakeholders):
        db.execute(stakeholder_project.insert().values(
            stakeholder_id=stk.id,
            project_id=projects[i % len(projects)].id,
            created_at=NOW, updated_at=NOW))
    db.flush()

    for stk in stakeholders[:2]:
        db.add(StakeholderEngagement(stakeholder_id=stk.id, type="meeting",
                                      description="Quarterly review meeting",
                                      outcome="Positive feedback.",
                                      date=d(-14), created_at=NOW, updated_at=NOW))
        db.add(StakeholderImpact(stakeholder_id=stk.id, area="Technology",
                                  level="high",
                                  description="Direct impact on technical decisions",
                                  created_at=NOW, updated_at=NOW))
        db.add(StakeholderInteraction(stakeholder_id=stk.id, user_id=users[0].id,
                                       type="email", subject="Project Status Update",
                                       notes="Sent weekly status report",
                                       outcome="Acknowledged",
                                       interaction_date=dt(-7),
                                       created_at=NOW, updated_at=NOW))
        db.add(StakeholderMessage(stakeholder_id=stk.id, user_id=users[0].id,
                                   subject="Q2 Progress Update",
                                   body="Please find attached the Q2 progress report.",
                                   channel="email", status="sent", sent_at=dt(-7),
                                   created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Scopes ────────────────────────────────────────────────────────────────
    print("-> scopes")
    for p in projects[:3]:
        scope = Scope(project_id=p.id, title=f"{p.name} Scope Document",
                      description="Formal scope definition.",
                      in_scope="All features listed in the PRD.",
                      out_of_scope="Mobile native apps.",
                      assumptions="Team has required infrastructure access.",
                      constraints="Must use existing tech stack.",
                      acceptance_criteria="All user stories pass QA.",
                      status="approved", version=1,
                      approved_by=users[0].id, approved_at=dt(-10),
                      created_at=NOW, updated_at=NOW)
        db.add(scope); db.flush()
        db.add(ScopeObjective(scope_id=scope.id, title="Deliver MVP on schedule",
                               description="Release MVP within agreed timeline.",
                               priority="high", created_at=NOW, updated_at=NOW))
        db.add(ScopeDeliverable(scope_id=scope.id, title="Working web application",
                                 description="Fully functional web app on staging.",
                                 status="pending", due_date=d(90),
                                 created_at=NOW, updated_at=NOW))
        db.add(ScopeVersion(scope_id=scope.id, version=1,
                             snapshot={"title": scope.title, "status": "approved"},
                             changed_by=users[0].id, change_reason="Initial approval",
                             created_at=NOW, updated_at=NOW))
        db.add(ScopeComment(scope_id=scope.id, user_id=users[1].id,
                             body="Scope looks good. Approved by engineering.",
                             created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Change Requests ───────────────────────────────────────────────────────
    print("-> change requests")
    for p in projects[:3]:
        for title, desc, prio, status in [
            ("Add real-time notifications","Feature: push notifications","high","Approved"),
            ("Extend project deadline","Need 2 more weeks for QA","medium","Draft"),
        ]:
            cr = ChangeRequest(project_id=p.id, title=title, description=desc,
                               justification="Business need from sprint review.",
                               impact="Minimal impact on existing features.",
                               priority=prio, status=status,
                               requested_by=users[2].id,
                               approved_by=users[0].id if status == "Approved" else None,
                               approved_at=dt(-5) if status == "Approved" else None,
                               cost_impact=Decimal("2500.00"),
                               schedule_impact_days=5,
                               created_at=NOW, updated_at=NOW)
            db.add(cr)
    db.flush()

    # ── Workflows ────────────────────────────────────────────────────────────
    print("-> workflows")
    wf_template = WorkflowTemplate(name="Standard Software Workflow",
                                    description="Default workflow for software projects",
                                    is_global=True, created_by=users[0].id,
                                    created_at=NOW, updated_at=NOW)
    db.add(wf_template); db.flush()

    for i, (sname, scat, scolor, spos) in enumerate(status_defs):
        db.add(WorkflowStep(workflow_template_id=wf_template.id, name=sname,
                             category=scat, color=scolor, position=i,
                             is_initial=(i == 0), created_at=NOW, updated_at=NOW))
    db.flush()

    for p in projects[:3]:
        wf = Workflow(name=f"{p.name} Workflow",
                      description=f"Workflow for {p.name}",
                      project_id=p.id, issue_type_id=issue_types[0].id,
                      is_default=True, workflow_template_id=wf_template.id,
                      created_at=NOW, updated_at=NOW)
        db.add(wf); db.flush()
        statuses = all_statuses[p.id]
        for i, status in enumerate(statuses):
            db.add(WorkflowStatus(workflow_id=wf.id, issue_status_id=status.id,
                                   position=i, is_initial=(i == 0),
                                   created_at=NOW, updated_at=NOW))
        db.flush()
        for i in range(len(statuses) - 1):
            db.add(WorkflowTransition(workflow_id=wf.id,
                                       name=f"{statuses[i].name} to {statuses[i+1].name}",
                                       from_status_id=statuses[i].id,
                                       to_status_id=statuses[i+1].id,
                                       created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Automation ────────────────────────────────────────────────────────────
    print("-> automation rules & logs")
    for p in projects[:3]:
        ar = AutomationRule(project_id=p.id, name="Auto-notify on review",
                             description="Notify reporter when issue moves to In Review.",
                             trigger_type="status_change",
                             trigger_config={"from": "In Progress","to": "In Review"},
                             action_type="send_notification",
                             action_config={"recipient": "reporter"},
                             conditions=[], is_active=True, run_count=12,
                             last_run_at=dt(-1), created_by=users[0].id,
                             created_at=NOW, updated_at=NOW)
        db.add(ar); db.flush()
        db.add(AutomationLog(rule_id=ar.id,
                              trigger_data={"issue_id": all_issues[p.id][0].id},
                              action_result={"notification_sent": True},
                              status="success", executed_at=dt(-1),
                              created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Notifications ─────────────────────────────────────────────────────────
    print("-> notifications")
    p0_issues = all_issues[projects[0].id]
    for i, user in enumerate(users[:5]):
        db.add(Notification(id=str(uuid.uuid4()),
                             type="App\\Notifications\\IssueAssigned",
                             notifiable_type="App\\Models\\User",
                             notifiable_id=user.id,
                             data={"issue_id": p0_issues[0].id,
                                   "message": "You have been assigned a new issue."},
                             read_at=None if i < 3 else dt(-1),
                             created_at=NOW, updated_at=NOW))
        db.add(DatabaseNotification(user_id=user.id, title="New Issue Assigned",
                                     body=f"Assigned: {p0_issues[i % len(p0_issues)].title}",
                                     type="issue_assigned", entity_type="Issue",
                                     entity_id=p0_issues[0].id,
                                     data={"url": f"/issues/{p0_issues[0].id}"},
                                     read_at=None, created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Achievements ──────────────────────────────────────────────────────────
    print("-> achievements")
    for i, user in enumerate(users[:5]):
        title = ["First Issue Closed","Sprint Champion","Bug Crusher","Team Player","Code Review Hero"][i]
        ach = Achievement(user_id=user.id, title=title,
                          project_id=projects[i % len(projects)].id,
                          sprint_id=all_sprints[projects[i % 3].id][0].id if i < 3 else None,
                          notes=f"Awarded for: {title}",
                          achieved_at=d(-i*7),
                          badge_type=["star","trophy","medal","crown","rocket"][i],
                          badge_color=["#F59E0B","#4F46E5","#10B981","#EC4899","#8B5CF6"][i],
                          is_auto=0, created_at=NOW, updated_at=NOW)
        db.add(ach); db.flush()
        db.add(AchievementComment(achievement_id=ach.id,
                                   user_id=users[(i+1) % len(users)].id,
                                   body=f"Congratulations {user.name}! Well deserved!",
                                   created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Events ────────────────────────────────────────────────────────────────
    print("-> events")
    for title, start, end, etype in [
        ("Sprint Planning",dt(2),dt(2)+timedelta(hours=2),"meeting"),
        ("Design Review",dt(5),dt(5)+timedelta(hours=1),"meeting"),
        ("Client Demo",dt(14),dt(14)+timedelta(hours=2),"demo"),
        ("Sprint Retrospective",dt(-1),dt(-1)+timedelta(hours=1),"meeting"),
        ("Team Lunch",dt(7),dt(7)+timedelta(hours=2),"social"),
    ]:
        db.add(Event(title=title, description=f"Event: {title}",
                     start=start, end=end, all_day=0, color="#4F46E5",
                     project_id=projects[0].id, user_id=users[0].id,
                     type=etype, location="Conference Room A",
                     created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Admin Tasks ───────────────────────────────────────────────────────────
    print("-> admin tasks")
    for title, cat, prio, status in [
        ("Renew SSL certificates","infrastructure","high","pending"),
        ("Backup database","maintenance","critical","completed"),
        ("Update dependencies","development","medium","in_progress"),
        ("Review access controls","security","high","pending"),
    ]:
        db.add(AdminTask(title=title, description=f"Admin: {title}",
                         category=cat, priority=prio, status=status,
                         assigned_to=users[0].id, due_date=d(7),
                         completed_at=NOW if status == "completed" else None,
                         created_by=users[0].id, created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Custom Fields ─────────────────────────────────────────────────────────
    print("-> custom fields & values")
    cf_list = []
    for p in projects[:3]:
        for i, (fname, ftype, opts) in enumerate([
            ("Story Points","number",None),
            ("Release","select",["v1.0","v1.1","v2.0"]),
            ("Affected Area","text",None),
        ]):
            cf = CustomField(project_id=p.id, name=fname, type=ftype,
                             options=opts, is_required=0, position=i,
                             created_at=NOW, updated_at=NOW)
            db.add(cf); cf_list.append(cf)
    db.flush()

    for p in projects[:2]:
        for i, issue in enumerate(all_issues[p.id][:3]):
            for cf in cf_list:
                if cf.project_id == p.id:
                    db.add(IssueCustomFieldValue(issue_id=issue.id,
                                                  custom_field_id=cf.id,
                                                  value=str(i+1),
                                                  created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Project Phases ────────────────────────────────────────────────────────
    print("-> project phases")
    for p in projects[:3]:
        for i, (pname, pcolor, pstart, pend, pstatus, pprog) in enumerate([
            ("Discovery","#4F46E5",d(-60),d(-30),"completed",100),
            ("Design","#8B5CF6",d(-30),d(0),"completed",100),
            ("Development","#10B981",d(0),d(60),"in_progress",65),
            ("Testing","#F59E0B",d(60),d(90),"pending",0),
            ("Launch","#EF4444",d(90),d(100),"pending",0),
        ]):
            db.add(ProjectPhase(project_id=p.id, name=pname,
                                description=f"{pname} phase.",
                                start_date=pstart, end_date=pend,
                                status=pstatus, position=i,
                                color=pcolor, progress=pprog,
                                deliverables=[f"Deliverable {i+1}"],
                                created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Activity & Audit Logs ─────────────────────────────────────────────────
    print("-> activity & audit logs")
    for i, user in enumerate(users[:5]):
        db.add(ActivityLog(log_name="project",
                            description=f"{user.name} updated project status",
                            subject_type="Project",
                            subject_id=projects[i % len(projects)].id,
                            causer_type="App\\Models\\User", causer_id=user.id,
                            properties={"old":"planning","new":"active"},
                            event="updated", batch_uuid=str(uuid.uuid4()),
                            created_at=dt(-i), updated_at=NOW))
        db.add(AuditLog(user_id=user.id, action="update", entity_type="Project",
                         entity_id=projects[i % len(projects)].id,
                         old_values={"status":"planning"},
                         new_values={"status":"active"},
                         ip_address="192.168.1.1",
                         user_agent="Mozilla/5.0 (Windows NT 10.0)",
                         created_at=dt(-i), updated_at=NOW))
    db.flush()

    # ── Executive Snapshots & Workloads ───────────────────────────────────────
    print("-> executive snapshots & user workloads")
    db.add(ExecutiveSnapshot(user_id=users[0].id,
                              data={"projects": len(projects), "open_issues": 24,
                                    "team_members": len(users), "budget_utilization": 42},
                              period="2026-Q3", created_at=NOW, updated_at=NOW))
    for user in users[:5]:
        db.add(UserWorkload(user_id=user.id, week_start=d(-7),
                             allocated_hours=Decimal("40.0"),
                             actual_hours=Decimal("38.5"),
                             created_at=NOW, updated_at=NOW))
    db.flush()

    # ── AI Recommendations ────────────────────────────────────────────────────
    print("-> AI recommendations")
    for p in projects[:3]:
        db.add(AiRecommendation(type="smart_assign",
                                 subject_type="Issue", subject_id=all_issues[p.id][0].id,
                                 entity_type="Issue", entity_id=all_issues[p.id][0].id,
                                 input_data={"issue_id": all_issues[p.id][0].id},
                                 suggestion_data={"user_id": users[2].id, "confidence": 0.87},
                                 recommendation=f"Assign to {users[2].name} based on skills.",
                                 confidence=Decimal("87.00"), status="pending",
                                 created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Validation Rules ──────────────────────────────────────────────────────
    print("-> validation rules & results")
    for p in projects[:3]:
        vr = ValidationRule(project_id=p.id,
                             name="Require story points before sprint",
                             description="Issues must have story points before sprint.",
                             rule_type="field_required",
                             parameters='{"field": "story_points"}',
                             is_active=1, created_at=NOW, updated_at=NOW)
        db.add(vr); db.flush()
        db.add(ValidationResult(rule_id=vr.id, project_id=p.id,
                                 passed=1, details={"checked": 8, "passed": 8},
                                 verified_by=users[0].id,
                                 created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Project Documents ─────────────────────────────────────────────────────
    print("-> project documents")
    for p in projects[:3]:
        for doc_name in ["Technical Spec","Meeting Notes","Architecture Diagram"]:
            db.add(ProjectDocument(project_id=p.id, uploaded_by=users[0].id,
                                   documentable_type="Project", documentable_id=p.id,
                                   name=doc_name,
                                   original_name=f"{doc_name.replace(' ','_').lower()}.pdf",
                                   file_path=f"uploads/projects/{p.id}/{doc_name.replace(' ','_').lower()}.pdf",
                                   mime_type="application/pdf", file_size=102400,
                                   category="specification", visibility="project",
                                   created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Chats & Messages ──────────────────────────────────────────────────────
    print("-> chats, messages, chatbot")
    chats = []
    for p in projects[:3]:
        chat = Chat(chatable_type="App\\Models\\Project", chatable_id=p.id,
                    name=f"{p.name} General Chat", created_at=NOW, updated_at=NOW)
        db.add(chat); chats.append(chat)
    db.flush()

    for i, chat in enumerate(chats):
        for j, body in enumerate([
            "Hey team, how is the progress?",
            "Going well! PR is almost ready.",
            "Great, let us sync tomorrow.",
        ]):
            db.add(Message(chat_id=chat.id, user_id=users[(i+j) % len(users)].id,
                           body=body, created_at=dt(-j), updated_at=NOW))
        db.add(MessageRead(chat_id=chat.id, user_id=users[0].id, last_read_at=NOW))
    db.flush()

    for i, user in enumerate(users[:3]):
        db.add(ChatbotMessage(user_id=user.id,
                               role="user" if i % 2 == 0 else "assistant",
                               content="What is the current sprint velocity?",
                               context=f"Project: {projects[0].name}",
                               tokens_used=150, created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Integrations ──────────────────────────────────────────────────────────
    print("-> integrations (Slack, Figma, Jira)")
    for p in projects[:2]:
        db.add(SlackIntegration(project_id=p.id,
                                 webhook_url="https://hooks.slack.com/services/FAKE/HOOK",
                                 channel="#project-updates", is_active=1,
                                 events=["issue_created","sprint_started","sprint_completed"],
                                 created_at=NOW, updated_at=NOW))
        db.add(FigmaIntegration(project_id=p.id, file_key="FAKE_FIGMA_KEY",
                                 file_name=f"{p.name} Designs",
                                 access_token="figma_token_fake",
                                 is_active=1, last_synced_at=dt(-1),
                                 created_at=NOW, updated_at=NOW))
        db.add(JiraImport(project_id=p.id,
                           jira_url="https://company.atlassian.net",
                           jira_project_key=p.key,
                           api_token="jira_api_token_fake",
                           email=users[0].email,
                           status="completed", imported_count=45,
                           last_synced_at=dt(-30), created_at=NOW, updated_at=NOW))
    db.flush()

    # ── Proposals ─────────────────────────────────────────────────────────────
    print("-> proposals & versions")
    for i, cr in enumerate(client_requests[:2]):
        proposal = Proposal(client_request_id=cr.id,
                             project_id=projects[i].id, rfp_id=rfps[i].id,
                             title=f"Proposal for {cr.title[:40]}",
                             status=["draft","sent","accepted"][i % 3],
                             created_by=users[0].id,
                             created_at=NOW, updated_at=NOW)
        db.add(proposal); db.flush()
        db.add(ProposalVersion(proposal_id=proposal.id, version_number=1,
                                content="Detailed technical proposal content...",
                                summary="12-week development engagement.",
                                estimated_hours=Decimal("480.00"),
                                estimated_cost=Decimal("48000.00"),
                                created_by=users[0].id,
                                created_at=NOW, updated_at=NOW))
    db.flush()

    print()
    print("Seed complete!")
    print(f"  Users:         {len(users)}")
    print(f"  Departments:   {len(departments)}")
    print(f"  Teams:         {len(teams)}")
    print(f"  Skills:        {len(skills)}")
    print(f"  Clients:       {len(clients)}")
    print(f"  Projects:      {len(projects)}")
    print(f"  Issues:        {sum(len(v) for v in all_issues.values())}")
    print(f"  Sprints:       {sum(len(v) for v in all_sprints.values())}")
    print(f"  Stakeholders:  {len(stakeholders)}")
    print(f"  Risks:         {len(risks)}")
    print(f"  Resources:     {len(resources)}")
    print(f"  Milestones:    {len(milestones)}")
    print(f"  Chats:         {len(chats)}")
    db.commit()


def main():
    parser = argparse.ArgumentParser(description="Seed dummy data into Operation Hub DB.")
    parser.add_argument("--clear", action="store_true",
                        help="Delete all rows first (USE WITH CAUTION).")
    args = parser.parse_args()

    print("=" * 60)
    print("  Operation Hub - Database Seed Script")
    print("=" * 60)

    db = SessionLocal()
    try:
        if args.clear:
            clear_all(db)
        seed(db)
    except Exception as exc:
        db.rollback()
        print(f"\nSeed FAILED: {exc}")
        import traceback; traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

    print("=" * 60)


if __name__ == "__main__":
    main()
