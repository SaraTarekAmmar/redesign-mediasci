"""sprint6_5_resource_standardization

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-08-03 16:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a1'
down_revision = '9c0d1e2f3a4b'

branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)

    # 1. Add complete workforce schema columns to resources table if missing
    resource_columns = [c['name'] for c in inspector.get_columns('resources')]

    if 'employee_number' not in resource_columns:
        op.add_column('resources', sa.Column('employee_number', sa.String(50), nullable=True))
    if 'position' not in resource_columns:
        op.add_column('resources', sa.Column('position', sa.String(100), nullable=True))
    if 'seniority' not in resource_columns:
        op.add_column('resources', sa.Column('seniority', sa.String(50), nullable=True))
    if 'salary' not in resource_columns:
        op.add_column('resources', sa.Column('salary', sa.Numeric(12, 2), nullable=True, server_default='0.00'))
    if 'currency' not in resource_columns:
        op.add_column('resources', sa.Column('currency', sa.String(10), nullable=True, server_default='USD'))
    if 'cost_per_hour' not in resource_columns:
        op.add_column('resources', sa.Column('cost_per_hour', sa.Numeric(10, 2), nullable=True, server_default='0.00'))
    if 'weekly_capacity' not in resource_columns:
        op.add_column('resources', sa.Column('weekly_capacity', sa.Numeric(10, 2), nullable=True, server_default='40.00'))
    if 'daily_capacity_hours' not in resource_columns:
        op.add_column('resources', sa.Column('daily_capacity_hours', sa.Numeric(10, 2), nullable=True, server_default='8.00'))
    if 'availability_status' not in resource_columns:
        op.add_column('resources', sa.Column('availability_status', sa.String(50), nullable=True, server_default='available'))
    if 'utilization_rate' not in resource_columns:
        op.add_column('resources', sa.Column('utilization_rate', sa.Numeric(5, 2), nullable=True, server_default='0.00'))
    if 'certifications' not in resource_columns:
        op.add_column('resources', sa.Column('certifications', sa.JSON, nullable=True))
    if 'experience_years' not in resource_columns:
        op.add_column('resources', sa.Column('experience_years', sa.Float, nullable=True, server_default='0'))
    if 'manager_id' not in resource_columns:
        op.add_column('resources', sa.Column('manager_id', sa.Integer, sa.ForeignKey('resources.id'), nullable=True))
    if 'hire_date' not in resource_columns:
        op.add_column('resources', sa.Column('hire_date', sa.Date, nullable=True))
    if 'contract_type' not in resource_columns:
        op.add_column('resources', sa.Column('contract_type', sa.String(50), nullable=True, server_default='full_time'))

    # 2. Create team_resources table if not existing
    tables = inspector.get_table_names()
    if 'team_resources' not in tables:
        op.create_table(
            'team_resources',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('team_id', sa.Integer, sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
            sa.Column('resource_id', sa.Integer, sa.ForeignKey('resources.id', ondelete='CASCADE'), nullable=False),
            sa.Column('role', sa.String(50), server_default='member'),
            sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
        )

    # 3. Reflection-based Python data sync to backfill resources for all existing users
    meta = sa.MetaData()
    users_t = sa.Table('users', meta, autoload_with=conn)
    resources_t = sa.Table('resources', meta, autoload_with=conn)

    users = conn.execute(sa.select(users_t)).mappings().all()
    count = 1
    for u in users:
        existing = conn.execute(sa.select(resources_t).where(resources_t.c.user_id == u['id'])).first()
        if not existing:
            emp_num = f"EMP-{u['id']:03d}"
            conn.execute(
                resources_t.insert().values(
                    user_id=u['id'],
                    employee_number=emp_num,
                    department_id=u.get('department_id'),
                    name=u.get('name', 'Resource'),
                    email=u.get('email'),
                    position=u.get('position') or 'Team Member',
                    seniority=u.get('seniority') or 'mid',
                    salary=u.get('salary') or 0.00,
                    currency=u.get('currency') or 'USD',
                    cost_per_hour=u.get('hourly_cost') or 0.00,
                    weekly_capacity=u.get('capacity_hrs_week') or 40.00,
                    daily_capacity_hours=8.00,
                    availability_status=u.get('availability_status') or 'available',
                    contract_type='full_time',
                    is_active=1 if u.get('is_active', 1) else 0,
                )
            )
            count += 1


def downgrade():
    pass
