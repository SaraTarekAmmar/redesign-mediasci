"""Enterprise Gantt frontend contract tests (plans / gantt-data / deps / milestones)."""


def _create_project(client, admin_token, key="EG1"):
    resp = client.post(
        "/api/projects",
        json={"name": f"Gantt {key}", "key": key, "status": "active"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code in (200, 201)
    return resp.json()["id"]


def test_enterprise_gantt_full_flow(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    project_id = _create_project(client, admin_token, "EGA")

    # Empty plans for project
    plans = client.get(f"/api/plans?projects[]={project_id}", headers=headers)
    assert plans.status_code == 200
    assert plans.json()["data"] == []

    # Create plan
    created = client.post(
        "/api/plans",
        json={
            "name": "Full Detailed Plan",
            "project_id": str(project_id),
            "type": "Detailed Plan",
            "description": "",
        },
        headers=headers,
    )
    assert created.status_code == 201
    plan = created.json()["plan"]
    assert plan["id"]
    assert plan["project_id"] == project_id
    assert plan["name"] == "Full Detailed Plan"
    assert plan["type"] == "Detailed Plan"
    plan_id = plan["id"]

    listed = client.get(f"/api/plans?projects[]={project_id}", headers=headers)
    assert any(p["id"] == plan_id for p in listed.json()["data"])

    # Isolation: other project should not see this plan
    other = _create_project(client, admin_token, "EGB")
    other_plans = client.get(f"/api/plans?projects[]={other}", headers=headers)
    assert all(p["id"] != plan_id for p in other_plans.json()["data"])

    # Empty gantt
    gantt = client.get(f"/api/plans/{plan_id}/gantt-data", headers=headers)
    assert gantt.status_code == 200
    assert gantt.json()["data"] == []
    assert gantt.json()["links"] == []

    # Create tasks
    t1 = client.post(
        "/api/plan-tasks",
        json={
            "plan_id": plan_id,
            "text": "Discovery",
            "description": None,
            "start_date": "2026-08-01",
            "duration": 3,
            "status": "in_progress",
            "priority": "high",
            "type": "task",
            "is_milestone": False,
            "assigned_to": None,
        },
        headers=headers,
    )
    assert t1.status_code == 201
    t2 = client.post(
        "/api/plan-tasks",
        json={
            "plan_id": plan_id,
            "text": "Kickoff Gate",
            "start_date": "2026-08-05",
            "duration": 1,
            "status": "not_started",
            "priority": "medium",
            "type": "milestone",
            "is_milestone": True,
            "assigned_to": None,
        },
        headers=headers,
    )
    assert t2.status_code == 201
    id1 = str(t1.json()["id"])
    id2 = str(t2.json()["id"])

    dep = client.post(
        "/api/plan-dependencies",
        json={"source": id1, "target": id2, "type": "FS", "lag": 1},
        headers=headers,
    )
    assert dep.status_code == 201

    gantt2 = client.get(f"/api/plans/{plan_id}/gantt-data", headers=headers)
    payload = gantt2.json()
    assert len(payload["data"]) == 2
    assert len(payload["links"]) == 1
    task = payload["data"][0]
    assert set(task.keys()) >= {
        "id", "text", "start_date", "end_date", "duration", "progress",
        "completion_pct", "status", "priority", "assigned_to", "type", "critical", "color",
    }
    assert isinstance(task["id"], str)
    assert isinstance(task["critical"], bool)
    assert payload["links"][0]["source"] == id1
    assert payload["links"][0]["target"] == id2

    # Critical path: both tasks on the only chain
    assert any(t["critical"] for t in payload["data"])

    # Update + delete dependency
    upd = client.put(
        f"/api/plan-tasks/{id1}",
        json={"text": "Discovery Updated", "duration": 5, "status": "completed"},
        headers=headers,
    )
    assert upd.status_code == 200
    assert upd.json()["text"] == "Discovery Updated"

    rm = client.delete(
        f"/api/plan-dependencies?source={id1}&target={id2}",
        headers=headers,
    )
    assert rm.status_code == 200

    # Milestones (legacy global)
    ms = client.post(
        "/api/milestones",
        json={"name": "Release Marker", "date": "2026-08-20", "status": "pending", "priority": "medium"},
        headers=headers,
    )
    assert ms.status_code == 201
    assert ms.json()["title"] == "Release Marker"
    assert ms.json()["date"] == "2026-08-20"

    ms_list = client.get("/api/milestones", headers=headers)
    assert ms_list.status_code == 200
    body = ms_list.json()
    milestones = body["milestones"] if isinstance(body, dict) else body
    assert any(m["title"] == "Release Marker" for m in milestones)

    # Delete task
    deleted = client.delete(f"/api/plan-tasks/{id2}", headers=headers)
    assert deleted.status_code == 200
    gantt3 = client.get(f"/api/plans/{plan_id}/gantt-data", headers=headers)
    assert len(gantt3.json()["data"]) == 1


def test_enterprise_gantt_auth_and_invalid_plan(client, admin_token, member_token):
    # Clear cookies set by login fixtures so unauthenticated check is accurate.
    client.cookies.clear()
    assert client.get("/api/plans").status_code == 401

    headers = {"Authorization": f"Bearer {admin_token}"}
    missing = client.get("/api/plans/99999991/gantt-data", headers=headers)
    assert missing.status_code == 404

    # Authenticated member can read (get_current_user) — should not 403
    member_headers = {"Authorization": f"Bearer {member_token}"}
    resp = client.get("/api/plans", headers=member_headers)
    assert resp.status_code == 200
