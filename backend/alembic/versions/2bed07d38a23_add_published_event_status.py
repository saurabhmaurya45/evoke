"""add_published_event_status

Revision ID: 2bed07d38a23
Revises: 8b1e2f4a9c33
Create Date: 2026-09-13 14:43:42.414628

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2bed07d38a23'
down_revision: Union[str, None] = '8b1e2f4a9c33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE … ADD VALUE is non-destructive: existing rows are unaffected and
    # the new value is immediately usable. IF NOT EXISTS guards against re-running
    # on a DB that already has the value (e.g. from a rolled-back manual migration).
    op.execute("ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'PUBLISHED'")


def downgrade() -> None:
    # Postgres does not support removing enum values without recreating the type,
    # which would require a full table lock. Downgrade is intentionally a no-op.
    pass
