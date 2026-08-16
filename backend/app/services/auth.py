from datetime import datetime, timezone

from sqlalchemy import select
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.team import Team
from app.models.user import Role, User, team_user, user_roles_table
from app.security import create_access_token, hash_password, verify_password


def serialize_user(user: User, db: Session) -> dict:
    role_ids = [
        row.role_id
        for row in db.execute(
            user_roles_table.select().where(user_roles_table.c.model_id == user.id)
        ).fetchall()
    ]
    roles = db.query(Role).filter(Role.id.in_(role_ids)).all() if role_ids else []

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "bio": user.bio,
        "phone": user.phone,
        "job_title": user.job_title,
        "timezone": user.timezone,
        "avatar": user.avatar,
        "avatar_url": user.avatar_url,
        "is_active": bool(user.is_active),
        "last_active_at": user.last_active_at,
        "roles": [{"name": role.name} for role in roles],
        "teams": [
            {"id": int(team.id), "name": team.name}
            for team in db.execute(
                select(Team.__table__.c.id, Team.__table__.c.name)
                .select_from(Team.__table__)
                .join(team_user, team_user.c.team_id == Team.__table__.c.id)
                .where(team_user.c.user_id == user.id)
                .order_by(Team.__table__.c.name)
            ).all()
        ],
    }


def login_user(db: Session, email: str, password: str) -> tuple[User, str]:
    user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()
    if user is None or not verify_password(password, user.password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"errors": {"email": ["The provided credentials are incorrect."]}},
        )

    user.last_active_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return user, token


def register_user(
    db: Session,
    *,
    name: str,
    email: str,
    password: str,
    password_confirmation: str,
    timezone_name: str | None,
) -> tuple[User, str]:
    if password != password_confirmation:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"errors": {"password": ["The password confirmation does not match."]}},
        )

    existing = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"errors": {"email": ["The email has already been taken."]}},
        )

    user = User(
        name=name,
        email=email,
        password=hash_password(password),
        timezone=timezone_name or "UTC",
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        last_active_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return user, token


def update_profile(db: Session, user: User, payload: dict) -> User:
    password = payload.pop("password", None)
    password_confirmation = payload.pop("password_confirmation", None)
    if password:
        if password != password_confirmation:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"errors": {"password": ["The password confirmation does not match."]}},
            )
        user.password = hash_password(password)

    for key, value in payload.items():
        if value is not None and hasattr(user, key):
            setattr(user, key, value)

    user.updated_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
