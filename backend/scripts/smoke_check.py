import os
from pathlib import Path
import sys

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from main import app


def main() -> None:
    paths = sorted(route.path for route in app.routes if route.path.startswith("/api"))
    assert "/api/auth/login" in paths
    assert "/api/auth/me" in paths
    assert "/api/health" in paths
    assert "/api/meta/migration-status" in paths
    client = TestClient(app)
    csrf_response = client.get("/sanctum/csrf-cookie")
    assert csrf_response.status_code == 204
    assert "XSRF-TOKEN" in client.cookies

    guest_bootstrap = client.get("/spa/bootstrap")
    assert guest_bootstrap.status_code in {401, 403}

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": os.getenv("TASKFLOW_SMOKE_EMAIL", "superadmin@taskflow.dev"),
            "password": os.getenv("TASKFLOW_SMOKE_PASSWORD", "password"),
        },
    )
    assert login_response.status_code == 200, login_response.text

    bootstrap_response = client.get("/spa/bootstrap")
    assert bootstrap_response.status_code == 200, bootstrap_response.text
    payload = bootstrap_response.json()
    for key in ("user", "projects", "projectScope", "issues", "statuses", "priorities"):
        assert key in payload, f"missing bootstrap key: {key}"

    print("backend smoke check passed")


if __name__ == "__main__":
    main()
