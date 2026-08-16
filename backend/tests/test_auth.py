import pytest


def test_login_success(client):
    response = client.post("/api/auth/login", json={
        "email": "admin@example.com",
        "password": "adminpassword"
    })
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["email"] == "admin@example.com"


def test_login_invalid_credentials(client):
    response = client.post("/api/auth/login", json={
        "email": "admin@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert response.json()["error_code"] == "INVALID_CREDENTIALS"


def test_me_authorized(client, admin_token):
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "admin@example.com"
    assert any(role["name"] == "super-admin" for role in data["roles"])


def test_me_unauthorized(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
