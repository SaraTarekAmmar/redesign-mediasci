import pytest
from app.models.issue import Issue, IssueStatus
from app.models.project import Project
from app.models.workflow import WorkflowStage


def test_workflow_stages_crud_duplicate_archive(client, admin_token, db):
    headers = {"Authorization": f"Bearer {admin_token}"}
    proj = db.query(Project).first()
    if not proj:
        proj = Project(name="Sprint 6 Test Project", key="S6")
        db.add(proj)
        db.commit()

    # 1. List default stages (auto-seeded)
    res = client.get(f"/api/projects/{proj.id}/stages", headers=headers)
    assert res.status_code == 200
    stages = res.json()
    assert isinstance(stages, list)
    assert len(stages) >= 3

    # 2. Create custom stage (e.g., "QA Testing")
    payload = {
        "name": "QA Testing",
        "category": "review",
        "color": "#F59E0B",
        "wip_limit": 5,
    }
    create_res = client.post(f"/api/projects/{proj.id}/stages", json=payload, headers=headers)
    assert create_res.status_code == 201
    stage_data = create_res.json()
    assert stage_data["name"] == "QA Testing"
    stage_id = stage_data["id"]

    # 3. Duplicate stage
    dup_res = client.post(f"/api/projects/{proj.id}/stages/{stage_id}/duplicate", headers=headers)
    assert dup_res.status_code == 200
    assert "Copy" in dup_res.json()["name"]

    # 4. Archive stage
    arch_res = client.post(f"/api/projects/{proj.id}/stages/{stage_id}/archive?archive=true", headers=headers)
    assert arch_res.status_code == 200
    assert arch_res.json()["is_archived"] is True


def test_task_execution_subtasks_and_attachments(client, admin_token, db):
    headers = {"Authorization": f"Bearer {admin_token}"}
    proj = db.query(Project).first()

    issue = db.query(Issue).filter(Issue.project_id == proj.id, Issue.deleted_at.is_(None)).first()
    if not issue:
        issue = Issue(title="Sprint 6 Parent Execution Task", project_id=proj.id)
        db.add(issue)
        db.commit()

    # 1. Add Subtask
    st_res = client.post(f"/api/issues/{issue.id}/subtasks", json={"title": "Subtask 1 API", "estimated_hours": 3.5}, headers=headers)
    assert st_res.status_code == 201
    assert st_res.json()["title"] == "Subtask 1 API"

    # 2. Get Subtasks list
    st_list = client.get(f"/api/issues/{issue.id}/subtasks", headers=headers)
    assert st_list.status_code == 200
    assert len(st_list.json()) >= 1

    # 3. Upload Attachment metadata
    att_res = client.post(f"/api/issues/{issue.id}/attachments", json={"original_filename": "architecture_spec.pdf", "mime_type": "application/pdf", "file_size": 2048}, headers=headers)
    assert att_res.status_code == 201
    att_id = att_res.json()["id"]

    # 4. List Attachments
    att_list = client.get(f"/api/issues/{issue.id}/attachments", headers=headers)
    assert att_list.status_code == 200
    assert any(a["id"] == att_id for a in att_list.json())

    # 5. Delete Attachment
    del_att = client.delete(f"/api/issues/{issue.id}/attachments/{att_id}", headers=headers)
    assert del_att.status_code == 200


def test_task_checklists_and_activity_filtering(client, admin_token, db):
    headers = {"Authorization": f"Bearer {admin_token}"}
    issue = db.query(Issue).first()

    # 1. Add Checklist Item
    chk_res = client.post(f"/api/issues/{issue.id}/checklists", json={"title": "Run Unit Tests"}, headers=headers)
    assert chk_res.status_code == 201
    chk_item = chk_res.json()
    chk_id = chk_item["id"]

    # 2. Complete Checklist Item
    up_chk = client.put(f"/api/issues/{issue.id}/checklists/{chk_id}", json={"completed": True}, headers=headers)
    assert up_chk.status_code == 200

    # 3. List Activities with filter
    act_res = client.get(f"/api/issues/{issue.id}/activities?activity_type=checklist", headers=headers)
    assert act_res.status_code == 200
    acts = act_res.json()
    assert isinstance(acts, list)
    assert all("checklist" in a["activity_type"].lower() for a in acts)
