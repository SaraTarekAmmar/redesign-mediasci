"""expand_team_resources

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a1b2
Create Date: 2026-08-03 17:05:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'd5e6f7a8b9c0'
down_revision = 'c3d4e5f6a1b2'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    
    tables = inspector.get_table_names()
    if 'team_resources' in tables:
        cols = [c['name'] for c in inspector.get_columns('team_resources')]
        if 'role_in_team' not in cols:
            op.add_column('team_resources', sa.Column('role_in_team', sa.String(50), nullable=True, server_default='member'))
        if 'joined_at' not in cols:
            op.add_column('team_resources', sa.Column('joined_at', sa.DateTime, nullable=True, server_default=sa.func.now()))
        if 'left_at' not in cols:
            op.add_column('team_resources', sa.Column('left_at', sa.DateTime, nullable=True))
        if 'is_primary_team' not in cols:
            op.add_column('team_resources', sa.Column('is_primary_team', sa.Boolean, nullable=True, server_default='1'))


def downgrade():
    pass
