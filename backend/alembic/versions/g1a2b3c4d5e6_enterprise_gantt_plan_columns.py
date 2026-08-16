"""Add project_id/type to plans and type/is_milestone to plan_tasks for Enterprise Gantt.

Revision ID: g1a2b3c4d5e6
Revises: c4d5e6f7a8b9
Create Date: 2026-08-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g1a2b3c4d5e6"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    plan_cols = {c["name"] for c in inspector.get_columns("plans")}
    task_cols = {c["name"] for c in inspector.get_columns("plan_tasks")}

    if "project_id" not in plan_cols:
        op.add_column("plans", sa.Column("project_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_plans_project_id_projects",
            "plans",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index("ix_plans_project_id", "plans", ["project_id"])

    if "type" not in plan_cols:
        op.add_column("plans", sa.Column("type", sa.String(length=100), nullable=True))

    if "type" not in task_cols:
        op.add_column("plan_tasks", sa.Column("type", sa.String(length=50), nullable=True))

    if "is_milestone" not in task_cols:
        op.add_column("plan_tasks", sa.Column("is_milestone", sa.Integer(), nullable=True, server_default="0"))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    plan_cols = {c["name"] for c in inspector.get_columns("plans")}
    task_cols = {c["name"] for c in inspector.get_columns("plan_tasks")}

    if "is_milestone" in task_cols:
        op.drop_column("plan_tasks", "is_milestone")
    if "type" in task_cols:
        op.drop_column("plan_tasks", "type")

    if "type" in plan_cols:
        op.drop_column("plans", "type")
    if "project_id" in plan_cols:
        op.drop_index("ix_plans_project_id", table_name="plans")
        op.drop_constraint("fk_plans_project_id_projects", "plans", type_="foreignkey")
        op.drop_column("plans", "project_id")
