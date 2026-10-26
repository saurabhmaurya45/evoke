"""one_draft_per_template

Relaxes `ix_events_owner_title_active` (one non-archived event per owner and
template) to one *unpublished draft* per owner and template, so a user can build
a second website from a template they already published. Still deduped in
`events.service.create_event` first; the index is the last-resort race guard.

Revision ID: a7f3c1d9e2b4
Revises: facc2d33a021
Create Date: 2026-10-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a7f3c1d9e2b4'
down_revision: Union[str, None] = 'facc2d33a021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_events_owner_title_active")
    op.execute(
        """
        CREATE UNIQUE INDEX ix_events_owner_title_draft
        ON events (owner_id, title)
        WHERE status = 'DRAFT' AND title LIKE 'tpl-%'
        """
    )


def downgrade() -> None:
    # Fails if a user now has two non-archived events for one template; archive
    # the extras before downgrading.
    op.execute("DROP INDEX IF EXISTS ix_events_owner_title_draft")
    op.execute(
        """
        CREATE UNIQUE INDEX ix_events_owner_title_active
        ON events (owner_id, title)
        WHERE status != 'ARCHIVED' AND title LIKE 'tpl-%'
        """
    )
