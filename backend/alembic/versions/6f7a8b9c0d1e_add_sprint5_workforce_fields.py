"""Add Sprint 5 workforce fields and permissions

Revision ID: 6f7a8b9c0d1e
Revises: 5e6f7a8b9c0d
Create Date: 2026-07-31 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "6f7a8b9c0d1e"
down_revision: Union[str, Sequence[str], None] = "5e6f7a8b9c0d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


WORKFORCE_PERMISSIONS = {
    "view-skills": ("super-admin", "admin", "project-manager", "team-leader", "developer"),
    "manage-skills": ("super-admin", "admin", "project-manager", "team-leader"),
}


def _fetch_one(conn, sql: str, params: dict[str, object]) -> tuple | None:
    return conn.execute(sa.text(sql), params).first()


def _ensure_permission(conn, permission_name: str) -> int:
    row = _fetch_one(
        conn,
        "SELECT id FROM permissions WHERE name = :name LIMIT 1",
        {"name": permission_name},
    )
    if row:
        return int(row[0])

    result = conn.execute(
        sa.text(
            """
            INSERT INTO permissions (name, guard_name, created_at, updated_at)
            VALUES (:name, :guard_name, NOW(), NOW())
            """
        ),
        {"name": permission_name, "guard_name": "web"},
    )
    return int(result.lastrowid)


def _ensure_role_permission(conn, role_id: int, permission_id: int) -> None:
    row = _fetch_one(
        conn,
        """
        SELECT 1
        FROM role_has_permissions
        WHERE role_id = :role_id AND permission_id = :permission_id
        LIMIT 1
        """,
        {"role_id": role_id, "permission_id": permission_id},
    )
    if row:
        return

    conn.execute(
        sa.text(
            """
            INSERT INTO role_has_permissions (role_id, permission_id)
            VALUES (:role_id, :permission_id)
            """
        ),
        {"role_id": role_id, "permission_id": permission_id},
    )


def upgrade() -> None:
    conn = op.get_bind()

    # Add columns to users table safely
    inspector = sa.inspect(conn)
    users_cols = [c["name"] for c in inspector.get_columns("users")]

    if "position" not in users_cols:
        op.add_column("users", sa.Column("position", sa.String(255), nullable=True))
    if "seniority" not in users_cols:
        op.add_column("users", sa.Column("seniority", sa.String(50), nullable=True, server_default="Mid"))
    if "capacity" not in users_cols:
        op.add_column("users", sa.Column("capacity", sa.Integer(), nullable=True, server_default="40"))
    if "availability" not in users_cols:
        op.add_column("users", sa.Column("availability", sa.String(50), nullable=True, server_default="Available"))
    if "hourly_cost" not in users_cols:
        op.add_column("users", sa.Column("hourly_cost", sa.Numeric(10, 2), nullable=True))

    # Add columns to skill_user table safely
    if "skill_user" in inspector.get_table_names():
        su_cols = [c["name"] for c in inspector.get_columns("skill_user")]
        if "proficiency_level" not in su_cols:
            op.add_column("skill_user", sa.Column("proficiency_level", sa.String(50), nullable=True))
        if "years_of_experience" not in su_cols:
            op.add_column("skill_user", sa.Column("years_of_experience", sa.Float(), nullable=True))

    # Seed permissions
    role_ids: dict[str, int] = {}
    for role_name in {"super-admin", "admin", "project-manager", "team-leader", "developer"}:
        row = _fetch_one(
            conn,
            "SELECT id FROM roles WHERE name = :name LIMIT 1",
            {"name": role_name},
        )
        if row:
            role_ids[role_name] = int(row[0])

    for permission_name, roles in WORKFORCE_PERMISSIONS.items():
        permission_id = _ensure_permission(conn, permission_name)
        for role_name in roles:
            role_id = role_ids.get(role_name)
            if role_id:
                _ensure_role_permission(conn, role_id, permission_id)


def downgrade() -> None:
    pass
