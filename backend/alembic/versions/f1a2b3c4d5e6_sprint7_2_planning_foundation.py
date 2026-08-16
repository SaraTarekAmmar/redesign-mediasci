"""Sprint 7.2 planning foundation

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Create Date: 2026-08-04 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_planning_baselines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("planned_duration_days", sa.Integer(), nullable=True, default=0),
        sa.Column("planned_budget", sa.Numeric(12, 2), nullable=True, default=0),
        sa.Column("planned_hours", sa.Numeric(10, 2), nullable=True, default=0),
        sa.Column("planned_resources_count", sa.Integer(), nullable=True, default=0),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("project_id", name="uq_project_planning_baselines_project_id"),
    )
    op.create_index(
        "ix_project_planning_baselines_project_id",
        "project_planning_baselines",
        ["project_id"],
    )

    op.create_table(
        "project_milestones",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("planned_start_date", sa.Date(), nullable=True),
        sa.Column("planned_end_date", sa.Date(), nullable=True),
        sa.Column("actual_start_date", sa.Date(), nullable=True),
        sa.Column("actual_end_date", sa.Date(), nullable=True),
        sa.Column("planned_hours", sa.Numeric(10, 2), nullable=True, default=0),
        sa.Column("planned_budget", sa.Numeric(12, 2), nullable=True, default=0),
        sa.Column("planned_progress", sa.Numeric(5, 2), nullable=True, default=0),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("owner_resource_id", sa.Integer(), sa.ForeignKey("resources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=True, default=0),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_project_milestones_project_id", "project_milestones", ["project_id"])
    op.create_index("ix_project_milestones_owner_resource_id", "project_milestones", ["owner_resource_id"])

    op.create_table(
        "project_deliverables",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("milestone_id", sa.Integer(), sa.ForeignKey("project_milestones.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("acceptance_criteria", sa.Text(), nullable=True),
        sa.Column("planned_completion_date", sa.Date(), nullable=True),
        sa.Column("actual_completion_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=True),
        sa.Column("owner_resource_id", sa.Integer(), sa.ForeignKey("resources.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_project_deliverables_milestone_id", "project_deliverables", ["milestone_id"])
    op.create_index("ix_project_deliverables_owner_resource_id", "project_deliverables", ["owner_resource_id"])


def downgrade() -> None:
    op.drop_index("ix_project_deliverables_owner_resource_id", table_name="project_deliverables")
    op.drop_index("ix_project_deliverables_milestone_id", table_name="project_deliverables")
    op.drop_table("project_deliverables")

    op.drop_index("ix_project_milestones_owner_resource_id", table_name="project_milestones")
    op.drop_index("ix_project_milestones_project_id", table_name="project_milestones")
    op.drop_table("project_milestones")

    op.drop_index("ix_project_planning_baselines_project_id", table_name="project_planning_baselines")
    op.drop_table("project_planning_baselines")
