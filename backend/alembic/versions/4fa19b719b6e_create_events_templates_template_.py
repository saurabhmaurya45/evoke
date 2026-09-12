"""create events templates template_versions drafts tables

Revision ID: 4fa19b719b6e
Revises: 86663db86541
Create Date: 2026-08-19 11:04:00.039009

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '4fa19b719b6e'
down_revision: Union[str, None] = '86663db86541'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create_type defaults to True: op.create_table below issues CREATE TYPE for these
    # automatically as part of creating the relevant table's columns.
    template_status = postgresql.ENUM("DRAFT", "ACTIVE", "ARCHIVED", name="template_status")
    template_version_status = postgresql.ENUM(
        "DRAFT", "PUBLISHED", "ARCHIVED", name="template_version_status"
    )
    event_type = postgresql.ENUM(
        "WEDDING",
        "ENGAGEMENT",
        "BIRTHDAY",
        "BABY_SHOWER",
        "CORPORATE_EVENT",
        "CONFERENCE",
        "PARTY",
        "OTHER",
        name="event_type",
    )
    event_status = postgresql.ENUM("DRAFT", "ARCHIVED", name="event_status")

    op.create_table(
        "templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column("name", sa.String(length=240), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("status", template_status, nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_unique_constraint("uq_templates_slug", "templates", ["slug"])

    op.create_table(
        "template_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("protocol_version", sa.Integer(), nullable=False),
        sa.Column("schema", sa.JSON(), nullable=False),
        sa.Column("default_config", sa.JSON(), nullable=True),
        sa.Column("status", template_version_status, nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], name="fk_template_versions_template_id"),
    )
    op.create_index("ix_template_versions_template_id", "template_versions", ["template_id"])
    op.create_unique_constraint(
        "uq_template_versions_template_id_version", "template_versions", ["template_id", "version"]
    )

    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", event_type, nullable=False, server_default="WEDDING"),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column("status", event_status, nullable=False, server_default="DRAFT"),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("template_version", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name="fk_events_owner_id"),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], name="fk_events_template_id"),
    )
    op.create_index("ix_events_owner_id", "events", ["owner_id"])
    op.create_unique_constraint("uq_events_slug", "events", ["slug"])

    op.create_table(
        "drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("template_version", sa.Integer(), nullable=True),
        sa.Column("schema_version", sa.Integer(), nullable=True),
        sa.Column("data", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], name="fk_drafts_event_id"),
        sa.ForeignKeyConstraint(["template_id"], ["templates.id"], name="fk_drafts_template_id"),
    )
    op.create_index("ix_drafts_event_id", "drafts", ["event_id"])
    op.create_unique_constraint("uq_drafts_event_id", "drafts", ["event_id"])


def downgrade() -> None:
    op.drop_index("ix_drafts_event_id", table_name="drafts")
    op.drop_table("drafts")

    op.drop_index("ix_events_owner_id", table_name="events")
    op.drop_table("events")

    op.drop_index("ix_template_versions_template_id", table_name="template_versions")
    op.drop_table("template_versions")

    op.drop_table("templates")

    postgresql.ENUM(name="event_status").drop(op.get_bind())
    postgresql.ENUM(name="event_type").drop(op.get_bind())
    postgresql.ENUM(name="template_version_status").drop(op.get_bind())
    postgresql.ENUM(name="template_status").drop(op.get_bind())
