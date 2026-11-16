"""add_event_public_subdomain

Revision ID: a1b2c3d4e5f6
Revises: c5e1a9d3f7b2
Create Date: 2026-11-16

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c5e1a9d3f7b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("public_subdomain", sa.String(length=63), nullable=True))
    op.create_index("ix_events_public_subdomain", "events", ["public_subdomain"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_events_public_subdomain", table_name="events")
    op.drop_column("events", "public_subdomain")