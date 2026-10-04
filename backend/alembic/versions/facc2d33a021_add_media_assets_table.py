"""add_media_assets_table

Revision ID: facc2d33a021
Revises: d4e8a2c6f1b7
Create Date: 2026-10-03 19:31:16.528429

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'facc2d33a021'
down_revision: Union[str, None] = 'd4e8a2c6f1b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create_type defaults to True: op.create_table below issues CREATE TYPE for these
    # automatically as part of creating the relevant table's columns.
    media_owner_kind = postgresql.ENUM("BASE", "USER", name="media_owner_kind")
    media_type = postgresql.ENUM("IMAGE", "VIDEO", "MUSIC", name="media_type")
    media_status = postgresql.ENUM("PENDING", "UPLOADED", "FAILED", "ABANDONED", name="media_status")

    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_kind", media_owner_kind, nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("media_type", media_type, nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("bucket", sa.String(length=100), nullable=False),
        sa.Column("original_file_name", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("declared_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("actual_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("status", media_status, nullable=False, server_default="PENDING"),
        sa.Column("failure_reason", sa.String(length=500), nullable=True),
        sa.Column("requested_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("presign_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"]),
        sa.UniqueConstraint("storage_path", name="uq_media_assets_storage_path"),
    )
    op.create_index(op.f("ix_media_assets_owner_id"), "media_assets", ["owner_id"])
    op.create_index(
        op.f("ix_media_assets_requested_by_user_id"), "media_assets", ["requested_by_user_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_media_assets_requested_by_user_id"), table_name="media_assets")
    op.drop_index(op.f("ix_media_assets_owner_id"), table_name="media_assets")
    op.drop_table("media_assets")
    postgresql.ENUM(name="media_status").drop(op.get_bind())
    postgresql.ENUM(name="media_type").drop(op.get_bind())
    postgresql.ENUM(name="media_owner_kind").drop(op.get_bind())
