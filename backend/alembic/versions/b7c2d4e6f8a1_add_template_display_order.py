"""Add display_order column to templates.

Revision ID: b7c2d4e6f8a1
Revises: a7f3c1d9e2b4
Create Date: 2026-10-31 19:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b7c2d4e6f8a1'
down_revision: Union[str, None] = 'a7f3c1d9e2b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():  # type: ignore
    op.add_column(
        'templates',
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade():  # type: ignore
    op.drop_column('templates', 'display_order')
