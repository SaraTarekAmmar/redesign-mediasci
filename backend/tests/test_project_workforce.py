"""End-to-end tests for the unified project workforce model:
multiple internal teams, external partners, derived workforce,
deduplication, and task-assignment eligibility enforcement."""
import pytest
from datetime import datetime, timezone

from app.models.client import Client
from app.models.team import Team
from app.models.user import User, team_user
from app.security import hash_password


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _make_client(db) -> int:
    c = Client(name="Workforce Test Client", company="WTC")
    db.add(c)
    db.flush()
    return c.id


def _make_team(db, name: str) -> int:
    t = Team(name=name, is_active=True)
    db.add(t)
    db.flush()
    return t.id


def _make_user(db, name: str, email: str) -> int:
    u = db.query(User).filter(User.email == email).first()
    if not u:
        u = User(name=name, email=email, password=hash_password("x" * 8), is_active=True)
        db.add(u)
        db.flush()
    return u.id


def _add_user_to_team(db, team_id: int, user_id: int):
    db.execute(team_user.insert().values(
        team_id=team_id, user_id=user_id, role="member",
        created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    ))


@pytest.fixture
def workforce_env(client, db, admin_token):
    """Project + two teams with members + a partner with members."""
    client_id = _make_client(db)
    backend_team = _make_team(db, "WF Backend Team")
    frontend_team = _make_team(db, "WF Frontend Team")

    ahmed = _make_user(db, "Ahmed WF", "ahmed.wf@example.com")
    mohamed = _make_user(db, "Mohamed WF", "mohamed.wf@example.com")
    sara = _make_user(db, "Sara WF", "sara.wf@example.com")
    _add_user_to_team(db, backend_team, ahmed)
    _add_user_to_team(db, backend_team, mohamed)
    _add_user_to_team(db, frontend_team, sara)
    # Ahmed also on frontend team -> dedup case
    _add_user_to_team(db, frontend_team, ahmed)
    db.flush()

    r = client.post("/api/projects", json={
        "name": "ERP Migration WF",
        "client_id": client_id,
        "team_ids": [backend_team, frontend_team],
    }, headers=_auth(admin_token))
    assert r.status_code == 201, r.text
    project = r.json()

    r = client.post("/api/partners", json={
        "name": "AWS Consulting WF", "specialty": "Cloud",
    }, headers=_auth(admin_token))
    assert r.status_code == 201, r.text
    partner = r.json()

    r = client.post(f"/api/partners/{partner['id']}/members", json={
        "name": "John WF", "role": "Cloud Architect",
    }, headers=_auth(admin_token))
    assert r.status_code == 201, r.text
    john = r.json()

    return {
        "project_id": project["id"],
        "backend_team": backend_team,
        "frontend_team": frontend_team,
        "users": {"ahmed": ahmed, "mohamed": mohamed, "sara": sara},
        "partner_id": partner["id"],
        "john": john["id"],
        "project": project,
    }


class TestMultipleTeams:
    def test_project_created_with_multiple_teams(self, workforce_env):
        teams = workforce_env["project"]["teams"]
        ids = {t["id"] for t in teams}
        assert workforce_env["backend_team"] in ids
        assert workforce_env["frontend_team"] in ids

    def test_workforce_derived_and_deduplicated(self, client, admin_token, workforce_env):
        r = client.get(f"/api/projects/{workforce_env['project_id']}/workforce", headers=_auth(admin_token))
        assert r.status_code == 200
        internal = r.json()["internal"]
        by_user = {e["user_id"]: e for e in internal}
        u = workforce_env["users"]
        assert set(u.values()).issubset(by_user.keys())
        # Ahmed appears once, with both source teams
        ahmed_entry = by_user[u["ahmed"]]
        assert len([e for e in internal if e["user_id"] == u["ahmed"]]) == 1
        assert {t["id"] for t in ahmed_entry["teams"]} == {
            workforce_env["backend_team"], workforce_env["frontend_team"]
        }

    def test_add_and_remove_team(self, client, db, admin_token, workforce_env):
        pid = workforce_env["project_id"]
        qa_team = _make_team(db, "WF QA Team")
        youssef = _make_user(db, "Youssef WF", "youssef.wf@example.com")
        _add_user_to_team(db, qa_team, youssef)
        db.flush()

        r = client.post(f"/api/projects/{pid}/teams", json={"team_id": qa_team}, headers=_auth(admin_token))
        assert r.status_code == 201
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        assert youssef in {e["user_id"] for e in workforce["internal"]}

        r = client.delete(f"/api/projects/{pid}/teams/{qa_team}", headers=_auth(admin_token))
        assert r.status_code == 200
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        assert youssef not in {e["user_id"] for e in workforce["internal"]}

    def test_removing_team_keeps_members_from_other_teams(self, client, admin_token, workforce_env):
        pid = workforce_env["project_id"]
        u = workforce_env["users"]
        client.delete(f"/api/projects/{pid}/teams/{workforce_env['backend_team']}", headers=_auth(admin_token))
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        internal_ids = {e["user_id"] for e in workforce["internal"]}
        assert u["mohamed"] not in internal_ids       # backend-only member gone
        assert u["ahmed"] in internal_ids             # still eligible via frontend team
        assert u["sara"] in internal_ids


class TestExternalPartners:
    def test_partner_members_in_workforce(self, client, admin_token, workforce_env):
        pid = workforce_env["project_id"]
        r = client.post(f"/api/projects/{pid}/partners",
                        json={"partner_id": workforce_env["partner_id"]}, headers=_auth(admin_token))
        assert r.status_code == 201
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        externals = {e["member_id"]: e for e in workforce["external"]}
        assert workforce_env["john"] in externals
        assert externals[workforce_env["john"]]["partner"]["id"] == workforce_env["partner_id"]
        assert externals[workforce_env["john"]]["type"] == "external"

    def test_external_task_assignment_and_removal(self, client, admin_token, workforce_env):
        pid = workforce_env["project_id"]
        john = workforce_env["john"]

        # Not assigned yet -> external member rejected
        r = client.post(f"/api/projects/{pid}/issues",
                        json={"title": "Configure AWS", "external_assignee_id": john},
                        headers=_auth(admin_token))
        assert r.status_code == 422

        client.post(f"/api/projects/{pid}/partners",
                    json={"partner_id": workforce_env["partner_id"]}, headers=_auth(admin_token))
        r = client.post(f"/api/projects/{pid}/issues",
                        json={"title": "Configure AWS", "external_assignee_id": john},
                        headers=_auth(admin_token))
        assert r.status_code == 201, r.text
        issue = r.json()
        assert issue["externalAssigneeId"] == john

        # Remove partner: historical assignment preserved, new assignments rejected
        r = client.delete(f"/api/projects/{pid}/partners/{workforce_env['partner_id']}",
                          headers=_auth(admin_token))
        assert r.status_code == 200
        r = client.get(f"/api/issues/{issue['id']}", headers=_auth(admin_token))
        assert r.json()["externalAssigneeId"] == john
        r = client.post(f"/api/projects/{pid}/issues",
                        json={"title": "More AWS work", "external_assignee_id": john},
                        headers=_auth(admin_token))
        assert r.status_code == 422


class TestTaskAssignmentEligibility:
    def test_internal_member_assignable(self, client, admin_token, workforce_env):
        pid = workforce_env["project_id"]
        r = client.post(f"/api/projects/{pid}/issues",
                        json={"title": "Implement auth", "assignee_id": workforce_env["users"]["ahmed"]},
                        headers=_auth(admin_token))
        assert r.status_code == 201, r.text
        assert r.json()["assigneeId"] == workforce_env["users"]["ahmed"]

    def test_non_workforce_user_rejected(self, client, db, admin_token, workforce_env):
        outsider = _make_user(db, "Outsider WF", "outsider.wf@example.com")
        db.flush()
        r = client.post(f"/api/projects/{workforce_env['project_id']}/issues",
                        json={"title": "Should fail", "assignee_id": outsider},
                        headers=_auth(admin_token))
        assert r.status_code == 422

    def test_update_assignment_validated(self, client, db, admin_token, workforce_env):
        pid = workforce_env["project_id"]
        r = client.post(f"/api/projects/{pid}/issues",
                        json={"title": "Reassign me"}, headers=_auth(admin_token))
        issue_id = r.json()["id"]
        outsider = _make_user(db, "Outsider2 WF", "outsider2.wf@example.com")
        db.flush()
        r = client.put(f"/api/issues/{issue_id}", json={"assignee_id": outsider}, headers=_auth(admin_token))
        assert r.status_code == 422
        r = client.put(f"/api/issues/{issue_id}",
                       json={"assignee_id": workforce_env["users"]["sara"]}, headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["assigneeId"] == workforce_env["users"]["sara"]


class TestAuthorization:
    def test_member_cannot_manage_partners(self, client, member_token, workforce_env):
        r = client.post("/api/partners", json={"name": "Nope"}, headers=_auth(member_token))
        assert r.status_code == 403

    def test_member_cannot_modify_project_teams(self, client, member_token, workforce_env):
        r = client.post(f"/api/projects/{workforce_env['project_id']}/teams",
                        json={"team_id": workforce_env['backend_team']}, headers=_auth(member_token))
        assert r.status_code == 403


class TestPartnerCrud:
    def test_partner_crud_and_member_soft_delete(self, client, admin_token, workforce_env):
        partner_id = workforce_env["partner_id"]
        r = client.put(f"/api/partners/{partner_id}", json={"status": "inactive"}, headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["status"] == "inactive"

        r = client.delete(f"/api/partners/{partner_id}/members/{workforce_env['john']}", headers=_auth(admin_token))
        assert r.status_code == 200
        r = client.get(f"/api/partners/{partner_id}", headers=_auth(admin_token))
        assert workforce_env["john"] not in [m["id"] for m in r.json()["members"]]

        r = client.delete(f"/api/partners/{partner_id}", headers=_auth(admin_token))
        assert r.status_code == 200
        r = client.get(f"/api/partners/{partner_id}", headers=_auth(admin_token))
        assert r.status_code == 404
