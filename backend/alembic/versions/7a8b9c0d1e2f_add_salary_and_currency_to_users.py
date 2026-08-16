"""Add salary and currency columns to users table

Revision ID: 7a8b9c0d1e2f
Revises: 6f7a8b9c0d1e
Create Date: 2026-08-01 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "7a8b9c0d1e2f"
down_revision: Union[str, Sequence[str], None] = "6f7a8b9c0d1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    users_cols = [c["name"] for c in inspector.get_columns("users")]

    if "salary" not in users_cols:
        op.add_column("users", sa.Column("salary", sa.Numeric(12, 2), nullable=True))
    if "currency" not in users_cols:
        op.add_column("users", sa.Column("currency", sa.String(10), nullable=True, server_default="USD"))


def downgrade() -> None:
    pass
