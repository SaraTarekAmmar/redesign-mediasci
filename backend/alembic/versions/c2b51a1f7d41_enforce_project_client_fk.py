"""Enforce project client ownership

Revision ID: c2b51a1f7d41
Revises: 0fc851f128ff
Create Date: 2026-07-31 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2b51a1f7d41"
down_revision: Union[str, Sequence[str], None] = "0fc851f128ff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    client_id = bind.execute(
        sa.text(
            "SELECT id FROM clients WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 1"
        )
    ).scalar()

    if client_id is None:
        raise RuntimeError(
            "Cannot enforce projects.client_id as NOT NULL because no active clients exist."
        )

    bind.execute(
        sa.text(
            "UPDATE projects SET client_id = :client_id WHERE client_id IS NULL"
        ),
        {"client_id": client_id},
    )

    op.alter_column(
        "projects",
        "client_id",
        existing_type=sa.Integer(),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "projects",
        "client_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
