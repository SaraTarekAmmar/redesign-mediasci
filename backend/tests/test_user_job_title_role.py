"""
User Administration — Job Title / Role == existing RBAC role.

Job Title is the business-facing role. It must:
  - persist to users.job_title
  - map to existing roles / model_has_roles
  - drive effective permissions

Resource, team, and project assignment must not mutate authorization.
"""
from datetime import datetime, timezone

from app.models.resource import Resource
from app.models.user import Role, User, project_members, team_user, user_roles_table
from app.modules.auth.service import get_user_permissions, get_user_roles
from app.security import create_access_token, hash_password


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _roles_in_db(db, user_id: int) -> set[str]:
    rows = (
        db.query(Role.name)
        .join(user_roles_table, user_roles_table.c.role_id == Role.id)
        .filter(
            user_roles_table.c.model_id == user_id,
            user_roles_table.c.model_type.like("%User"),
        )
        .all()
    )
    return {r[0] for r in rows}


def _ensure_role(db, role_name: str) -> Role:
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        role = Role(name=role_name, guard_name="web")
        db.add(role)
        db.flush()
    return role


def _plain_admin(db) -> tuple[User, str]:
    _ensure_role(db, "admin")
    user = User(
        name="Plain Admin Actor JT",
        email=f"plain.admin.jt.{datetime.now(timezone.utc).timestamp()}@example.com",
        password=hash_password("adminpassword"),
        is_active=True,
    )
    db.add(user)
    db.flush()
    role = db.query(Role).filter(Role.name == "admin").first()
    db.execute(
        user_roles_table.insert().values(
            role_id=role.id,
            model_type="App\\Models\\User",
            model_id=user.id,
        )
    )
    db.flush()
    return user, create_access_token({"sub": str(user.id)})


def _create_project(client, admin_token: str, name: str) -> dict:
    response = client.post("/api/projects", json={"name": name}, headers=_auth(admin_token))
    assert response.status_code == 201, response.text
    return response.json()


def _email(prefix: str) -> str:
    return f"{prefix}.{datetime.now(timezone.utc).timestamp()}@company.com"


# ── 1. Create Developer ────────────────────────────────────────────────────

def test_create_developer_sets_job_title_and_rbac(client, db, admin_token):
    email = _email("ahmed.developer")
    res = client.post(
        "/api/admin/users",
        json={
            "name": "Ahmed Hassan",
            "email": email,
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["role"] == "developer"
    assert body["job_title"] == "Developer"

    user_id = int(body["id"])
    user = db.query(User).filter(User.id == user_id).first()
    assert user.job_title == "Developer"
    assert _roles_in_db(db, user_id) == {"developer"}

    perms = set(get_user_permissions(user_id, db))
    assert "manage-users" not in perms
    assert "manage-departments" not in perms


def test_create_via_job_title_alias(client, db, admin_token):
    """job_title alone is accepted as the unified Job Title / Role."""
    email = _email("ahmed.via.jobtitle")
    res = client.post(
        "/api/admin/users",
        json={
            "name": "Ahmed Hassan",
            "email": email,
            "password": "securepass1",
            "job_title": "Developer",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code == 201, res.text
    user_id = int(res.json()["id"])
    assert res.json()["job_title"] == "Developer"
    assert res.json()["role"] == "developer"
    assert _roles_in_db(db, user_id) == {"developer"}


# ── 2. Create Admin ────────────────────────────────────────────────────────

def test_create_admin_sets_job_title_and_rbac(client, db, admin_token):
    email = _email("sara.admin")
    res = client.post(
        "/api/admin/users",
        json={
            "name": "Sara Admin",
            "email": email,
            "password": "securepass1",
            "role": "admin",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code == 201, res.text
    user_id = int(res.json()["id"])
    assert res.json()["job_title"] == "Admin"
    assert res.json()["role"] == "admin"
    assert _roles_in_db(db, user_id) == {"admin"}

    perms = set(get_user_permissions(user_id, db))
    assert "manage-users" in perms


# ── 3. Super Admin escalation ──────────────────────────────────────────────

def test_admin_cannot_assign_super_admin(client, db):
    _admin, token = _plain_admin(db)
    email = _email("escalation")
    res = client.post(
        "/api/admin/users",
        json={
            "name": "Escalation",
            "email": email,
            "password": "securepass1",
            "role": "super-admin",
        },
        headers=_auth(token),
    )
    assert res.status_code == 403, res.text
    assert db.query(User).filter(User.email == email).first() is None


def test_super_admin_can_assign_super_admin(client, db, admin_token):
    email = _email("new.super")
    res = client.post(
        "/api/admin/users",
        json={
            "name": "New Super",
            "email": email,
            "password": "securepass1",
            "role": "super-admin",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code == 201, res.text
    assert res.json()["job_title"] == "Super Admin"
    assert _roles_in_db(db, int(res.json()["id"])) == {"super-admin"}


# ── 4. Invalid / missing Job Title ─────────────────────────────────────────

def test_invalid_job_title_rejected(client, db, admin_token):
    email = _email("invalid.title")
    res = client.post(
        "/api/admin/users",
        json={
            "name": "Bad Title",
            "email": email,
            "password": "securepass1",
            "role": "NonexistentRole",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code in (400, 422), res.text
    assert db.query(User).filter(User.email == email).first() is None


def test_missing_job_title_role_rejected(client, db, admin_token):
    email = _email("missing.role")
    res = client.post(
        "/api/admin/users",
        json={
            "name": "No Role",
            "email": email,
            "password": "securepass1",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code in (400, 422), res.text
    assert db.query(User).filter(User.email == email).first() is None


def test_no_department_required_on_create(client, db, admin_token):
    email = _email("no.dept")
    res = client.post(
        "/api/admin/users",
        json={
            "name": "No Dept",
            "email": email,
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code == 201, res.text
    user = db.query(User).filter(User.id == int(res.json()["id"])).first()
    assert user.department_id is None
    assert user.job_title == "Developer"


# ── 5. Edit Developer → Team Leader ────────────────────────────────────────

def test_edit_role_updates_job_title_and_rbac(client, db, admin_token):
    create = client.post(
        "/api/admin/users",
        json={
            "name": "Role Edit",
            "email": _email("role.edit"),
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    assert create.status_code == 201, create.text
    user_id = int(create.json()["id"])
    before_perms = set(get_user_permissions(user_id, db))

    update = client.put(
        f"/api/admin/users/{user_id}",
        json={"role": "team-leader"},
        headers=_auth(admin_token),
    )
    assert update.status_code == 200, update.text
    assert update.json()["role"] == "team-leader"
    assert update.json()["job_title"] == "Team Leader"

    assert _roles_in_db(db, user_id) == {"team-leader"}
    user = db.query(User).filter(User.id == user_id).first()
    assert user.job_title == "Team Leader"

    after_perms = set(get_user_permissions(user_id, db))
    assert "manage-teams" in after_perms
    assert after_perms != before_perms or "manage-teams" not in before_perms


def test_edit_via_job_title_field(client, db, admin_token):
    create = client.post(
        "/api/admin/users",
        json={
            "name": "JT Edit",
            "email": _email("jt.edit"),
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    user_id = int(create.json()["id"])
    update = client.put(
        f"/api/admin/users/{user_id}",
        json={"job_title": "Team Leader"},
        headers=_auth(admin_token),
    )
    assert update.status_code == 200, update.text
    assert update.json()["role"] == "team-leader"
    assert update.json()["job_title"] == "Team Leader"
    assert _roles_in_db(db, user_id) == {"team-leader"}


# ── 6. Role edit does not change teams / projects ──────────────────────────

def test_role_edit_preserves_team_and_project_membership(client, db, admin_token):
    from app.models.team import Team

    create = client.post(
        "/api/admin/users",
        json={
            "name": "Preserve Membership",
            "email": _email("preserve.mem"),
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    user_id = int(create.json()["id"])

    team = Team(name=f"Team Preserve {datetime.now(timezone.utc).timestamp()}")
    db.add(team)
    db.flush()
    db.execute(
        team_user.insert().values(
            team_id=team.id,
            user_id=user_id,
            role="member",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
    )
    db.flush()

    project = _create_project(client, admin_token, "Preserve Project")
    add = client.post(
        f"/api/projects/{project['id']}/members",
        json={"user_id": user_id},
        headers=_auth(admin_token),
    )
    assert add.status_code == 201, add.text

    update = client.put(
        f"/api/admin/users/{user_id}",
        json={"role": "team-leader"},
        headers=_auth(admin_token),
    )
    assert update.status_code == 200, update.text

    assert _roles_in_db(db, user_id) == {"team-leader"}
    team_row = db.execute(
        team_user.select().where(
            team_user.c.user_id == user_id,
            team_user.c.team_id == team.id,
        )
    ).first()
    assert team_row is not None

    membership = db.execute(
        project_members.select().where(
            project_members.c.project_id == project["id"],
            project_members.c.user_id == user_id,
        )
    ).first()
    assert membership is not None


# ── 7. Resource isolation ──────────────────────────────────────────────────

def test_resource_update_does_not_change_rbac(client, db, admin_token):
    create = client.post(
        "/api/admin/users",
        json={
            "name": "Resource Iso",
            "email": _email("resource.iso"),
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    user_id = int(create.json()["id"])
    user = db.query(User).filter(User.id == user_id).first()

    resource = Resource(
        user_id=user.id,
        employee_number=f"EMP-JT2-{user.id}",
        name=user.name,
        email=user.email,
        position="Developer",
        seniority="Mid",
        weekly_capacity=40.0,
        availability_status="available",
        is_active=1,
    )
    db.add(resource)
    db.flush()

    update = client.put(
        f"/api/resources/{resource.id}",
        json={"position": "Lead", "weekly_capacity": 32.0},
        headers=_auth(admin_token),
    )
    assert update.status_code == 200, update.text
    assert _roles_in_db(db, user_id) == {"developer"}
    db.refresh(user)
    assert user.job_title == "Developer"


# ── 8. Project isolation ───────────────────────────────────────────────────

def test_project_assignment_does_not_change_rbac(client, db, admin_token):
    create = client.post(
        "/api/admin/users",
        json={
            "name": "Project Iso",
            "email": _email("project.iso"),
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    user_id = int(create.json()["id"])
    user_token = create_access_token({"sub": str(user_id)})

    alpha = _create_project(client, admin_token, "Alpha JT2")
    beta = _create_project(client, admin_token, "Beta JT2")

    add = client.post(
        f"/api/projects/{alpha['id']}/members",
        json={"user_id": user_id},
        headers=_auth(admin_token),
    )
    assert add.status_code == 201, add.text

    visible = {
        p["id"]
        for p in client.get("/api/projects", headers=_auth(user_token)).json()["data"]
    }
    assert alpha["id"] in visible
    assert beta["id"] not in visible
    assert _roles_in_db(db, user_id) == {"developer"}
    assert db.query(User).filter(User.id == user_id).first().job_title == "Developer"


# ── 9. Existing users remain valid ─────────────────────────────────────────

def test_existing_admin_login_still_works(client, db, admin_token):
    """Seeded Super Admin continues to authenticate and list users."""
    me = client.get("/api/auth/me", headers=_auth(admin_token))
    assert me.status_code == 200, me.text
    listing = client.get("/api/admin/users", headers=_auth(admin_token))
    assert listing.status_code == 200, listing.text
