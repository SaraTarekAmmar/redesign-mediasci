"""
User Administration — global RBAC role assignment.

Verifies that create/update persists roles in model_has_roles (the auth source
of truth), that Admin cannot escalate to Super Admin, and that Resource /
Project assignment do not mutate global roles.
"""
from datetime import datetime, timezone

from app.models.resource import Resource
from app.models.user import Role, User, project_members, user_roles_table
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
    """Admin (not super-admin) with manage-users via role fallbacks."""
    _ensure_role(db, "admin")
    user = User(
        name="Plain Admin Actor",
        email=f"plain.admin.actor.{datetime.now(timezone.utc).timestamp()}@example.com",
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


def test_create_user_with_developer_role(client, db, admin_token):
    """Test 1 — Admin/Super Admin creates Ahmed as Developer."""
    payload = {
        "name": "Ahmed Hassan",
        "email": f"ahmed.developer.{datetime.now(timezone.utc).timestamp()}@company.com",
        "password": "securepass1",
        "role": "developer",
    }
    res = client.post("/api/admin/users", json=payload, headers=_auth(admin_token))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["role"] == "developer"
    assert body["job_title"] == "Developer"
    assert body["email"] == payload["email"]

    user_id = int(body["id"])
    db_roles = _roles_in_db(db, user_id)
    assert db_roles == {"developer"}
    assert db.query(User).filter(User.id == user_id).first().job_title == "Developer"

    # Effective permissions must come from Developer, not Admin/Super Admin.
    perms = set(get_user_permissions(user_id, db))
    assert "manage-users" not in perms
    assert "manage-departments" not in perms


def test_create_user_with_viewer_role(client, db, admin_token):
    """Test 2 — Create Viewer and verify Viewer privileges (no admin surface)."""
    payload = {
        "name": "Sara Viewer",
        "email": f"sara.viewer.{datetime.now(timezone.utc).timestamp()}@company.com",
        "password": "securepass1",
        "role": "viewer",
    }
    res = client.post("/api/admin/users", json=payload, headers=_auth(admin_token))
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["role"] == "viewer"

    user_id = int(body["id"])
    assert _roles_in_db(db, user_id) == {"viewer"}

    # Viewer must not reach administration APIs.
    viewer_token = create_access_token({"sub": str(user_id)})
    denied = client.get("/api/admin/users", headers=_auth(viewer_token))
    assert denied.status_code == 403


def test_create_user_invalid_role_rejected(client, db, admin_token):
    """Test 3 — Nonexistent role is rejected; no user is created."""
    email = f"invalid.role.{datetime.now(timezone.utc).timestamp()}@company.com"
    res = client.post(
        "/api/admin/users",
        json={
            "name": "Bad Role User",
            "email": email,
            "password": "securepass1",
            "role": "nonexistent-role-xyz",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code in (400, 422), res.text
    assert db.query(User).filter(User.email == email).first() is None


def test_create_user_missing_role_rejected(client, db, admin_token):
    """Job Title / Role is required on create."""
    email = f"missing.role.{datetime.now(timezone.utc).timestamp()}@company.com"
    res = client.post(
        "/api/admin/users",
        json={
            "name": "No Role User",
            "email": email,
            "password": "securepass1",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code in (400, 422), res.text
    assert db.query(User).filter(User.email == email).first() is None


def test_admin_cannot_escalate_to_super_admin(client, db):
    """Test 4 — Plain Admin cannot assign Super Admin."""
    _admin_user, admin_token = _plain_admin(db)
    email = f"escalation.{datetime.now(timezone.utc).timestamp()}@company.com"
    res = client.post(
        "/api/admin/users",
        json={
            "name": "Escalation Attempt",
            "email": email,
            "password": "securepass1",
            "role": "super-admin",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code == 403, res.text
    assert db.query(User).filter(User.email == email).first() is None


def test_admin_can_create_developer(client, db):
    """Admin (non-super) can still assign valid non-protected roles."""
    _admin_user, admin_token = _plain_admin(db)
    email = f"admin.creates.dev.{datetime.now(timezone.utc).timestamp()}@company.com"
    res = client.post(
        "/api/admin/users",
        json={
            "name": "Dev By Admin",
            "email": email,
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    assert res.status_code == 201, res.text
    assert res.json()["role"] == "developer"
    assert _roles_in_db(db, int(res.json()["id"])) == {"developer"}


def test_edit_user_role_replaces_assignment(client, db, admin_token):
    """Test 5 — Developer → Team Leader replaces model_has_roles and permissions."""
    create = client.post(
        "/api/admin/users",
        json={
            "name": "Role Edit Target",
            "email": f"role.edit.{datetime.now(timezone.utc).timestamp()}@company.com",
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    assert create.status_code == 201, create.text
    user_id = int(create.json()["id"])
    assert _roles_in_db(db, user_id) == {"developer"}
    before_perms = set(get_user_permissions(user_id, db))

    update = client.put(
        f"/api/admin/users/{user_id}",
        json={"role": "team-leader"},
        headers=_auth(admin_token),
    )
    assert update.status_code == 200, update.text
    assert update.json()["role"] == "team-leader"
    assert update.json()["job_title"] == "Team Leader"

    db_roles = _roles_in_db(db, user_id)
    assert db_roles == {"team-leader"}
    assert "developer" not in db_roles
    assert db.query(User).filter(User.id == user_id).first().job_title == "Team Leader"

    after_perms = set(get_user_permissions(user_id, db))
    # Team Leader gains manage-teams via workforce fallbacks; Developer does not.
    assert "manage-teams" in after_perms
    assert "manage-teams" not in before_perms or after_perms != before_perms


def test_admin_cannot_escalate_on_edit(client, db):
    """Admin cannot promote an existing user to Super Admin on update."""
    _admin_user, admin_token = _plain_admin(db)
    create = client.post(
        "/api/admin/users",
        json={
            "name": "Edit Escalate Target",
            "email": f"edit.escalate.{datetime.now(timezone.utc).timestamp()}@company.com",
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    assert create.status_code == 201, create.text
    user_id = int(create.json()["id"])

    update = client.put(
        f"/api/admin/users/{user_id}",
        json={"role": "super-admin"},
        headers=_auth(admin_token),
    )
    assert update.status_code == 403, update.text
    assert _roles_in_db(db, user_id) == {"developer"}


def test_resource_update_does_not_change_global_role(client, db, admin_token):
    """Test 6 — Resource workforce edits do not mutate global RBAC."""
    create = client.post(
        "/api/admin/users",
        json={
            "name": "Ahmed Resource",
            "email": f"ahmed.resource.{datetime.now(timezone.utc).timestamp()}@company.com",
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    assert create.status_code == 201, create.text
    user_id = int(create.json()["id"])
    user = db.query(User).filter(User.id == user_id).first()

    resource = Resource(
        user_id=user.id,
        employee_number=f"EMP-ROLE-{user.id}",
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
        json={
            "position": "Senior Developer",
            "weekly_capacity": 32.0,
            "availability_status": "busy",
        },
        headers=_auth(admin_token),
    )
    assert update.status_code == 200, update.text
    assert _roles_in_db(db, user_id) == {"developer"}
    assert get_user_roles(user_id, db) == ["developer"]


def test_project_assignment_does_not_change_global_role(client, db, admin_token):
    """Test 7 — Project membership must not alter global role."""
    create = client.post(
        "/api/admin/users",
        json={
            "name": "Ahmed Project",
            "email": f"ahmed.project.{datetime.now(timezone.utc).timestamp()}@company.com",
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    assert create.status_code == 201, create.text
    user_id = int(create.json()["id"])
    project = _create_project(client, admin_token, "Project Alpha Role Guard")

    add = client.post(
        f"/api/projects/{project['id']}/members",
        json={"user_id": user_id, "role": "contributor"},
        headers=_auth(admin_token),
    )
    assert add.status_code == 201, add.text
    assert _roles_in_db(db, user_id) == {"developer"}

    # Project-local role may exist, but global RBAC stays Developer.
    membership = db.execute(
        project_members.select().where(
            project_members.c.project_id == project["id"],
            project_members.c.user_id == user_id,
        )
    ).first()
    assert membership is not None
    assert _roles_in_db(db, user_id) == {"developer"}


def test_project_access_separate_from_global_role(client, db, admin_token):
    """Test 8 — Project visibility follows assignment; global role stays Developer."""
    create = client.post(
        "/api/admin/users",
        json={
            "name": "Ahmed Access",
            "email": f"ahmed.access.{datetime.now(timezone.utc).timestamp()}@company.com",
            "password": "securepass1",
            "role": "developer",
        },
        headers=_auth(admin_token),
    )
    assert create.status_code == 201, create.text
    user_id = int(create.json()["id"])
    user_token = create_access_token({"sub": str(user_id)})

    alpha = _create_project(client, admin_token, "Alpha Access Separate")
    beta = _create_project(client, admin_token, "Beta Access Separate")

    # Before assignment: neither project visible to the developer.
    before = {
        p["id"]
        for p in client.get("/api/projects", headers=_auth(user_token)).json()["data"]
    }
    assert alpha["id"] not in before
    assert beta["id"] not in before

    add = client.post(
        f"/api/projects/{alpha['id']}/members",
        json={"user_id": user_id},
        headers=_auth(admin_token),
    )
    assert add.status_code == 201, add.text

    after_assign = {
        p["id"]
        for p in client.get("/api/projects", headers=_auth(user_token)).json()["data"]
    }
    assert alpha["id"] in after_assign
    assert beta["id"] not in after_assign
    assert _roles_in_db(db, user_id) == {"developer"}

    remove = client.delete(
        f"/api/projects/{alpha['id']}/members/{user_id}",
        headers=_auth(admin_token),
    )
    assert remove.status_code == 200, remove.text

    after_remove = {
        p["id"]
        for p in client.get("/api/projects", headers=_auth(user_token)).json()["data"]
    }
    assert alpha["id"] not in after_remove
    assert _roles_in_db(db, user_id) == {"developer"}


def test_super_admin_can_assign_super_admin(client, db, admin_token):
    """Preserve existing Super Admin behavior for assigning Super Admin."""
    email = f"new.super.{datetime.now(timezone.utc).timestamp()}@company.com"
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
    assert res.json()["role"] == "super-admin"
    assert _roles_in_db(db, int(res.json()["id"])) == {"super-admin"}
