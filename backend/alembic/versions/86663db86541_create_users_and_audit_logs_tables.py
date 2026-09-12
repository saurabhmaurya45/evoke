"""create users and audit_logs tables

Revision ID: 86663db86541
Revises: 
Create Date: 2026-08-17 23:21:49.901679

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '86663db86541'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create_type defaults to True: op.create_table below issues CREATE TYPE for these
    # automatically as part of creating the "users" table's columns.
    user_role = postgresql.ENUM("USER", "EDITOR", "ADMIN", name="user_role")
    user_status = postgresql.ENUM("ACTIVE", "DISABLED", name="user_status")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("auth_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("first_name", sa.String(length=120), nullable=True),
        sa.Column("last_name", sa.String(length=120), nullable=True),
        sa.Column("display_name", sa.String(length=240), nullable=True),
        sa.Column("role", user_role, nullable=False, server_default="USER"),
        sa.Column("status", user_status, nullable=False, server_default="ACTIVE"),
        sa.Column("profile_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint("uq_users_auth_user_id", "users", ["auth_user_id"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_logs_resource", "audit_logs", ["resource_type", "resource_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_resource", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_constraint("uq_users_auth_user_id", "users", type_="unique")
    op.drop_table("users")

    postgresql.ENUM(name="user_status").drop(op.get_bind())
    postgresql.ENUM(name="user_role").drop(op.get_bind())
