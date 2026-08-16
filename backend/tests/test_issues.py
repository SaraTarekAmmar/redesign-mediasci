import pytest
from app.models.issue import IssueStatus, IssueType, IssuePriority


def test_create_and_update_issue(client, admin_token, db):
    # Seed default types, statuses, priorities to avoid null constraints
    status = IssueStatus(name="To Do", category="todo", position=1)
    issue_type = IssueType(name="Task")
    priority = IssuePriority(name="Medium", color="#ccc")
    db.add_all([status, issue_type, priority])
    db.commit()

    # Create project first
    proj_resp = client.post(
        "/api/projects",
        json={"name": "Issue Test Project", "key": "ITP", "status": "active"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    project_id = proj_resp.json()["id"]

    # Store issue
    issue_resp = client.post(
        f"/api/projects/{project_id}/issues",
        json={
            "title": "Fix critical migration issue",
            "description": "Double check all foreign key indices in the database.",
            "issue_status_id": status.id,
            "issue_type_id": issue_type.id,
            "issue_priority_id": priority.id,
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert issue_resp.status_code == 201
    issue_data = issue_resp.json()
    assert issue_data["title"] == "Fix critical migration issue"
    assert issue_data["key"].startswith("ITP-")

    # Update issue
    issue_id = issue_data["id"]
    update_resp = client.put(
        f"/api/issues/{issue_id}",
        json={
            "title": "Updated critical migration issue",
            "description": "Make sure all MySQL connections are optimized."
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated critical migration issue"

    # Get project stats
    stats_resp = client.get(
        f"/api/projects/{project_id}/stats",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert stats_resp.status_code == 200
    stats_data = stats_resp.json()
    assert stats_data["issues"] == 1
    assert stats_data["open_issues"] == 1
    assert stats_data["completed_issues"] == 0
    assert stats_data["sprints"] == 0
    assert stats_data["members"] == 1
    assert stats_data["risks"] == 0
