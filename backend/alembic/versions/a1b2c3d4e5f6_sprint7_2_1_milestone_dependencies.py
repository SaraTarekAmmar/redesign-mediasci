"""Sprint 7.2.1 milestone dependencies

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-08-04 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_milestone_dependencies",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("predecessor_milestone_id", sa.Integer(), sa.ForeignKey("project_milestones.id", ondelete="CASCADE"), nullable=False),
        sa.Column("successor_milestone_id", sa.Integer(), sa.ForeignKey("project_milestones.id", ondelete="CASCADE"), nullable=False),
        sa.Column("dependency_type", sa.String(length=50), nullable=False, server_default=sa.text("'finish_to_start'")),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("predecessor_milestone_id", "successor_milestone_id", name="uq_project_milestone_dependencies_pair"),
    )
    op.create_index(
        "ix_project_milestone_dependencies_predecessor_milestone_id",
        "project_milestone_dependencies",
        ["predecessor_milestone_id"],
    )
    op.create_index(
        "ix_project_milestone_dependencies_successor_milestone_id",
        "project_milestone_dependencies",
        ["successor_milestone_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_project_milestone_dependencies_successor_milestone_id", table_name="project_milestone_dependencies")
    op.drop_index("ix_project_milestone_dependencies_predecessor_milestone_id", table_name="project_milestone_dependencies")
    op.drop_table("project_milestone_dependencies")
