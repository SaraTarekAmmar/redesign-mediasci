"""
Operation Hub — Initial Database Seeder

Seeds default roles, permissions, department, and sample test accounts into the database.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from app.database import SessionLocal, Base, engine
from app.models.user import User, Role, Permission, user_roles_table, role_has_permissions
from app.models.team import Department, Team
from app.models.client import Client
from app.models.project import Project
from app.models.issue import IssueType, IssueStatus, IssuePriority
from app.security import hash_password

logger = logging.getLogger("operation_hub.seeder")


ROLES = [
    "super-admin",
    "admin",
    "project-manager",
    "team-leader",
    "developer",
    "member",
    "viewer",
    "account-manager",
    "department-manager",
    "hr-manager",
    "reviewer",
    "executive",
    "partner",
    "client",
]

DEFAULT_USERS = [
    {
        "name": "Super Admin User",
        "email": "superadmin@taskflow.dev",
        "password": "password",
        "role": "super-admin",
    },
    {
        "name": "Project Admin",
        "email": "admin@taskflow.dev",
        "password": "password",
        "role": "admin",
    },
    {
        "name": "Team Leader",
        "email": "leader@taskflow.dev",
        "password": "password",
        "role": "team-leader",
    },
    {
        "name": "Developer One",
        "email": "dev1@taskflow.dev",
        "password": "password",
        "role": "developer",
    },
]


def seed_database():
    db = SessionLocal()
    try:
        # 1. Seed Roles
        role_map = {}
        for role_name in ROLES:
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(name=role_name, guard_name="web")
                db.add(role)
                db.flush()
            role_map[role_name] = role

        # 2. Seed Default Department
        dept = db.query(Department).filter(Department.name == "Engineering").first()
        if not dept:
            dept = Department(name="Engineering", description="Engineering & Software Development")
            db.add(dept)
            db.flush()

        # 3. Seed Default Issue Types, Statuses, Priorities
        default_types = [("Task", "check", "#4F46E5"), ("Bug", "bug", "#EF4444"), ("Story", "book", "#10B981"), ("Epic", "zap", "#8B5CF6")]
        for name, icon, color in default_types:
            if not db.query(IssueType).filter(IssueType.name == name).first():
                db.add(IssueType(name=name, icon=icon, color=color))

        default_statuses = [("To Do", "todo", "#6B7280", 1), ("In Progress", "in_progress", "#3B82F6", 2), ("Review", "review", "#F59E0B", 3), ("Done", "done", "#10B981", 4)]
        for name, category, color, pos in default_statuses:
            if not db.query(IssueStatus).filter(IssueStatus.name == name).first():
                db.add(IssueStatus(name=name, category=category, color=color, position=pos))

        default_priorities = [("Low", "arrow-down", "#3B82F6", 1), ("Medium", "minus", "#F59E0B", 2), ("High", "arrow-up", "#EF4444", 3), ("Critical", "alert", "#7C3AED", 4)]
        for name, icon, color, level in default_priorities:
            if not db.query(IssuePriority).filter(IssuePriority.name == name).first():
                db.add(IssuePriority(name=name, icon=icon, color=color, level=level))

        # 4. Seed Default Users
        for user_data in DEFAULT_USERS:
            user = db.query(User).filter(User.email == user_data["email"]).first()
            if not user:
                user = User(
                    name=user_data["name"],
                    email=user_data["email"],
                    password=hash_password(user_data["password"]),
                    is_active=True,
                    department_id=dept.id,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(user)
                db.flush()

                # Assign Role
                role_obj = role_map.get(user_data["role"])
                if role_obj:
                    db.execute(
                        user_roles_table.insert().values(
                            role_id=role_obj.id,
                            model_type="App\\Models\\User",
                            model_id=user.id,
                        )
                    )

        # 5. Seed Default Teams
        super_admin = db.query(User).filter(User.email == "superadmin@taskflow.dev").first()
        team_leader = db.query(User).filter(User.email == "leader@taskflow.dev").first()
        default_teams = [
            ("Backend Team", "Backend services and APIs", super_admin.id if super_admin else None),
            ("Frontend Team", "React UI and client apps", team_leader.id if team_leader else None),
            ("QA Team", "Testing and release validation", super_admin.id if super_admin else None),
        ]
        for name, description, owner_id in default_teams:
            team = db.query(Team).filter(Team.name == name, Team.deleted_at.is_(None)).first()
            if not team:
                team = Team(
                    name=name,
                    slug=name.lower().replace(" ", "-"),
                    description=description,
                    department_id=dept.id,
                    owner_id=owner_id,
                    is_active=True,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(team)

        # 6. Seed Default Client
        client = db.query(Client).filter(Client.name == "Demo Client", Client.deleted_at.is_(None)).first()
        if not client:
            client = Client(
                name="Demo Client",
                company="Demo Client",
                email="demo@taskflow.dev",
                status="active",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(client)
            db.flush()

        # 7. Seed Default Demo Project
        project = db.query(Project).filter(Project.key == "DEMO").first()
        if not project:
            admin_user = db.query(User).filter(User.email == "superadmin@taskflow.dev").first()
            project = Project(
                name="Demo Project",
                key="DEMO",
                description="Initial demo project for Operation Hub",
                status="active",
                owner_id=admin_user.id if admin_user else 1,
                client_id=client.id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(project)

        db.commit()
        print("Database seeded successfully with default roles, department, users, teams, and demo project.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
