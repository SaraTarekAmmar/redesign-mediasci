import pytest
from app.models.user import User
from app.models.team import Department, Team
from app.models.resource import Skill


def test_skills_crud(client, admin_token, db):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Ensure clean test state by removing existing FastAPI skills
    db.query(Skill).filter(Skill.name.in_(["FastAPI", "FastAPI Master"])).delete(synchronize_session=False)
    db.commit()

    # Create Skill
    res = client.post("/api/skills", json={"name": "FastAPI", "category": "backend"}, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "FastAPI"
    skill_id = data["id"]

    # List Skills
    res = client.get("/api/skills", headers=headers)
    assert res.status_code == 200
    skills = res.json()
    assert any(s["name"] == "FastAPI" for s in skills)

    # Update Skill
    res = client.put(f"/api/skills/{skill_id}", json={"name": "FastAPI Master", "category": "backend"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["name"] == "FastAPI Master"

    # Delete Skill
    res = client.delete(f"/api/skills/{skill_id}", headers=headers)
    assert res.status_code == 200


def test_workforce_team_members_list_and_profile(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # List workforce members
    res = client.get("/api/team-members", headers=headers)
    assert res.status_code == 200
    members = res.json()
    assert isinstance(members, list)

    # Test filtering with project_id
    res_proj = client.get("/api/team-members?project_id=1", headers=headers)
    assert res_proj.status_code == 200
    assert isinstance(res_proj.json(), list)

    if members:
        user_id = members[0]["id"]
        # Fetch detailed profile
        prof_res = client.get(f"/api/team-members/{user_id}", headers=headers)
        assert prof_res.status_code == 200
        prof_data = prof_res.json()
        assert "position" in prof_data
        assert "seniority" in prof_data
        assert "capacity" in prof_data
        assert "availability" in prof_data
        assert "assigned_projects" in prof_data
        assert "assigned_issues" in prof_data
        assert "salary" in prof_data
        assert "currency" in prof_data


def test_create_and_update_team_member(client, admin_token, db):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Ensure a department exists
    dept = db.query(Department).first()
    if not dept:
        dept = Department(name="Engineering")
        db.add(dept)
        db.commit()

    payload = {
        "name": "Sarah Connor",
        "email": "sarah.connor@example.com",
        "position": "QA Engineer",
        "seniority": "Senior",
        "capacity": 40,
        "availability": "Available",
        "salary": 65000,
        "currency": "USD",
        "department_id": dept.id,
    }

    res = client.post("/api/team-members", json=payload, headers=headers)
    assert res.status_code == 201
    member = res.json()
    assert member["name"] == "Sarah Connor"
    assert member["salary"] == 65000
    assert member["currency"] == "USD"
    member_id = member["id"]

    # Update team member profile
    update_payload = {
        "salary": 70000,
        "currency": "EUR",
        "availability": "Partially Allocated",
    }
    up_res = client.put(f"/api/team-members/{member_id}", json=update_payload, headers=headers)
    assert up_res.status_code == 200
    updated = up_res.json()
    assert updated["salary"] == 70000
    assert updated["currency"] == "EUR"
    assert updated["availability"] == "Partially Allocated"


def test_database_persistence_verification(client, admin_token, db):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Prepare department, team, and skill
    dept = db.query(Department).first()
    if not dept:
        dept = Department(name="DevOps")
        db.add(dept)
        db.commit()

    team = db.query(Team).first()
    if not team:
        team = Team(name="Alpha Team", department_id=dept.id)
        db.add(team)
        db.commit()

    skill = db.query(Skill).first()
    if not skill:
        skill = Skill(name="Python", category="backend")
        db.add(skill)
        db.commit()

    payload = {
        "name": "Audit Test Resource",
        "email": "audit.test@example.com",
        "position": "DevOps Engineer",
        "seniority": "Lead",
        "capacity": 38,
        "availability": "Available",
        "salary": 95000,
        "currency": "EGP",
        "department_id": dept.id,
        "team_ids": [team.id],
        "skills": [{"skill_id": skill.id, "proficiency_level": "Expert", "years_of_experience": 5.0}],
    }

    res = client.post("/api/team-members", json=payload, headers=headers)
    assert res.status_code == 201
    created_id = res.json()["id"]

    # DIRECT DATABASE QUERY VERIFICATION (bypassing API)
    db.expire_all()
    user_db = db.query(User).filter(User.id == created_id).first()
    assert user_db is not None
    assert user_db.name == "Audit Test Resource"
    assert user_db.email == "audit.test@example.com"
    assert user_db.position == "DevOps Engineer"
    assert user_db.seniority == "Lead"
    assert user_db.capacity == 38
    assert user_db.availability == "Available"
    assert float(user_db.salary) == 95000.0
    assert user_db.currency == "EGP"
    assert user_db.department_id == dept.id

    # Verify team relationship in team_user table
    assert any(t.id == team.id for t in user_db.teams)

    # Verify skill relationship in skill_user table
    assert any(s.id == skill.id for s in user_db.skills)


