import pytest


def test_issue_comments(client, admin_token, db):
    # Create project first
    proj_resp = client.post(
        "/api/projects",
        json={"name": "Comments Project", "key": "CP", "status": "active"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    project_id = proj_resp.json()["id"]

    # Store issue
    issue_resp = client.post(
        f"/api/projects/{project_id}/issues",
        json={"title": "Comment test issue"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    issue_id = issue_resp.json()["id"]

    # Store comment
    comment_resp = client.post(
        f"/api/issues/{issue_id}/comments",
        json={
            "body": "This is a test comment."
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert comment_resp.status_code == 201
    c_data = comment_resp.json()
    assert c_data["body"] == "This is a test comment."
    assert c_data["issue_id"] == issue_id

    # List comments
    list_resp = client.get(f"/api/issues/{issue_id}/comments", headers={"Authorization": f"Bearer {admin_token}"})
    assert list_resp.status_code == 200
    comments = list_resp.json()
    assert len(comments) == 1
    assert comments[0]["body"] == "This is a test comment."
