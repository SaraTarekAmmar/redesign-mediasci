"""sprint6_5_1_resource_refactor

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-08-03 16:40:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector
import json

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a1b2'
down_revision = 'b2c3d4e5f6a1'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    # 1. Create skills table
    if 'skills' not in tables:
        op.create_table(
            'skills',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('name', sa.String(100), nullable=False, unique=True),
            sa.Column('category', sa.String(50), nullable=True),
            sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
        )

    # 2. Create resource_skills table
    if 'resource_skills' not in tables:
        op.create_table(
            'resource_skills',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('resource_id', sa.Integer, sa.ForeignKey('resources.id', ondelete='CASCADE'), nullable=False),
            sa.Column('skill_id', sa.Integer, sa.ForeignKey('skills.id', ondelete='CASCADE'), nullable=False),
            sa.Column('proficiency', sa.String(50), server_default='mid'),
            sa.Column('years_of_experience', sa.Float, server_default='1.0'),
            sa.Column('verified', sa.Boolean, server_default='0'),
            sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
        )

    # 3. Create certifications table
    if 'certifications' not in tables:
        op.create_table(
            'certifications',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('provider', sa.String(255), nullable=True),
            sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
        )

    # 4. Create resource_certifications table
    if 'resource_certifications' not in tables:
        op.create_table(
            'resource_certifications',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('resource_id', sa.Integer, sa.ForeignKey('resources.id', ondelete='CASCADE'), nullable=False),
            sa.Column('certification_id', sa.Integer, sa.ForeignKey('certifications.id', ondelete='CASCADE'), nullable=False),
            sa.Column('issue_date', sa.Date, nullable=True),
            sa.Column('expiry_date', sa.Date, nullable=True),
            sa.Column('credential_id', sa.String(100), nullable=True),
            sa.Column('url', sa.String(500), nullable=True),
            sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
        )

    # 5. Drop static utilization_rate column if exists
    resource_cols = [c['name'] for c in inspector.get_columns('resources')]
    if 'utilization_rate' in resource_cols:
        try:
            op.drop_column('resources', 'utilization_rate')
        except Exception:
            pass


def downgrade():
    pass
