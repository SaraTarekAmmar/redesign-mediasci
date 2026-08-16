import pytest


def test_time_tracking_flow(client, admin_token):
    # Create project first
    proj_resp = client.post(
        "/api/projects",
        json={"name": "Time Track Project", "key": "TTP", "status": "active"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    project_id = proj_resp.json()["id"]

    # Store issue
    issue_resp = client.post(
        f"/api/projects/{project_id}/issues",
        json={"title": "Time Track test issue"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    issue_id = issue_resp.json()["id"]

    # Create time log
    log_resp = client.post(
        "/api/time-logs",
        json={
            "hours": 2.5,
            "description": "Working on initial setup"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert log_resp.status_code == 201
    log_data = log_resp.json()
    assert log_data["hours"] == 2.5

    # List time logs
    list_resp = client.get("/api/time-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert list_data["total"] >= 1
