import pytest
from app.models.issue import Issue, IssueStatus
from app.models.project import Project
from app.models.workflow import WorkflowStage
from app.models.time_tracking import TimeLog


def test_issue_direct_ai_placeholder_columns(client, admin_token, db):
    headers = {"Authorization": f"Bearer {admin_token}"}
    proj = db.query(Project).first()

    issue = Issue(
        title="Direct AI Columns Test Task",
        project_id=proj.id,
        ai_estimated_hours=14.5,
        ai_priority="High",
        ai_risk="Low",
        ai_confidence_score=96.0,
    )
    db.add(issue)
    db.commit()

    db.expire_all()
    queried_issue = db.query(Issue).filter(Issue.id == issue.id).first()
    assert float(queried_issue.ai_estimated_hours) == 14.5
    assert queried_issue.ai_priority == "High"
    assert queried_issue.ai_risk == "Low"
    assert float(queried_issue.ai_confidence_score) == 96.0


def test_workflow_integrity_rules(client, admin_token, db):
    headers = {"Authorization": f"Bearer {admin_token}"}
    proj = db.query(Project).first()

    # List stages
    res = client.get(f"/api/projects/{proj.id}/stages", headers=headers)
    assert res.status_code == 200
    stages = res.json()
    initial_stage = next(s for s in stages if s.get("is_initial"))
    final_stage = next(s for s in stages if s.get("is_final"))

    # Attempt deleting the only initial stage without setting another -> must fail with 400
    del_res = client.delete(f"/api/projects/{proj.id}/stages/{initial_stage['id']}", headers=headers)
    assert del_res.status_code == 400
    assert "Initial Stage" in del_res.text

    # Attempt deleting the only final stage -> must fail with 400
    del_final_res = client.delete(f"/api/projects/{proj.id}/stages/{final_stage['id']}", headers=headers)
    assert del_final_res.status_code == 400
    assert "Final Stage" in del_final_res.text


def test_time_log_billing_approval_fields(client, admin_token, db):
    headers = {"Authorization": f"Bearer {admin_token}"}
    issue = db.query(Issue).first()

    # Create TimeLog
    time_payload = {
        "hours": 4.0,
        "description": "Architecture Refinement work",
        "billable": True,
    }
    log_res = client.post(f"/api/issues/{issue.id}/time-logs", json=time_payload, headers=headers)
    assert log_res.status_code == 201
    log_id = log_res.json()["id"]

    # Direct DB verification of TimeLog columns
    db.expire_all()
    time_log_db = db.query(TimeLog).filter(TimeLog.id == log_id).first()
    assert time_log_db is not None
    assert time_log_db.billable == 1
    assert time_log_db.approved is False
