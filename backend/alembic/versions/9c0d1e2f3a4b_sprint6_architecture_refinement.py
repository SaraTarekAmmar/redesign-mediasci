"""Sprint 6 Architecture Refinement Migration

Revision ID: 9c0d1e2f3a4b
Revises: 8b9c0d1e2f3a
Create Date: 2026-08-03 01:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "9c0d1e2f3a4b"
down_revision: Union[str, Sequence[str], None] = "8b9c0d1e2f3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    time_logs_cols = [c["name"] for c in inspector.get_columns("time_logs")] if "time_logs" in existing_tables else []

    # 1. Create issue_ai_analyses table if not exists
    if "issue_ai_analyses" not in existing_tables:
        op.create_table(
            "issue_ai_analyses",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("issue_id", sa.Integer(), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("estimated_hours", sa.Numeric(10, 2), nullable=True),
            sa.Column("suggested_priority", sa.String(50), nullable=True),
            sa.Column("suggested_risk", sa.String(50), nullable=True),
            sa.Column("suggested_resource_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("suggested_due_date", sa.DateTime(), nullable=True),
            sa.Column("suggested_story_points", sa.Integer(), nullable=True),
            sa.Column("confidence_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("similar_tasks", sa.JSON(), nullable=True),
            sa.Column("generated_by_model", sa.String(100), server_default="gemini-flash"),
            sa.Column("generated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("accepted", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("accepted_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("accepted_at", sa.DateTime(), nullable=True),
        )

    # 2. Add billing approval columns to time_logs table if not exists
    if "approved" not in time_logs_cols:
        op.add_column("time_logs", sa.Column("approved", sa.Boolean(), server_default=sa.text("0")))
    if "approved_by" not in time_logs_cols:
        op.add_column("time_logs", sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    if "approved_at" not in time_logs_cols:
        op.add_column("time_logs", sa.Column("approved_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    pass
