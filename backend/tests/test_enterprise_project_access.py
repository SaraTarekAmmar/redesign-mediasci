"""Security-focused acceptance tests for enterprise project access and workforce."""
from datetime import datetime, timezone

from app.models.client import Client, ClientRequest, Proposal
from app.models.project import Project
from app.models.resource import Resource
from app.models.team import Team
from app.models.user import Permission, Role, User, model_has_permissions, project_members, team_user, user_roles_table
from app.security import create_access_token, hash_password


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _user_with_role(db, *, name: str, email: str, role_name: str = "member") -> tuple[User, str]:
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        role = Role(name=role_name, guard_name="web")
        db.add(role)
        db.flush()
    user = User(name=name, email=email, password=hash_password("testpassword"), is_active=True)
    db.add(user)
    db.flush()
    db.execute(user_roles_table.insert().values(
        role_id=role.id,
        model_type="App\\Models\\User",
        model_id=user.id,
    ))
    db.flush()
    return user, create_access_token({"sub": str(user.id)})


def _create_project(client, admin_token: str, name: str) -> dict:
    response = client.post("/api/projects", json={"name": name}, headers=_auth(admin_token))
    assert response.status_code == 201, response.text
    return response.json()


def _grant_permission(db, user_id: int, permission_name: str) -> None:
    permission = db.query(Permission).filter(Permission.name == permission_name).first()
    if not permission:
        permission = Permission(name=permission_name, guard_name="web")
        db.add(permission)
        db.flush()
    db.execute(model_has_permissions.insert().values(
        permission_id=permission.id,
        model_type="App\\Models\\User",
        model_id=user_id,
    ))
    db.flush()


def test_team_assignment_grants_only_that_project(client, db, admin_token):
    assigned = _create_project(client, admin_token, "Team Visible Project")
    hidden = _create_project(client, admin_token, "Team Hidden Project")
    user, token = _user_with_role(db, name="Scoped Developer", email="scoped.developer@example.com")
    team = Team(name="Scoped Delivery Team", is_active=True)
    db.add(team)
    db.flush()
    db.execute(team_user.insert().values(
        team_id=team.id,
        user_id=user.id,
        role="member",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    ))
    db.flush()

    response = client.post(
        f"/api/projects/{assigned['id']}/teams",
        json={"team_id": team.id},
        headers=_auth(admin_token),
    )
    assert response.status_code == 201, response.text

    visible_ids = {
        project["id"]
        for project in client.get("/api/projects", headers=_auth(token)).json()["data"]
    }
    assert assigned["id"] in visible_ids
    assert hidden["id"] not in visible_ids
    assert client.get(f"/api/projects/{assigned['id']}", headers=_auth(token)).status_code == 200
    assert client.get(f"/api/projects/{hidden['id']}", headers=_auth(token)).status_code == 403


def test_non_admin_cannot_use_admin_or_project_admin_surfaces(client, db, admin_token):
    project = _create_project(client, admin_token, "Admin Guard Project")
    _user, token = _user_with_role(db, name="Project Manager", email="pm.guard@example.com", role_name="project-manager")

    assert client.get("/api/admin/users", headers=_auth(token)).status_code == 403
    assert client.post("/api/projects", json={"name": "Forbidden"}, headers=_auth(token)).status_code == 403
    assert client.post(
        f"/api/projects/{project['id']}/members",
        json={"user_id": _user.id},
        headers=_auth(token),
    ).status_code == 403
    assert client.get("/api/partners", headers=_auth(token)).status_code == 403


def test_direct_resource_assignment_grants_access_and_is_reversible(client, db, admin_token):
    project = _create_project(client, admin_token, "Direct Resource Project")
    user, token = _user_with_role(db, name="Direct Resource", email="direct.resource@example.com")
    resource = Resource(
        user_id=user.id,
        name=user.name,
        email=user.email,
        position="Architect",
        is_active=1,
    )
    db.add(resource)
    db.flush()

    response = client.post(
        f"/api/projects/{project['id']}/resources",
        json={"resource_id": resource.id, "allocation_pct": 75},
        headers=_auth(admin_token),
    )
    assert response.status_code == 201, response.text
    assignment = response.json()
    assert client.get(f"/api/projects/{project['id']}", headers=_auth(token)).status_code == 200

    workforce = client.get(
        f"/api/projects/{project['id']}/workforce",
        headers=_auth(admin_token),
    ).json()
    entry = next(item for item in workforce["internal"] if item["user_id"] == user.id)
    assert entry["is_direct_resource"] is True

    assert client.delete(
        f"/api/projects/{project['id']}/resources/{assignment['id']}",
        headers=_auth(admin_token),
    ).status_code == 200
    assert client.get(f"/api/projects/{project['id']}", headers=_auth(token)).status_code == 403


def test_selective_partner_team_and_member_assignment(client, db, admin_token):
    project = _create_project(client, admin_token, "Selective Partner Project")
    partner = client.post(
        "/api/partners",
        json={"name": "Selective Partner"},
        headers=_auth(admin_token),
    ).json()
    linked_user, linked_token = _user_with_role(
        db,
        name="Linked Consultant",
        email="linked.consultant@example.com",
    )
    selected = client.post(
        f"/api/partners/{partner['id']}/members",
        json={"name": "Selected Consultant", "user_id": linked_user.id},
        headers=_auth(admin_token),
    ).json()
    unrelated = client.post(
        f"/api/partners/{partner['id']}/members",
        json={"name": "Unrelated Consultant"},
        headers=_auth(admin_token),
    ).json()
    partner_team = client.post(
        f"/api/partners/{partner['id']}/teams",
        json={"name": "Selected Team", "member_ids": [selected["id"]]},
        headers=_auth(admin_token),
    )
    assert partner_team.status_code == 201, partner_team.text

    assert client.post(
        f"/api/projects/{project['id']}/partner-teams",
        json={"partner_team_id": partner_team.json()["id"]},
        headers=_auth(admin_token),
    ).status_code == 201

    workforce = client.get(
        f"/api/projects/{project['id']}/workforce",
        headers=_auth(admin_token),
    ).json()
    external_ids = {item["member_id"] for item in workforce["external"]}
    assert selected["id"] in external_ids
    assert unrelated["id"] not in external_ids
    assert client.get(f"/api/projects/{project['id']}", headers=_auth(linked_token)).status_code == 200

    eligible = client.post(
        f"/api/projects/{project['id']}/issues",
        json={"title": "Eligible external task", "external_assignee_id": selected["id"]},
        headers=_auth(admin_token),
    )
    assert eligible.status_code == 201, eligible.text
    rejected = client.post(
        f"/api/projects/{project['id']}/issues",
        json={"title": "Unrelated external task", "external_assignee_id": unrelated["id"]},
        headers=_auth(admin_token),
    )
    assert rejected.status_code == 422


def test_admin_role_bypasses_project_filter(client, db, admin_token):
    first = _create_project(client, admin_token, "Admin Visibility One")
    second = _create_project(client, admin_token, "Admin Visibility Two")
    _admin, token = _user_with_role(db, name="Plain Admin", email="plain.admin@example.com", role_name="admin")
    response = client.get("/api/projects", headers=_auth(token))
    assert response.status_code == 200
    ids = {project["id"] for project in response.json()["data"]}
    assert {first["id"], second["id"]}.issubset(ids)


def test_member_cannot_access_global_resources_or_proposals(client, member_token):
    assert client.get("/api/resources", headers=_auth(member_token)).status_code == 403
    assert client.get("/api/resources/1", headers=_auth(member_token)).status_code == 403
    assert client.get("/api/proposals", headers=_auth(member_token)).status_code == 403
    assert client.get("/api/rfps", headers=_auth(member_token)).status_code == 403


def test_proposals_follow_project_visibility_and_assignment_changes(client, db, admin_token):
    client_record = Client(name="Proposal Scope Client", company="Proposal Scope Co")
    db.add(client_record)
    db.flush()

    request_record = ClientRequest(
        client_id=client_record.id,
        title="Proposal Scope Request",
        status="open",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(request_record)
    db.flush()

    project = _create_project(
        client,
        admin_token,
        "Proposal Scope Project",
    )
    project_row = db.query(Project).filter(Project.id == project["id"]).first()
    project_row.client_request_id = request_record.id
    request_record.project = project_row
    db.flush()

    proposal_response = client.post(
        "/api/proposals",
        json={
            "client_request_id": request_record.id,
            "title": "Scoped Proposal",
            "status": "draft",
        },
        headers=_auth(admin_token),
    )
    assert proposal_response.status_code == 201, proposal_response.text
    proposal = proposal_response.json()

    proposal_row = db.query(Proposal).filter(Proposal.id == proposal["id"]).first()
    assert proposal_row is not None
    assert proposal_row.project_id == project_row.id

    viewer, viewer_token = _user_with_role(
        db,
        name="Client Viewer",
        email="client.viewer@example.com",
    )
    _grant_permission(db, viewer.id, "view-clients")

    assert client.get(f"/api/projects/{project_row.id}", headers=_auth(viewer_token)).status_code == 403

    proposals_response = client.get("/api/proposals", headers=_auth(viewer_token))
    assert proposals_response.status_code == 200, proposals_response.text
    assert proposal["id"] not in {item["id"] for item in proposals_response.json()["data"]}
    assert client.get(f"/api/proposals/{proposal['id']}", headers=_auth(viewer_token)).status_code == 403

    db.execute(project_members.insert().values(
        project_id=project_row.id,
        user_id=viewer.id,
        role="member",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    ))
    db.flush()

    assert client.get(f"/api/projects/{project_row.id}", headers=_auth(viewer_token)).status_code == 200
    proposals_response = client.get("/api/proposals", headers=_auth(viewer_token))
    assert proposal["id"] in {item["id"] for item in proposals_response.json()["data"]}
    assert client.get(f"/api/proposals/{proposal['id']}", headers=_auth(viewer_token)).status_code == 200
