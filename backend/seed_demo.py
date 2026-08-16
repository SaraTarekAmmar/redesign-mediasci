"""
Operation Hub — Complete Enterprise Demo Data Seed Script
Populates Departments, Teams, Users, Resources, Skills, Clients, Projects, Planning Baselines,
Milestones, Deliverables, Milestone Dependencies, Workflow Stages, Issue Statuses, Issues,
Sprints, Time Logs, Risks, Expenses, Documents, and Stakeholders.
"""

from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.security import hash_password

# Import models
from sqlalchemy import select

from app.models.user import User, Role, user_roles_table
from app.models.team import Department, Team
from app.models.resource import Resource, Skill, ResourceSkill
from app.models.client import Client
from app.models.project import Project
from app.models.planning import (
    ProjectPlanningBaseline,
    ProjectMilestone,
    ProjectDeliverable,
    ProjectMilestoneDependency,
)
from app.models.issue import Issue, IssueStatus, IssuePriority
from app.models.workflow import WorkflowStage
from app.models.time_tracking import TimeLog
from app.models.risk import Risk
from app.models.misc import ProjectDocument
from app.models.budget import Expense


def seed_demo_data():
    db: Session = SessionLocal()
    try:
        print("Seeding Operation Hub Enterprise Demo Data...")

        # -------------------------------------------------------------
        # 1. ROLES
        # -------------------------------------------------------------
        roles_data = [
            ("super-admin", "Super Administrator"),
            ("admin", "Administrator"),
            ("project-manager", "Project Manager"),
            ("team-leader", "Team Leader"),
            ("developer", "Developer"),
            ("viewer", "Viewer"),
        ]
        roles_map = {}
        for slug, name in roles_data:
            r = db.query(Role).filter(Role.name == slug).first()
            if not r:
                r = Role(name=slug, guard_name="web")
                db.add(r)
                db.flush()
            roles_map[slug] = r

        # -------------------------------------------------------------
        # 2. DEPARTMENTS & TEAMS
        # -------------------------------------------------------------
        dept_eng = db.query(Department).filter(Department.name == "Engineering").first()
        if not dept_eng:
            dept_eng = Department(name="Engineering", description="Software Development & Infrastructure")
            db.add(dept_eng)

        dept_des = db.query(Department).filter(Department.name == "Design").first()
        if not dept_des:
            dept_des = Department(name="Design", description="UI/UX & Product Design")
            db.add(dept_des)

        dept_ops = db.query(Department).filter(Department.name == "Operations").first()
        if not dept_ops:
            dept_ops = Department(name="Operations", description="Project Management & QA Operations")
            db.add(dept_ops)

        db.flush()

        team_be = db.query(Team).filter(Team.name == "Backend Team").first()
        if not team_be:
            team_be = Team(name="Backend Team", department_id=dept_eng.id, description="FastAPI, Python & MySQL Services")
            db.add(team_be)

        team_fe = db.query(Team).filter(Team.name == "Frontend Team").first()
        if not team_fe:
            team_fe = Team(name="Frontend Team", department_id=dept_eng.id, description="React, TypeScript & Tailwind Services")
            db.add(team_fe)

        team_qa = db.query(Team).filter(Team.name == "QA Team").first()
        if not team_qa:
            team_qa = Team(name="QA Team", department_id=dept_ops.id, description="Quality Assurance & Automated Testing")
            db.add(team_qa)

        db.flush()

        # -------------------------------------------------------------
        # 3. SKILLS
        # -------------------------------------------------------------
        skills_list = [
            ("Python", "Backend Development", "Advanced"),
            ("FastAPI", "Backend Framework", "Expert"),
            ("React", "Frontend Library", "Expert"),
            ("TypeScript", "Frontend Language", "Advanced"),
            ("SQL", "Database & ORM", "Advanced"),
            ("Docker", "DevOps & Containers", "Intermediate"),
            ("UI Design", "Figma & Wireframing", "Expert"),
            ("Testing", "Pytest & Automation", "Advanced"),
        ]
        skills_map = {}
        for name, cat, lvl in skills_list:
            s = db.query(Skill).filter(Skill.name == name).first()
            if not s:
                s = Skill(name=name, category=cat)
                db.add(s)
                db.flush()
            skills_map[name] = s

        # -------------------------------------------------------------
        # 4. USERS & RESOURCES
        # -------------------------------------------------------------
        hashed_pwd = hash_password("password123")
        users_seed = [
            ("admin@operationhub.com", "System Admin", "super-admin", dept_ops, team_qa, "Software Architect", "Full Time", 120.0, 40.0),
            ("sarah.pm@operationhub.com", "Sarah Jenkins", "project-manager", dept_ops, team_qa, "Senior Project Manager", "Full Time", 95.0, 40.0),
            ("alex.be@operationhub.com", "Alex Rivera", "team-leader", dept_eng, team_be, "Lead Backend Engineer", "Full Time", 110.0, 40.0),
            ("elena.fe@operationhub.com", "Elena Rostova", "team-leader", dept_eng, team_fe, "Lead Frontend Engineer", "Full Time", 105.0, 40.0),
            ("marcus.be@operationhub.com", "Marcus Chen", "developer", dept_eng, team_be, "Senior Python Developer", "Full Time", 85.0, 40.0),
            ("lisa.fe@operationhub.com", "Lisa Vance", "developer", dept_eng, team_fe, "Frontend UI Developer", "Full Time", 80.0, 40.0),
            ("david.qa@operationhub.com", "David Miller", "developer", dept_ops, team_qa, "QA Lead Automation Engineer", "Full Time", 75.0, 40.0),
            ("nora.des@operationhub.com", "Nora Al-Mansoor", "developer", dept_des, team_fe, "Lead UI/UX Designer", "Full Time", 90.0, 40.0),
        ]

        user_resource_map = {}
        for email, name, role_slug, dept, team, job_title, contract, hourly_cost, weekly_cap in users_seed:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(
                    email=email,
                    name=name,
                    password=hashed_pwd,
                    role_id=roles_map[role_slug].id,
                    department_id=dept.id,
                    job_title=job_title,
                    is_active=True,
                )
                db.add(u)
                db.flush()

            # RBAC reads model_has_roles (not users.role_id); ensure the row exists.
            has_role_row = db.execute(
                select(user_roles_table.c.role_id).where(
                    user_roles_table.c.model_id == u.id,
                    user_roles_table.c.model_type.like("%User"),
                )
            ).first()
            if not has_role_row:
                db.execute(
                    user_roles_table.insert().values(
                        role_id=roles_map[role_slug].id,
                        model_type="App\\Models\\User",
                        model_id=u.id,
                    )
                )

            r = db.query(Resource).filter(Resource.user_id == u.id).first()
            if not r:
                r = Resource(
                    user_id=u.id,
                    name=name,
                    email=email,
                    department_id=dept.id,
                    position=job_title,
                    seniority="Senior" if "Lead" in job_title or "Senior" in job_title else "Mid",
                    contract_type=contract,
                    cost_per_hour=hourly_cost,
                    weekly_capacity=weekly_cap,
                    daily_capacity_hours=8.0,
                    availability_status="available",
                    availability_pct=100.0,
                    is_active=True,
                )
                db.add(r)
                db.flush()
            user_resource_map[email] = (u, r)

        # Attach Skills to Resources
        res_alex = user_resource_map["alex.be@operationhub.com"][1]
        res_elena = user_resource_map["elena.fe@operationhub.com"][1]
        res_nora = user_resource_map["nora.des@operationhub.com"][1]
        res_david = user_resource_map["david.qa@operationhub.com"][1]

        def _assign_skill(res, skill_obj):
            rs = db.query(ResourceSkill).filter(ResourceSkill.resource_id == res.id, ResourceSkill.skill_id == skill_obj.id).first()
            if not rs:
                db.add(ResourceSkill(resource_id=res.id, skill_id=skill_obj.id, years_of_experience=4, proficiency="Expert"))

        _assign_skill(res_alex, skills_map["Python"])
        _assign_skill(res_alex, skills_map["FastAPI"])
        _assign_skill(res_alex, skills_map["SQL"])

        _assign_skill(res_elena, skills_map["React"])
        _assign_skill(res_elena, skills_map["TypeScript"])

        _assign_skill(res_nora, skills_map["UI Design"])

        _assign_skill(res_david, skills_map["Testing"])
        _assign_skill(res_david, skills_map["Python"])

        db.flush()

        # -------------------------------------------------------------
        # 5. CLIENTS
        # -------------------------------------------------------------
        clients_data = [
            ("ABC Financial Group", "ABC Bank", "finance@abcbank.com", "+1-555-0192", "Tier 1 Enterprise Bank"),
            ("MedCare Health Systems", "MedCare", "contact@medcare.org", "+1-555-0144", "Healthcare Provider"),
            ("RetailX Global Commerce", "RetailX", "info@retailx.com", "+1-555-0188", "E-Commerce & Logistics"),
        ]
        clients_map = {}
        for name, company, email, phone, desc in clients_data:
            c = db.query(Client).filter(Client.name == name).first()
            if not c:
                c = Client(name=name, company=company, email=email, phone=phone, notes=desc, status="active")
                db.add(c)
                db.flush()
            clients_map[company] = c

        # -------------------------------------------------------------
        # 6. PROJECTS
        # -------------------------------------------------------------
        pm_user = user_resource_map["sarah.pm@operationhub.com"][0]
        today = date.today()

        projects_seed = [
            ("Digital Banking Platform", "DBP", clients_map["ABC Bank"].id, "standard", 450000.0, today - timedelta(days=40), today + timedelta(days=140)),
            ("Hospital Management System", "HMS", clients_map["MedCare"].id, "standard", 320000.0, today - timedelta(days=20), today + timedelta(days=120)),
            ("Retail ERP Integration", "RERP", clients_map["RetailX"].id, "presale", 180000.0, today, today + timedelta(days=90)),
        ]

        projects_map = {}
        for name, key, client_id, classif, budget_amt, s_date, e_date in projects_seed:
            p = db.query(Project).filter(Project.key == key).first()
            if not p:
                p = Project(
                    name=name,
                    key=key,
                    client_id=client_id,
                    classification=classif,
                    status="in_progress" if classif == "standard" else "active",
                    owner_id=pm_user.id,
                    start_date=s_date,
                    end_date=e_date,
                    description=f"Enterprise deployment of {name}",
                )
                db.add(p)
                db.flush()
            projects_map[key] = p

        # -------------------------------------------------------------
        # 7. PLANNING BASELINES (Per Project)
        # -------------------------------------------------------------
        baselines_seed = [
            (projects_map["DBP"].id, 180, 450000.0, 1600.0, 6),
            (projects_map["HMS"].id, 140, 320000.0, 1200.0, 5),
            (projects_map["RERP"].id, 90, 180000.0, 600.0, 3),
        ]
        for pid, dur, bud, hrs, res_cnt in baselines_seed:
            b = db.query(ProjectPlanningBaseline).filter(ProjectPlanningBaseline.project_id == pid).first()
            if not b:
                b = ProjectPlanningBaseline(
                    project_id=pid,
                    planned_duration_days=dur,
                    planned_budget=bud,
                    planned_hours=hrs,
                    planned_resources_count=res_cnt,
                )
                db.add(b)
        db.flush()

        # -------------------------------------------------------------
        # 8. MILESTONES & DELIVERABLES (4 Milestones per project)
        # -------------------------------------------------------------
        milestone_templates = [
            ("Requirements & Architecture", "FRD, Architecture Diagrams, Scope signoff", 1, -30, -10, "completed"),
            ("UI/UX Design & Prototype", "Interactive Figma prototypes and design system", 2, -10, 20, "in_progress"),
            ("Core Development & APIs", "Backend microservices, database schemas, frontend screens", 3, 20, 80, "pending"),
            ("QA Testing & UAT Launch", "Integration testing, security audit, deployment", 4, 80, 110, "pending"),
        ]

        deliverable_templates = {
            1: [("BRD & Specs", "Business Requirements Document"), ("System Architecture Doc", "High Level Design & Data Models")],
            2: [("Figma Wireframes", "UX Navigation Flow"), ("UI Component Prototype", "React Design Tokens")],
            3: [("Backend Core APIs", "RESTful FastAPI endpoints"), ("Frontend Portal Screens", "React Dashboards & Forms")],
            4: [("Automated Test Report", "Pytest & E2E suite results"), ("Production Deployment Package", "Docker images & K8s manifests")],
        }

        project_milestones_map = {}
        for pkey, p in projects_map.items():
            project_milestones_map[pkey] = []
            for m_title, m_desc, sort_idx, start_off, end_off, m_status in milestone_templates:
                m = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == p.id, ProjectMilestone.name == m_title).first()
                if not m:
                    m = ProjectMilestone(
                        project_id=p.id,
                        name=m_title,
                        description=m_desc,
                        status=m_status,
                        sort_order=sort_idx,
                        planned_start_date=today + timedelta(days=start_off),
                        planned_end_date=today + timedelta(days=end_off),
                        actual_start_date=today + timedelta(days=start_off) if m_status != "pending" else None,
                        actual_end_date=today + timedelta(days=end_off) if m_status == "completed" else None,
                        planned_hours=300.0,
                        planned_budget=75000.0,
                        planned_progress=100.0 if m_status == "completed" else (50.0 if m_status == "in_progress" else 0.0),
                    )
                    db.add(m)
                    db.flush()

                # Deliverables
                for d_title, d_desc in deliverable_templates.get(sort_idx, []):
                    d = db.query(ProjectDeliverable).filter(ProjectDeliverable.milestone_id == m.id, ProjectDeliverable.title == d_title).first()
                    if not d:
                        d = ProjectDeliverable(
                            milestone_id=m.id,
                            title=d_title,
                            description=d_desc,
                            status=m_status,
                            planned_completion_date=today + timedelta(days=end_off),
                            actual_completion_date=today + timedelta(days=end_off) if m_status == "completed" else None,
                        )
                        db.add(d)

                project_milestones_map[pkey].append(m)

        db.flush()

        # -------------------------------------------------------------
        # 9. MILESTONE DEPENDENCIES (Requirements -> Design -> Dev -> QA)
        # -------------------------------------------------------------
        for pkey, m_list in project_milestones_map.items():
            for i in range(len(m_list) - 1):
                pred = m_list[i]
                succ = m_list[i + 1]
                dep = db.query(ProjectMilestoneDependency).filter(
                    ProjectMilestoneDependency.predecessor_milestone_id == pred.id,
                    ProjectMilestoneDependency.successor_milestone_id == succ.id,
                ).first()
                if not dep:
                    dep = ProjectMilestoneDependency(
                        predecessor_milestone_id=pred.id,
                        successor_milestone_id=succ.id,
                        dependency_type="finish_to_start",
                    )
                    db.add(dep)

        db.flush()

        # -------------------------------------------------------------
        # 10. WORKFLOW STAGES & ISSUE STATUSES
        # -------------------------------------------------------------
        for pkey, p in projects_map.items():
            stages_data = [
                ("In Progress", "in_progress", "#3B82F6", 0, True, False),
                ("In Revision", "review", "#F59E0B", 1, False, False),
                ("Done", "done", "#10B981", 2, False, True),
            ]
            for s_name, s_cat, s_color, s_pos, is_init, is_fin in stages_data:
                stg = db.query(WorkflowStage).filter(WorkflowStage.project_id == p.id, WorkflowStage.name == s_name).first()
                if not stg:
                    stg = WorkflowStage(
                        project_id=p.id,
                        name=s_name,
                        slug=s_name.lower().replace(" ", "_"),
                        category=s_cat,
                        color=s_color,
                        position=s_pos,
                        is_initial=is_init,
                        is_final=is_fin,
                        is_active=True,
                    )
                    db.add(stg)

                ist = db.query(IssueStatus).filter(IssueStatus.project_id == p.id, IssueStatus.name == s_name).first()
                if not ist:
                    ist = IssueStatus(
                        project_id=p.id,
                        name=s_name,
                        category=s_cat,
                        color=s_color,
                        position=s_pos,
                    )
                    db.add(ist)

        db.flush()

        # -------------------------------------------------------------
        # 11. ISSUES & TIME LOGS (~5 Issues per project)
        # -------------------------------------------------------------
        dev_res_alex = user_resource_map["alex.be@operationhub.com"][1]
        dev_res_elena = user_resource_map["elena.fe@operationhub.com"][1]
        dev_res_marcus = user_resource_map["marcus.be@operationhub.com"][1]

        issues_seed_data = [
            ("Setup Database Schema & Migrations", "Design core models and Alembic scripts", "Done", "High", 5, 20.0, dev_res_alex),
            ("Build Authentication API & JWT Tokens", "Security endpoints and password hashing", "Done", "High", 8, 32.0, dev_res_alex),
            ("Implement Planning Intelligence Endpoint", "Calculate schedule & budget variance", "In Progress", "High", 13, 45.0, dev_res_marcus),
            ("Design Plan vs Actual Dashboard UI", "React components and executive charts", "In Revision", "Medium", 8, 30.0, dev_res_elena),
            ("Write Automated Integration Tests", "Pytest suite for workflows & planning", "In Progress", "Medium", 5, 25.0, dev_res_alex),
        ]

        # Issue Priorities
        prio_map = {}
        for pname in ["High", "Medium", "Low"]:
            pr = db.query(IssuePriority).filter(IssuePriority.name == pname).first()
            if not pr:
                pr = IssuePriority(name=pname, level=3 if pname == "High" else (2 if pname == "Medium" else 1))
                db.add(pr)
                db.flush()
            prio_map[pname] = pr

        for pkey, p in projects_map.items():
            in_prog_status = db.query(IssueStatus).filter(IssueStatus.project_id == p.id, IssueStatus.name == "In Progress").first()
            done_status = db.query(IssueStatus).filter(IssueStatus.project_id == p.id, IssueStatus.name == "Done").first()
            in_rev_status = db.query(IssueStatus).filter(IssueStatus.project_id == p.id, IssueStatus.name == "In Revision").first()

            status_lookup = {
                "In Progress": in_prog_status,
                "In Revision": in_rev_status,
                "Done": done_status,
            }

            m_list = project_milestones_map[pkey]
            target_milestone = m_list[2] if len(m_list) > 2 else m_list[0]
            delivs = db.query(ProjectDeliverable).filter(ProjectDeliverable.milestone_id == target_milestone.id).all()
            target_deliv = delivs[0] if delivs else None

            for idx, (title, desc, status_name, prio, pts, est_hrs, assignee_res) in enumerate(issues_seed_data):
                issue_key = f"{p.key}-{idx+1}"
                issue = db.query(Issue).filter(Issue.project_id == p.id, Issue.title == title).first()
                st_row = status_lookup.get(status_name, in_prog_status)
                pr_row = prio_map.get(prio)

                if not issue:
                    issue = Issue(
                        project_id=p.id,
                        milestone_id=target_milestone.id,
                        deliverable_id=target_deliv.id if target_deliv else None,
                        issue_status_id=st_row.id if st_row else None,
                        issue_priority_id=pr_row.id if pr_row else None,
                        assignee_id=assignee_res.user_id,
                        title=title,
                        description=desc,
                        story_points=pts,
                        estimated_hours=est_hrs,
                        due_date=datetime.now(timezone.utc) + timedelta(days=15),
                    )
                    db.add(issue)
                    db.flush()

                # Add Time Logs for every issue
                log_exists = db.query(TimeLog).filter(TimeLog.issue_id == issue.id).first()
                if not log_exists:
                    tl = TimeLog(
                        issue_id=issue.id,
                        user_id=assignee_res.user_id,
                        duration_minutes=int((est_hrs * 0.8) * 60),
                        description=f"Completed sprint tasks for {title}",
                        logged_at=datetime.now(timezone.utc),
                        billable=True,
                        rate=assignee_res.cost_per_hour,
                        approved=True,
                    )
                    db.add(tl)

        db.flush()

        # -------------------------------------------------------------
        # 12. RISKS (3 Risks per project)
        # -------------------------------------------------------------
        risks_data = [
            ("Scope Creep in Third Party Integration", "High requirement ambiguity from client", 3, 4, "mitigated"),
            ("Resource Availability Bottleneck", "Senior backend developer allocated on dual projects", 4, 3, "active"),
            ("Deployment Delay in Staging Environment", "Cloud infrastructure provisioning delay", 2, 3, "identified"),
        ]

        for pkey, p in projects_map.items():
            for title, desc, prob, imp, r_status in risks_data:
                rk = db.query(Risk).filter(Risk.project_id == p.id, Risk.title == title).first()
                if not rk:
                    rk = Risk(
                        project_id=p.id,
                        title=title,
                        description=desc,
                        probability=prob,
                        impact=imp,
                        risk_score=prob * imp,
                        severity="High" if prob * imp >= 12 else "Medium",
                        status=r_status,
                        owner_user_id=pm_user.id,
                    )
                    db.add(rk)

        db.flush()

        # -------------------------------------------------------------
        # 13. BUDGET EXPENSES
        # -------------------------------------------------------------
        for pkey, p in projects_map.items():
            exp_check = db.query(Expense).filter(Expense.project_id == p.id).first()
            if not exp_check:
                db.add(Expense(project_id=p.id, name="Infrastructure & Cloud Hosting", amount=12000.0, date=today - timedelta(days=15)))
                db.add(Expense(project_id=p.id, name="Third-Party Software Licenses", amount=8500.0, date=today - timedelta(days=10)))

        db.flush()

        # -------------------------------------------------------------
        # 14. DOCUMENTS
        # -------------------------------------------------------------
        for pkey, p in projects_map.items():
            doc_check = db.query(ProjectDocument).filter(ProjectDocument.project_id == p.id).first()
            if not doc_check:
                db.add(ProjectDocument(project_id=p.id, name=f"{p.name} — Architecture Blueprint", original_name=f"{p.key}_blueprint.pdf", category="specification", file_path=f"/docs/{p.key}_blueprint.pdf", uploaded_by=pm_user.id))
                db.add(ProjectDocument(project_id=p.id, name=f"{p.name} — Master Service Agreement", original_name=f"{p.key}_msa.pdf", category="contract", file_path=f"/docs/{p.key}_msa.pdf", uploaded_by=pm_user.id))

        db.commit()
        print("Operation Hub Enterprise Demo Data Seeded Successfully!")
        print("Summary of Seeded Entities:")
        print(f"   - Users: {db.query(User).count()}")
        print(f"   - Resources: {db.query(Resource).count()}")
        print(f"   - Clients: {db.query(Client).count()}")
        print(f"   - Projects: {db.query(Project).count()}")
        print(f"   - Planning Baselines: {db.query(ProjectPlanningBaseline).count()}")
        print(f"   - Milestones: {db.query(ProjectMilestone).count()}")
        print(f"   - Deliverables: {db.query(ProjectDeliverable).count()}")
        print(f"   - Dependencies: {db.query(ProjectMilestoneDependency).count()}")
        print(f"   - Issues: {db.query(Issue).count()}")
        print(f"   - Time Logs: {db.query(TimeLog).count()}")
        print(f"   - Risks: {db.query(Risk).count()}")

    except Exception as e:
        db.rollback()
        print("Error seeding demo data:", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
