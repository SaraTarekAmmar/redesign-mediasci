"""Partner teams and selective external workforce assignments.

Revision ID: j1a2b3c4d5e6
Revises: i1a2b3c4d5e6
Create Date: 2026-08-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "j1a2b3c4d5e6"
down_revision: Union[str, None] = "i1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "partner_teams" not in tables:
        op.create_table(
            "partner_teams",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("partner_id", sa.Integer(), sa.ForeignKey("partners.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Integer(), nullable=True, server_default="1"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.Column("deleted_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_partner_teams_partner_id", "partner_teams", ["partner_id"])

    if "partner_team_members" not in tables:
        op.create_table(
            "partner_team_members",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("partner_team_id", sa.Integer(), sa.ForeignKey("partner_teams.id", ondelete="CASCADE"), nullable=False),
            sa.Column("partner_member_id", sa.Integer(), sa.ForeignKey("partner_members.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("partner_team_id", "partner_member_id", name="uq_partner_team_member"),
        )
        op.create_index("ix_partner_team_members_team_id", "partner_team_members", ["partner_team_id"])
        op.create_index("ix_partner_team_members_member_id", "partner_team_members", ["partner_member_id"])

    if "project_partner_teams" not in tables:
        op.create_table(
            "project_partner_teams",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("partner_team_id", sa.Integer(), sa.ForeignKey("partner_teams.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("project_id", "partner_team_id", name="uq_project_partner_team"),
        )
        op.create_index("ix_project_partner_teams_project_id", "project_partner_teams", ["project_id"])
        op.create_index("ix_project_partner_teams_team_id", "project_partner_teams", ["partner_team_id"])

    if "project_partner_members" not in tables:
        op.create_table(
            "project_partner_members",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("partner_member_id", sa.Integer(), sa.ForeignKey("partner_members.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("project_id", "partner_member_id", name="uq_project_partner_member"),
        )
        op.create_index("ix_project_partner_members_project_id", "project_partner_members", ["project_id"])
        op.create_index("ix_project_partner_members_member_id", "project_partner_members", ["partner_member_id"])

    member_columns = {column["name"] for column in inspector.get_columns("partner_members")}
    if "user_id" not in member_columns:
        op.add_column("partner_members", sa.Column("user_id", sa.Integer(), nullable=True))
        op.create_index("ix_partner_members_user_id", "partner_members", ["user_id"])
        op.create_foreign_key(
            "fk_partner_members_user_id_users",
            "partner_members",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "partner_members" in tables:
        member_columns = {column["name"] for column in inspector.get_columns("partner_members")}
        if "user_id" in member_columns:
            foreign_keys = {fk.get("name") for fk in inspector.get_foreign_keys("partner_members")}
            if "fk_partner_members_user_id_users" in foreign_keys:
                op.drop_constraint("fk_partner_members_user_id_users", "partner_members", type_="foreignkey")
            indexes = {index.get("name") for index in inspector.get_indexes("partner_members")}
            if "ix_partner_members_user_id" in indexes:
                op.drop_index("ix_partner_members_user_id", table_name="partner_members")
            op.drop_column("partner_members", "user_id")

    for table_name in (
        "project_partner_members",
        "project_partner_teams",
        "partner_team_members",
        "partner_teams",
    ):
        if table_name in tables:
            op.drop_table(table_name)
