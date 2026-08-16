import pytest


def test_create_project(client, admin_token):
    response = client.post(
        "/api/projects",
        json={
            "name": "FastAPI Migration Test",
            "key": "FMT",
            "description": "A project built during backend tests.",
            "status": "active"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "FastAPI Migration Test"
    assert data["key"] == "FMT"
    assert "id" in data


def test_list_projects(client, admin_token):
    # Ensure projects list is returned
    response = client.get("/api/projects", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert isinstance(data["data"], list)


def test_get_project_detail(client, admin_token):
    # Create project first
    create_resp = client.post(
        "/api/projects",
        json={
            "name": "Specific Detail Project",
            "key": "SDP",
            "status": "active"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    project_id = create_resp.json()["id"]

    response = client.get(f"/api/projects/{project_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Specific Detail Project"
    assert data["key"] == "SDP"


def test_member_cannot_create_project(client, member_token):
    response = client.post(
        "/api/projects",
        json={
            "name": "Member Project Idea",
            "key": "MPI"
        },
        headers={"Authorization": f"Bearer {member_token}"}
    )
    # Members don't have super-admin, admin, or project-manager roles
    assert response.status_code == 403
