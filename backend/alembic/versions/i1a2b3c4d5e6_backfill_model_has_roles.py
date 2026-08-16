"""Backfill model_has_roles from the legacy users.role_id column.

Some seeders assigned roles only via users.role_id, which the RBAC layer
(model_has_roles / Spatie-style tables) never reads. Affected users therefore
had no effective roles or permissions (e.g. partner endpoints returned 403
even for the demo super-admin). This backfills the missing assignment rows.

Revision ID: i1a2b3c4d5e6
Revises: h1a2b3c4d5e6
Create Date: 2026-08-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i1a2b3c4d5e6"
down_revision: Union[str, None] = "h1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO model_has_roles (role_id, model_type, model_id)
            SELECT u.role_id, :model_type, u.id
            FROM users u
            INNER JOIN roles r ON r.id = u.role_id
            WHERE u.role_id IS NOT NULL
              AND u.deleted_at IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM model_has_roles mhr
                  WHERE mhr.model_id = u.id
                    AND mhr.model_type LIKE :user_like
              )
            """
        ),
        {"model_type": "App\\Models\\User", "user_like": "%User"},
    )


def downgrade() -> None:
    # Data backfill; nothing safe to reverse (rows are indistinguishable from
    # legitimately assigned roles).
    pass
