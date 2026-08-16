"""Partner → team → member hierarchy and selective project workforce architecture."""
from datetime import datetime, timezone

import pytest

from app.models.client import Client
from app.models.team import Team
from app.models.user import User, team_user
from app.security import hash_password


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _make_client(db) -> int:
    client = Client(name="Partner Arch Client", company="PAC")
    db.add(client)
    db.flush()
    return client.id


def _make_team(db, name: str) -> int:
    team = Team(name=name, is_active=True)
    db.add(team)
    db.flush()
    return team.id


def _make_user(db, name: str, email: str) -> int:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(name=name, email=email, password=hash_password("x" * 8), is_active=True)
        db.add(user)
        db.flush()
    return user.id


def _add_user_to_team(db, team_id: int, user_id: int):
    db.execute(team_user.insert().values(
        team_id=team_id,
        user_id=user_id,
        role="member",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    ))


@pytest.fixture
def partner_arch_env(client, db, admin_token):
    """ABC partner with Development/QA teams + direct member; XYZ partner; internal teams."""
    client_id = _make_client(db)
    backend_team = _make_team(db, "Arch Backend Team")
    qa_internal = _make_team(db, "Arch QA Team")
    ahmed_user = _make_user(db, "Ahmed Internal", "ahmed.internal.arch@example.com")
    _add_user_to_team(db, backend_team, ahmed_user)
    db.flush()

    project = client.post(
        "/api/projects",
        json={
            "name": "Partner Architecture Project",
            "client_id": client_id,
            "team_ids": [backend_team, qa_internal],
        },
        headers=_auth(admin_token),
    )
    assert project.status_code == 201, project.text

    abc = client.post(
        "/api/partners",
        json={"name": "ABC Technology", "specialty": "Delivery"},
        headers=_auth(admin_token),
    )
    assert abc.status_code == 201, abc.text
    abc_id = abc.json()["id"]

    xyz = client.post(
        "/api/partners",
        json={"name": "XYZ Solutions", "specialty": "Ops"},
        headers=_auth(admin_token),
    )
    assert xyz.status_code == 201, xyz.text
    xyz_id = xyz.json()["id"]

    def add_member(partner_id: int, name: str, role: str = ""):
        response = client.post(
            f"/api/partners/{partner_id}/members",
            json={"name": name, "role": role},
            headers=_auth(admin_token),
        )
        assert response.status_code == 201, response.text
        return response.json()

    ahmed = add_member(abc_id, "Ahmed", "Developer")
    mohamed = add_member(abc_id, "Mohamed", "Developer")
    ali = add_member(abc_id, "Ali", "Developer")
    sara = add_member(abc_id, "Sara", "QA")
    omar = add_member(abc_id, "Omar", "QA")
    john = add_member(abc_id, "John", "Advisor")  # direct member (no team)
    xyz_john = add_member(xyz_id, "John XYZ", "DevOps")

    development = client.post(
        f"/api/partners/{abc_id}/teams",
        json={"name": "Development Team", "member_ids": [ahmed["id"], mohamed["id"], ali["id"]]},
        headers=_auth(admin_token),
    )
    assert development.status_code == 201, development.text

    qa_team = client.post(
        f"/api/partners/{abc_id}/teams",
        json={"name": "QA Team", "member_ids": [sara["id"], omar["id"]]},
        headers=_auth(admin_token),
    )
    assert qa_team.status_code == 201, qa_team.text

    empty_team = client.post(
        f"/api/partners/{abc_id}/teams",
        json={"name": "Empty Team", "member_ids": []},
        headers=_auth(admin_token),
    )
    assert empty_team.status_code == 201, empty_team.text

    devops = client.post(
        f"/api/partners/{xyz_id}/teams",
        json={"name": "DevOps Team", "member_ids": [xyz_john["id"]]},
        headers=_auth(admin_token),
    )
    assert devops.status_code == 201, devops.text

    return {
        "project_id": project.json()["id"],
        "backend_team": backend_team,
        "qa_internal": qa_internal,
        "abc_id": abc_id,
        "xyz_id": xyz_id,
        "ahmed": ahmed["id"],
        "mohamed": mohamed["id"],
        "ali": ali["id"],
        "sara": sara["id"],
        "omar": omar["id"],
        "john": john["id"],
        "xyz_john": xyz_john["id"],
        "development_team": development.json()["id"],
        "qa_team": qa_team.json()["id"],
        "empty_team": empty_team.json()["id"],
        "devops_team": devops.json()["id"],
        "internal_ahmed": ahmed_user,
    }


class TestPartnerTeamMemberHierarchy:
    def test_partner_can_have_multiple_teams(self, client, admin_token, partner_arch_env):
        partner = client.get(
            f"/api/partners/{partner_arch_env['abc_id']}",
            headers=_auth(admin_token),
        ).json()
        team_names = {team["name"] for team in partner["teams"]}
        assert {"Development Team", "QA Team", "Empty Team"}.issubset(team_names)
        assert partner["teams_count"] >= 3

    def test_partner_team_belongs_to_correct_partner(self, client, admin_token, partner_arch_env):
        abc = client.get(f"/api/partners/{partner_arch_env['abc_id']}", headers=_auth(admin_token)).json()
        xyz = client.get(f"/api/partners/{partner_arch_env['xyz_id']}", headers=_auth(admin_token)).json()
        assert all(team["partner_id"] == partner_arch_env["abc_id"] for team in abc["teams"])
        assert all(team["partner_id"] == partner_arch_env["xyz_id"] for team in xyz["teams"])
        assert partner_arch_env["development_team"] not in {team["id"] for team in xyz["teams"]}

    def test_partner_team_can_have_multiple_members(self, client, admin_token, partner_arch_env):
        partner = client.get(f"/api/partners/{partner_arch_env['abc_id']}", headers=_auth(admin_token)).json()
        development = next(team for team in partner["teams"] if team["id"] == partner_arch_env["development_team"])
        assert development["members_count"] == 3
        assert {member["id"] for member in development["members"]} == {
            partner_arch_env["ahmed"],
            partner_arch_env["mohamed"],
            partner_arch_env["ali"],
        }

    def test_member_can_belong_to_team_and_remain_direct_without_team(self, client, admin_token, partner_arch_env):
        partner = client.get(f"/api/partners/{partner_arch_env['abc_id']}", headers=_auth(admin_token)).json()
        member_ids_on_teams = {
            member_id
            for team in partner["teams"]
            for member_id in team["member_ids"]
        }
        assert partner_arch_env["ahmed"] in member_ids_on_teams
        assert partner_arch_env["john"] not in member_ids_on_teams
        assert partner_arch_env["john"] in {member["id"] for member in partner["members"]}

    def test_empty_team_reports_zero_members(self, client, admin_token, partner_arch_env):
        partner = client.get(f"/api/partners/{partner_arch_env['abc_id']}", headers=_auth(admin_token)).json()
        empty = next(team for team in partner["teams"] if team["id"] == partner_arch_env["empty_team"])
        assert empty["members_count"] == 0
        assert empty["members"] == []
        assert empty["member_ids"] == []

    def test_team_membership_is_not_inferred_from_partner_membership(self, client, admin_token, partner_arch_env):
        partner = client.get(f"/api/partners/{partner_arch_env['abc_id']}", headers=_auth(admin_token)).json()
        development = next(team for team in partner["teams"] if team["id"] == partner_arch_env["development_team"])
        assert partner_arch_env["sara"] not in development["member_ids"]
        assert partner_arch_env["john"] not in development["member_ids"]


class TestProjectPartnerAssignments:
    def test_assign_entire_partner(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        assert client.post(
            f"/api/projects/{pid}/partners",
            json={"partner_id": partner_arch_env["abc_id"]},
            headers=_auth(admin_token),
        ).status_code == 201
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        external_ids = {entry["member_id"] for entry in workforce["external"]}
        assert {
            partner_arch_env["ahmed"],
            partner_arch_env["mohamed"],
            partner_arch_env["sara"],
            partner_arch_env["john"],
        }.issubset(external_ids)

    def test_assign_partner_team_only(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        assert client.post(
            f"/api/projects/{pid}/partner-teams",
            json={"partner_team_id": partner_arch_env["development_team"]},
            headers=_auth(admin_token),
        ).status_code == 201
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        external_ids = {entry["member_id"] for entry in workforce["external"]}
        assert partner_arch_env["ahmed"] in external_ids
        assert partner_arch_env["mohamed"] in external_ids
        assert partner_arch_env["sara"] not in external_ids
        assert partner_arch_env["john"] not in external_ids

    def test_assign_individual_partner_member(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        assert client.post(
            f"/api/projects/{pid}/partner-members",
            json={"partner_member_id": partner_arch_env["john"]},
            headers=_auth(admin_token),
        ).status_code == 201
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        external = {entry["member_id"]: entry for entry in workforce["external"]}
        assert set(external) == {partner_arch_env["john"]}
        assert external[partner_arch_env["john"]]["is_direct_member"] is True
        assert external[partner_arch_env["john"]]["is_org_direct_member"] is True

    def test_assign_individual_member_who_belongs_to_team(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        assert client.post(
            f"/api/projects/{pid}/partner-members",
            json={"partner_member_id": partner_arch_env["ahmed"]},
            headers=_auth(admin_token),
        ).status_code == 201
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        external = {entry["member_id"]: entry for entry in workforce["external"]}
        assert set(external) == {partner_arch_env["ahmed"]}
        assert partner_arch_env["mohamed"] not in external
        assert external[partner_arch_env["ahmed"]]["is_direct_member"] is True
        assert {team["id"] for team in external[partner_arch_env["ahmed"]]["teams"]} == {
            partner_arch_env["development_team"]
        }

    def test_combine_partner_team_and_member_assignments(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        assert client.post(
            f"/api/projects/{pid}/partner-teams",
            json={"partner_team_id": partner_arch_env["development_team"]},
            headers=_auth(admin_token),
        ).status_code == 201
        assert client.post(
            f"/api/projects/{pid}/partner-members",
            json={"partner_member_id": partner_arch_env["ahmed"]},
            headers=_auth(admin_token),
        ).status_code == 201
        assert client.post(
            f"/api/projects/{pid}/partners",
            json={"partner_id": partner_arch_env["xyz_id"]},
            headers=_auth(admin_token),
        ).status_code == 201

        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        external = {entry["member_id"]: entry for entry in workforce["external"]}
        assert partner_arch_env["ahmed"] in external
        assert partner_arch_env["mohamed"] in external
        assert partner_arch_env["xyz_john"] in external
        assert partner_arch_env["sara"] not in external
        # Deduplicate Ahmed across team + direct selection
        assert len([entry for entry in workforce["external"] if entry["member_id"] == partner_arch_env["ahmed"]]) == 1

        ahmed_entry = external[partner_arch_env["ahmed"]]
        source_types = {source["type"] for source in ahmed_entry["sources"]}
        assert "partner_team" in source_types
        assert "direct_partner_member" in source_types
        assert {team["name"] for team in ahmed_entry["teams"]} == {"Development Team"}

    def test_preserve_org_team_when_direct_member_selected(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        assert client.post(
            f"/api/projects/{pid}/partner-members",
            json={"partner_member_id": partner_arch_env["sara"]},
            headers=_auth(admin_token),
        ).status_code == 201
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        sara = next(entry for entry in workforce["external"] if entry["member_id"] == partner_arch_env["sara"])
        assert sara["partner"]["name"] == "ABC Technology"
        assert {team["id"] for team in sara["teams"]} == {partner_arch_env["qa_team"]}
        assert any(source["type"] == "direct_partner_member" for source in sara["sources"])

    def test_removing_team_removes_team_only_eligibility(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        client.post(
            f"/api/projects/{pid}/partner-teams",
            json={"partner_team_id": partner_arch_env["development_team"]},
            headers=_auth(admin_token),
        )
        client.post(
            f"/api/projects/{pid}/partner-members",
            json={"partner_member_id": partner_arch_env["ahmed"]},
            headers=_auth(admin_token),
        )
        client.delete(
            f"/api/projects/{pid}/partner-teams/{partner_arch_env['development_team']}",
            headers=_auth(admin_token),
        )
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        external_ids = {entry["member_id"] for entry in workforce["external"]}
        assert partner_arch_env["ahmed"] in external_ids  # still direct
        assert partner_arch_env["mohamed"] not in external_ids

    def test_removing_partner_removes_partner_only_eligibility(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        client.post(
            f"/api/projects/{pid}/partners",
            json={"partner_id": partner_arch_env["abc_id"]},
            headers=_auth(admin_token),
        )
        client.post(
            f"/api/projects/{pid}/partner-members",
            json={"partner_member_id": partner_arch_env["xyz_john"]},
            headers=_auth(admin_token),
        )
        client.delete(
            f"/api/projects/{pid}/partners/{partner_arch_env['abc_id']}",
            headers=_auth(admin_token),
        )
        workforce = client.get(f"/api/projects/{pid}/workforce", headers=_auth(admin_token)).json()
        external_ids = {entry["member_id"] for entry in workforce["external"]}
        assert partner_arch_env["ahmed"] not in external_ids
        assert partner_arch_env["xyz_john"] in external_ids


class TestExternalTaskEligibility:
    def test_eligible_external_member_can_be_assigned(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        client.post(
            f"/api/projects/{pid}/partner-teams",
            json={"partner_team_id": partner_arch_env["development_team"]},
            headers=_auth(admin_token),
        )
        response = client.post(
            f"/api/projects/{pid}/issues",
            json={"title": "External eligible task", "external_assignee_id": partner_arch_env["ahmed"]},
            headers=_auth(admin_token),
        )
        assert response.status_code == 201, response.text
        assert response.json()["externalAssigneeId"] == partner_arch_env["ahmed"]

    def test_non_workforce_external_member_rejected(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        client.post(
            f"/api/projects/{pid}/partner-teams",
            json={"partner_team_id": partner_arch_env["development_team"]},
            headers=_auth(admin_token),
        )
        response = client.post(
            f"/api/projects/{pid}/issues",
            json={"title": "External rejected task", "external_assignee_id": partner_arch_env["sara"]},
            headers=_auth(admin_token),
        )
        assert response.status_code == 422

    def test_historical_assignment_preserved_after_removal(self, client, admin_token, partner_arch_env):
        pid = partner_arch_env["project_id"]
        client.post(
            f"/api/projects/{pid}/partner-members",
            json={"partner_member_id": partner_arch_env["ahmed"]},
            headers=_auth(admin_token),
        )
        issue = client.post(
            f"/api/projects/{pid}/issues",
            json={"title": "Keep external assignee", "external_assignee_id": partner_arch_env["ahmed"]},
            headers=_auth(admin_token),
        ).json()
        client.delete(
            f"/api/projects/{pid}/partner-members/{partner_arch_env['ahmed']}",
            headers=_auth(admin_token),
        )
        retained = client.get(f"/api/issues/{issue['id']}", headers=_auth(admin_token)).json()
        assert retained["externalAssigneeId"] == partner_arch_env["ahmed"]
        rejected = client.post(
            f"/api/projects/{pid}/issues",
            json={"title": "No longer eligible", "external_assignee_id": partner_arch_env["ahmed"]},
            headers=_auth(admin_token),
        )
        assert rejected.status_code == 422


class TestInternalAndAuthUnchanged:
    def test_internal_workforce_still_derived(self, client, admin_token, partner_arch_env):
        workforce = client.get(
            f"/api/projects/{partner_arch_env['project_id']}/workforce",
            headers=_auth(admin_token),
        ).json()
        assert partner_arch_env["internal_ahmed"] in {entry["user_id"] for entry in workforce["internal"]}

    def test_member_cannot_manage_partner_hierarchy(self, client, member_token, partner_arch_env):
        assert client.post(
            "/api/partners",
            json={"name": "Blocked"},
            headers=_auth(member_token),
        ).status_code == 403
        assert client.post(
            f"/api/partners/{partner_arch_env['abc_id']}/teams",
            json={"name": "Blocked Team"},
            headers=_auth(member_token),
        ).status_code == 403
        assert client.post(
            f"/api/projects/{partner_arch_env['project_id']}/partner-teams",
            json={"partner_team_id": partner_arch_env["development_team"]},
            headers=_auth(member_token),
        ).status_code == 403

    def test_create_project_with_combined_external_assignments(self, client, db, admin_token, partner_arch_env):
        client_id = _make_client(db)
        response = client.post(
            "/api/projects",
            json={
                "name": "Combined External Create",
                "client_id": client_id,
                "team_ids": [partner_arch_env["backend_team"]],
                "partner_ids": [partner_arch_env["xyz_id"]],
                "partner_team_ids": [partner_arch_env["development_team"]],
                "partner_member_ids": [partner_arch_env["ahmed"], partner_arch_env["john"]],
            },
            headers=_auth(admin_token),
        )
        assert response.status_code == 201, response.text
        project_id = response.json()["id"]
        workforce = client.get(f"/api/projects/{project_id}/workforce", headers=_auth(admin_token)).json()
        external_ids = {entry["member_id"] for entry in workforce["external"]}
        assert partner_arch_env["ahmed"] in external_ids
        assert partner_arch_env["mohamed"] in external_ids
        assert partner_arch_env["john"] in external_ids
        assert partner_arch_env["xyz_john"] in external_ids
        assert partner_arch_env["sara"] not in external_ids
        assert len([entry for entry in workforce["external"] if entry["member_id"] == partner_arch_env["ahmed"]]) == 1
