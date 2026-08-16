import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from main import app
from app.database import Base, get_db
from app import models  # register all models for Base.metadata
from app.models.user import User, Role, user_roles_table
from app.models.client import Client
from app.models.project import Project
from app.models.issue import Issue
from app.security import hash_password

from app.config import get_settings

settings = get_settings()
# MySQL database configuration for test suite
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Seed default roles idempotently
    roles = ["super-admin", "admin", "project-manager", "team-leader", "developer", "member", "viewer", "hr-manager", "account-manager"]
    for role_name in roles:
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            role = Role(name=role_name, guard_name="web")
            db.add(role)
    db.commit()

    # Seed an admin user idempotently
    admin_user = db.query(User).filter(User.email == "admin@example.com").first()
    if not admin_user:
        admin_user = User(
            name="Test Admin",
            email="admin@example.com",
            password=hash_password("adminpassword"),
            is_active=True
        )
        db.add(admin_user)
        db.flush()

        admin_role = db.query(Role).filter(Role.name == "super-admin").first()
        db.execute(user_roles_table.insert().values(
            role_id=admin_role.id,
            model_type="App\\Models\\User",
            model_id=admin_user.id
        ))

    # Seed a standard user idempotently
    member_user = db.query(User).filter(User.email == "member@example.com").first()
    if not member_user:
        member_user = User(
            name="Test Member",
            email="member@example.com",
            password=hash_password("memberpassword"),
            is_active=True
        )
        db.add(member_user)
        db.flush()

        member_role = db.query(Role).filter(Role.name == "member").first()
        db.execute(user_roles_table.insert().values(
            role_id=member_role.id,
            model_type="App\\Models\\User",
            model_id=member_user.id
        ))

    db.commit()

    # Keep the suite portable to a clean database. Several legacy execution
    # tests intentionally operate on the first available project/task, mirroring
    # a seeded development database.
    baseline_client = db.query(Client).filter(Client.name == "Test Baseline Client").first()
    if not baseline_client:
        baseline_client = Client(name="Test Baseline Client", company="Operation Hub Tests")
        db.add(baseline_client)
        db.flush()
    baseline_project = db.query(Project).filter(Project.key == "TESTBASE").first()
    if not baseline_project:
        baseline_project = Project(
            name="Test Baseline Project",
            key="TESTBASE",
            status="active",
            client_id=baseline_client.id,
            owner_id=admin_user.id,
        )
        db.add(baseline_project)
        db.flush()
    if not db.query(Issue).filter(Issue.project_id == baseline_project.id).first():
        db.add(Issue(title="Test Baseline Task", project_id=baseline_project.id, reporter_id=admin_user.id))

    db.commit()
    db.close()
    yield


@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def admin_token(client):
    response = client.post("/api/auth/login", json={
        "email": "admin@example.com",
        "password": "adminpassword"
    })
    assert response.status_code == 200
    return response.json()["token"]


@pytest.fixture
def member_token(client):
    response = client.post("/api/auth/login", json={
        "email": "member@example.com",
        "password": "memberpassword"
    })
    assert response.status_code == 200
    return response.json()["token"]
