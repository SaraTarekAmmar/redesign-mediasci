"""Refine workforce hierarchy

Revision ID: 5e6f7a8b9c0d
Revises: 1f2d3c4b5a6e
Create Date: 2026-07-31 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5e6f7a8b9c0d"
down_revision: Union[str, Sequence[str], None] = "1f2d3c4b5a6e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("teams", sa.Column("department_id", sa.Integer(), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE teams t
            JOIN (
                SELECT team_id, MIN(department_id) AS department_id
                FROM department_team
                WHERE department_id IS NOT NULL
                GROUP BY team_id
            ) src ON src.team_id = t.id
            SET t.department_id = src.department_id
            WHERE t.department_id IS NULL
            """
        )
    )

    op.create_index("ix_teams_department_id", "teams", ["department_id"], unique=False)
    op.create_foreign_key(
        "fk_teams_department_id_departments",
        "teams",
        "departments",
        ["department_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint("fk_teams_department_id_departments", "teams", type_="foreignkey")
    op.drop_index("ix_teams_department_id", table_name="teams")
    op.drop_column("teams", "department_id")
