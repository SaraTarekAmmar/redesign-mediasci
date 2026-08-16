"""Sprint 7.1 project classification and default stages

Revision ID: e7f8a9b0c1d2
Revises: d5e6f7a8b9c0
Create Date: 2026-08-04 12:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update project classification 'project' -> 'standard'
    op.execute("UPDATE projects SET classification = 'standard' WHERE classification = 'project'")
    
    # 2. Update existing default statuses/stages for compatibility if necessary
    op.execute("UPDATE workflow_stages SET name = 'In Progress', slug = 'in-progress' WHERE name = 'Backlog'")
    op.execute("UPDATE workflow_stages SET name = 'In Revision', slug = 'in-revision' WHERE name = 'Review'")
    op.execute("UPDATE issue_statuses SET name = 'In Progress' WHERE name = 'Backlog'")
    op.execute("UPDATE issue_statuses SET name = 'In Revision' WHERE name = 'Review'")


def downgrade() -> None:
    op.execute("UPDATE projects SET classification = 'project' WHERE classification = 'standard'")
    op.execute("UPDATE workflow_stages SET name = 'Backlog', slug = 'backlog' WHERE name = 'In Progress'")
    op.execute("UPDATE workflow_stages SET name = 'Review', slug = 'review' WHERE name = 'In Revision'")
    op.execute("UPDATE issue_statuses SET name = 'Backlog' WHERE name = 'In Progress'")
    op.execute("UPDATE issue_statuses SET name = 'Review' WHERE name = 'In Revision'")
