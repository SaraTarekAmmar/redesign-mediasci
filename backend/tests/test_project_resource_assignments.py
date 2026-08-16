import pytest

from app.models.resource import Resource, ResourceAllocation
from app.models.user import User


def _create_resource(db, name: str, email: str) -> Resource:
    user = User(name=name, email=email, password="hashed", is_active=True)
    db.add(user)
    db.flush()
    resource = Resource(user_id=user.id, name=name, email=email, position="Developer", weekly_capacity=40)
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


def _create_project(client, admin_token):
    response = client.post(
        "/api/projects",
        json={"name": "Resource Assignment Project", "key": "RAP", "status": "active"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_list_project_resources_empty(client, admin_token):
    project_id = _create_project(client, admin_token)
    response = client.get(
        f"/api/projects/{project_id}/resources",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json() == []


def test_assign_update_and_remove_project_resource(client, admin_token, db):
    project_id = _create_project(client, admin_token)
    resource = _create_resource(db, "Assignee One", "assignee1@example.com")

    create_resp = client.post(
        f"/api/projects/{project_id}/resources",
        json={
            "resource_id": resource.id,
            "allocation_pct": 50,
            "role": "Tech Lead",
            "start_date": "2026-01-01",
            "end_date": "2026-06-30",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["resource_id"] == resource.id
    assert created["project_id"] == project_id
    assert created["role"] == "Tech Lead"
    assert created["allocation_pct"] == 50

    list_resp = client.get(
        f"/api/projects/{project_id}/resources",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["name"] == "Assignee One"

    assignment_id = created["id"]
    update_resp = client.put(
        f"/api/projects/{project_id}/resources/{assignment_id}",
        json={"allocation_pct": 75, "role": "Senior Developer"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["allocation_pct"] == 75
    assert updated["role"] == "Senior Developer"

    delete_resp = client.delete(
        f"/api/projects/{project_id}/resources/{assignment_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert delete_resp.status_code == 200

    final_list = client.get(
        f"/api/projects/{project_id}/resources",
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()
    assert final_list == []

    remaining = db.query(ResourceAllocation).filter(ResourceAllocation.resource_id == resource.id).all()
    assert remaining == []


def test_prevent_duplicate_project_resource_assignment(client, admin_token, db):
    project_id = _create_project(client, admin_token)
    resource = _create_resource(db, "Assignee Two", "assignee2@example.com")

    first = client.post(
        f"/api/projects/{project_id}/resources",
        json={"resource_id": resource.id, "allocation_pct": 100},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert first.status_code == 201

    duplicate = client.post(
        f"/api/projects/{project_id}/resources",
        json={"resource_id": resource.id, "allocation_pct": 50},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert duplicate.status_code == 409


def test_project_resource_assignment_rbac(client, member_token, admin_token, db):
    project_id = _create_project(client, admin_token)
    resource = _create_resource(db, "Assignee Three", "assignee3@example.com")

    forbidden = client.post(
        f"/api/projects/{project_id}/resources",
        json={"resource_id": resource.id, "allocation_pct": 100},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert forbidden.status_code == 403
