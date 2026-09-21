"""one_active_event_per_template

A user's template-backed events (`title` is the frontend template slot id, e.g.
'tpl-samarpan-royal' — see `resolve_event_template`) should have at most one
non-archived row per (owner, title). Enforced in `events.service.create_event`
up front; this partial unique index is the last-resort guard against two
concurrent requests both passing that check before either commits.

Revision ID: d4e8a2c6f1b7
Revises: c3d9e1f2a4b5
Create Date: 2026-09-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd4e8a2c6f1b7'
down_revision: Union[str, None] = 'c3d9e1f2a4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX ix_events_owner_title_active
        ON events (owner_id, title)
        WHERE status != 'ARCHIVED' AND title LIKE 'tpl-%'
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_events_owner_title_active")
