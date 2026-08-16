"""Sprint 6 Task Execution Engine & Workflow Management Migration

Revision ID: 8b9c0d1e2f3a
Revises: 7a8b9c0d1e2f
Create Date: 2026-08-03 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "8b9c0d1e2f3a"
down_revision: Union[str, Sequence[str], None] = "7a8b9c0d1e2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    issues_cols = [c["name"] for c in inspector.get_columns("issues")] if "issues" in existing_tables else []

    # 1. Update issues table with new execution & AI fields
    cols_to_add = [
        ("acceptance_criteria", sa.Text(), True),
        ("definition_of_ready", sa.Text(), True),
        ("definition_of_done", sa.Text(), True),
        ("estimated_hours", sa.Numeric(10, 2), True),
        ("actual_hours", sa.Numeric(10, 2), True),
        ("remaining_hours", sa.Numeric(10, 2), True),
        ("completion_percentage", sa.Integer(), True),
        ("ai_estimated_hours", sa.Numeric(10, 2), True),
        ("ai_priority", sa.String(50), True),
        ("ai_risk", sa.String(50), True),
        ("ai_suggested_resource_id", sa.Integer(), True),
        ("ai_similar_tasks", sa.JSON(), True),
        ("ai_confidence_score", sa.Numeric(5, 2), True),
    ]

    for col_name, col_type, is_null in cols_to_add:
        if col_name not in issues_cols:
            op.add_column("issues", sa.Column(col_name, col_type, nullable=is_null))

    # 2. Create task_activities table if not exists
    if "task_activities" not in existing_tables:
        op.create_table(
            "task_activities",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("issue_id", sa.Integer(), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("activity_type", sa.String(100), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("extra_data", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    # 3. Create task_checklists table if not exists
    if "task_checklists" not in existing_tables:
        op.create_table(
            "task_checklists",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("issue_id", sa.Integer(), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(500), nullable=False),
            sa.Column("completed", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("completed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("position", sa.Integer(), server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")),
        )

    # 4. Create workflow_stages table if not exists
    if "workflow_stages" not in existing_tables:
        op.create_table(
            "workflow_stages",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(100), nullable=False),
            sa.Column("category", sa.String(50), server_default="todo"),
            sa.Column("color", sa.String(50), server_default="#6366F1"),
            sa.Column("position", sa.Integer(), server_default=sa.text("0")),
            sa.Column("wip_limit", sa.Integer(), nullable=True),
            sa.Column("is_initial", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("is_final", sa.Boolean(), server_default=sa.text("0")),
            sa.Column("is_active", sa.Boolean(), server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")),
        )


def downgrade() -> None:
    pass
