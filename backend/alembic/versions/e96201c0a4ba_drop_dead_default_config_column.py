"""drop_dead_default_config_column

Revision ID: e96201c0a4ba
Revises: 2bed07d38a23
Create Date: 2026-09-13 14:43:56.364501

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e96201c0a4ba'
down_revision: Union[str, None] = '2bed07d38a23'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The original migration (4fa19b719b6e) created template_versions with a
    # `default_config` column. A later migration (5a7c8f9d0e12) added `defaults`
    # as the replacement but never explicitly dropped `default_config`.
    # Use raw SQL with IF EXISTS so this is idempotent regardless of DB state.
    op.execute("ALTER TABLE template_versions DROP COLUMN IF EXISTS default_config")


def downgrade() -> None:
    op.add_column(
        "template_versions",
        sa.Column("default_config", sa.JSON(), nullable=True),
    )
