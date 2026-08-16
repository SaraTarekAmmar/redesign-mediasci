"""Triage workflow + frontend contract tests."""

from app.models.issue import Issue, IssueStatus, IssueType, IssuePriority, sprint_issues
from app.models.project import Project
from app.models.sprint import Sprint
from sqlalchemy import select


def _seed_issue_meta(db, project_id):
    status = (
        db.query(IssueStatus)
        .filter(IssueStatus.project_id == project_id, IssueStatus.category == "todo")
        .first()
    )
    if not status:
        status = IssueStatus(name="To Do", category="todo", position=1, project_id=project_id)
        db.add(status)
    issue_type = db.query(IssueType).filter(IssueType.name == "Task").first()
    if not issue_type:
        issue_type = IssueType(name="Task", color="#3b82f6")
        db.add(issue_type)
    priority = db.query(IssuePriority).filter(IssuePriority.name == "Medium").first()
    if not priority:
        priority = IssuePriority(name="Medium", color="#ccc", level=2)
        db.add(priority)
    db.commit()
    return status, issue_type, priority


def _create_project(client, admin_token, key="TRG"):
    resp = client.post(
        "/api/projects",
        json={"name": f"Triage {key}", "key": key, "status": "active"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code in (200, 201)
    return resp.json()["id"]


def test_triage_new_issue_appears_and_confirm_moves_to_backlog(client, admin_token, db):
    project_id = _create_project(client, admin_token, "TR1")
    status, issue_type, priority = _seed_issue_meta(db, project_id)

    create = client.post(
        f"/api/projects/{project_id}/issues",
        json={
            "title": "Needs triage",
            "issue_status_id": status.id,
            "issue_type_id": issue_type.id,
            "issue_priority_id": priority.id,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create.status_code == 201
    issue_id = create.json()["id"]

    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    assert issue.triage_status == "new"

    listed = client.get("/api/triage", headers={"Authorization": f"Bearer {admin_token}"})
    assert listed.status_code == 200
    data = listed.json()["data"]
    assert any(row["id"] == issue_id for row in data)
    row = next(r for r in data if r["id"] == issue_id)
    assert row["key"]
    assert row["title"] == "Needs triage"
    assert row["triage_status"] == "new"
    assert row["project"]["id"] == project_id
    assert "reporter" in row
    assert "assignee" in row
    assert "type" in row

    # Project isolation
    other = _create_project(client, admin_token, "TR2")
    filtered = client.get(
        f"/api/triage?project_id={other}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert filtered.status_code == 200
    assert all(r["project"]["id"] == other for r in filtered.json()["data"])

    notes = client.post(
        f"/api/triage/{issue_id}/triage",
        json={"triage_status": "triaging", "triage_notes": "Looking into it"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert notes.status_code == 200
    assert notes.json()["triage_status"] == "triaging"
    assert notes.json()["triage_notes"] == "Looking into it"

    # Put into a sprint then confirm — should leave sprint (backlog)
    sprint = Sprint(project_id=project_id, name="S1", status="active")
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    db.execute(sprint_issues.insert().values(issue_id=issue_id, sprint_id=sprint.id, position=0))
    db.commit()

    confirm = client.post(
        f"/api/triage/{issue_id}/confirm",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert confirm.status_code == 200
    assert confirm.json()["triage_status"] == "confirmed"

    active = client.get("/api/triage", headers={"Authorization": f"Bearer {admin_token}"})
    assert all(r["id"] != issue_id for r in active.json()["data"])

    confirmed = client.get(
        "/api/triage?triage_status=confirmed",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert any(r["id"] == issue_id for r in confirmed.json()["data"])

    membership = db.execute(
        select(sprint_issues.c.sprint_id).where(sprint_issues.c.issue_id == issue_id)
    ).first()
    assert membership is None

    # Backlog list
    backlog = client.get(
        f"/api/projects/{project_id}/issues?sprint_id=0",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert backlog.status_code == 200
    assert any(i["id"] == issue_id for i in backlog.json()["data"])

    revert = client.post(
        f"/api/triage/{issue_id}/revert",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert revert.status_code == 200
    assert revert.json()["triage_status"] in ("new", "triaging")


def test_triage_dismiss_and_empty_and_invalid(client, admin_token, db):
    project_id = _create_project(client, admin_token, "TR3")
    status, issue_type, priority = _seed_issue_meta(db, project_id)

    create = client.post(
        f"/api/projects/{project_id}/issues",
        json={
            "title": "Dismiss me",
            "issue_status_id": status.id,
            "issue_type_id": issue_type.id,
            "issue_priority_id": priority.id,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    issue_id = create.json()["id"]

    dismiss = client.post(
        f"/api/triage/{issue_id}/dismiss",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert dismiss.status_code == 200
    assert dismiss.json()["triage_status"] == "dismissed"

    empty_project = _create_project(client, admin_token, "TR0")
    empty = client.get(
        f"/api/triage?project_id={empty_project}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert empty.status_code == 200
    assert empty.json()["data"] == []

    missing = client.post(
        "/api/triage/99999991/confirm",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert missing.status_code == 404

    bad = client.get(
        "/api/triage?triage_status=not-a-status",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert bad.status_code == 422


def test_triage_requires_auth(client):
    resp = client.get("/api/triage")
    assert resp.status_code == 401


def test_triage_member_forbidden_without_permission(client, member_token):
    resp = client.get("/api/triage", headers={"Authorization": f"Bearer {member_token}"})
    assert resp.status_code == 403
