"""Add description column to templates.

Revision ID: 8b1e2f4a9c33
Revises: 5a7c8f9d0e12
Create Date: 2026-09-12 12:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '8b1e2f4a9c33'
down_revision: Union[str, None] = '5a7c8f9d0e12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():  # type: ignore
    op.add_column('templates', sa.Column('description', sa.String(length=1000), nullable=True))


def downgrade():  # type: ignore
    op.drop_column('templates', 'description')
