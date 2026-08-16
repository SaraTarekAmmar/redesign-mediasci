"""Add missing client permissions

Revision ID: d4b8e7c1a2f3
Revises: c2b51a1f7d41
Create Date: 2026-07-31 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4b8e7c1a2f3"
down_revision: Union[str, Sequence[str], None] = "c2b51a1f7d41"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CLIENT_PERMISSIONS = ("view-clients", "manage-clients")
CLIENT_PERMISSION_ROLES = ("super-admin", "admin", "project-manager", "team-leader", "account-manager")


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

    role_ids = {}
    for role_name in CLIENT_PERMISSION_ROLES:
        row = _fetch_one(
            conn,
            "SELECT id FROM roles WHERE name = :name LIMIT 1",
            {"name": role_name},
        )
        if row:
            role_ids[role_name] = int(row[0])

    for permission_name in CLIENT_PERMISSIONS:
        permission_id = _ensure_permission(conn, permission_name)
        for role_id in role_ids.values():
            _ensure_role_permission(conn, role_id, permission_id)


def downgrade() -> None:
    conn = op.get_bind()

    for permission_name in CLIENT_PERMISSIONS:
        row = _fetch_one(
            conn,
            "SELECT id FROM permissions WHERE name = :name LIMIT 1",
            {"name": permission_name},
        )
        if not row:
            continue

        permission_id = int(row[0])
        conn.execute(
            sa.text("DELETE FROM role_has_permissions WHERE permission_id = :permission_id"),
            {"permission_id": permission_id},
        )
        conn.execute(
            sa.text("DELETE FROM permissions WHERE id = :permission_id"),
            {"permission_id": permission_id},
        )
