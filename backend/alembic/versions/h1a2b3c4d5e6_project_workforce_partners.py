"""Project workforce: external partners, partner members, project-partner links,
external task assignees, project_teams backfill, and partner permissions.

Revision ID: h1a2b3c4d5e6
Revises: g1a2b3c4d5e6
Create Date: 2026-08-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h1a2b3c4d5e6"
down_revision: Union[str, None] = "g1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PARTNER_PERMISSIONS = ("view-partners", "manage-partners")
PARTNER_PERMISSION_ROLES = ("super-admin", "admin", "project-manager", "team-leader", "account-manager")


def _fetch_one(conn, sql: str, params: dict[str, object]):
    return conn.execute(sa.text(sql), params).first()


def _ensure_permission(conn, permission_name: str) -> int:
    row = _fetch_one(conn, "SELECT id FROM permissions WHERE name = :name LIMIT 1", {"name": permission_name})
    if row:
        return int(row[0])
    result = conn.execute(
        sa.text(
            """
            INSERT INTO permissions (name, guard_name, created_at, updated_at)
            VALUES (:name, :guard_name, NOW(), NOW())
            """
        ),
        {"name": permission_name, "guard_name": "web"},
    )
    return int(result.lastrowid)


def _ensure_role_permission(conn, role_id: int, permission_id: int) -> None:
    row = _fetch_one(
        conn,
        "SELECT 1 FROM role_has_permissions WHERE role_id = :role_id AND permission_id = :permission_id LIMIT 1",
        {"role_id": role_id, "permission_id": permission_id},
    )
    if row:
        return
    conn.execute(
        sa.text("INSERT INTO role_has_permissions (role_id, permission_id) VALUES (:role_id, :permission_id)"),
        {"role_id": role_id, "permission_id": permission_id},
    )


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    if "partners" not in tables:
        op.create_table(
            "partners",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("company", sa.String(255), nullable=True),
            sa.Column("specialty", sa.String(255), nullable=True),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("phone", sa.String(50), nullable=True),
            sa.Column("website", sa.String(500), nullable=True),
            sa.Column("status", sa.String(50), nullable=True, server_default="active"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("color", sa.String(50), nullable=True, server_default="#F59E0B"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.Column("deleted_at", sa.DateTime(), nullable=True),
        )

    if "partner_members" not in tables:
        op.create_table(
            "partner_members",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("partner_id", sa.Integer(), sa.ForeignKey("partners.id"), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("phone", sa.String(50), nullable=True),
            sa.Column("role", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Integer(), nullable=True, server_default="1"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.Column("deleted_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_partner_members_partner_id", "partner_members", ["partner_id"])

    if "project_partners" not in tables:
        op.create_table(
            "project_partners",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE")),
            sa.Column("partner_id", sa.Integer(), sa.ForeignKey("partners.id", ondelete="CASCADE")),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_project_partners_project_id", "project_partners", ["project_id"])
        op.create_index("ix_project_partners_partner_id", "project_partners", ["partner_id"])

    issue_cols = {c["name"] for c in inspector.get_columns("issues")}
    if "external_assignee_id" not in issue_cols:
        op.add_column("issues", sa.Column("external_assignee_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_issues_external_assignee_partner_members",
            "issues",
            "partner_members",
            ["external_assignee_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # Backfill: ensure every project's primary team_id is also present in project_teams,
    # making the M2M table the authoritative source for assigned teams.
    conn.execute(
        sa.text(
            """
            INSERT INTO project_teams (project_id, team_id, created_at, updated_at)
            SELECT p.id, p.team_id, NOW(), NOW()
            FROM projects p
            WHERE p.team_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM project_teams pt
                  WHERE pt.project_id = p.id AND pt.team_id = p.team_id
              )
            """
        )
    )

    # Seed partner permissions and attach to the same roles that manage clients.
    role_ids = {}
    for role_name in PARTNER_PERMISSION_ROLES:
        row = _fetch_one(conn, "SELECT id FROM roles WHERE name = :name LIMIT 1", {"name": role_name})
        if row:
            role_ids[role_name] = int(row[0])
    for permission_name in PARTNER_PERMISSIONS:
        permission_id = _ensure_permission(conn, permission_name)
        for role_id in role_ids.values():
            _ensure_role_permission(conn, role_id, permission_id)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = set(inspector.get_table_names())

    for permission_name in PARTNER_PERMISSIONS:
        row = _fetch_one(conn, "SELECT id FROM permissions WHERE name = :name LIMIT 1", {"name": permission_name})
        if not row:
            continue
        permission_id = int(row[0])
        conn.execute(
            sa.text("DELETE FROM role_has_permissions WHERE permission_id = :permission_id"),
            {"permission_id": permission_id},
        )
        conn.execute(sa.text("DELETE FROM permissions WHERE id = :permission_id"), {"permission_id": permission_id})

    issue_cols = {c["name"] for c in inspector.get_columns("issues")}
    if "external_assignee_id" in issue_cols:
        op.drop_constraint("fk_issues_external_assignee_partner_members", "issues", type_="foreignkey")
        op.drop_column("issues", "external_assignee_id")

    if "project_partners" in tables:
        op.drop_table("project_partners")
    if "partner_members" in tables:
        op.drop_table("partner_members")
    if "partners" in tables:
        op.drop_table("partners")
