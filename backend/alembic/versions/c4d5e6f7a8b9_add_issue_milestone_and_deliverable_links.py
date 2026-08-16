"""Add issue milestone and deliverable links

Revision ID: c4d5e6f7a8b9
Revises: a1b2c3d4e5f6
Create Date: 2026-08-04 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("issues", sa.Column("milestone_id", sa.Integer(), nullable=True))
    op.add_column("issues", sa.Column("deliverable_id", sa.Integer(), nullable=True))
    op.create_index("ix_issues_milestone_id", "issues", ["milestone_id"])
    op.create_index("ix_issues_deliverable_id", "issues", ["deliverable_id"])
    op.create_foreign_key(
        "fk_issues_milestone_id_project_milestones",
        "issues",
        "project_milestones",
        ["milestone_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_issues_deliverable_id_project_deliverables",
        "issues",
        "project_deliverables",
        ["deliverable_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_issues_deliverable_id_project_deliverables", "issues", type_="foreignkey")
    op.drop_constraint("fk_issues_milestone_id_project_milestones", "issues", type_="foreignkey")
    op.drop_index("ix_issues_deliverable_id", table_name="issues")
    op.drop_index("ix_issues_milestone_id", table_name="issues")
    op.drop_column("issues", "deliverable_id")
    op.drop_column("issues", "milestone_id")
