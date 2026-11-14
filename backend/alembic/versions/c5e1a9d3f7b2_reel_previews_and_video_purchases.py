"""Watermarked video previews, and buying the video together with or apart from the invitation.

Revision ID: c5e1a9d3f7b2
Revises: f2a6c8e4b1d3
Create Date: 2026-11-10 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c5e1a9d3f7b2'
down_revision: Union[str, None] = 'f2a6c8e4b1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():  # type: ignore
    reel_kind = postgresql.ENUM('PREVIEW', 'FULL', name='reel_kind')
    reel_kind.create(op.get_bind())
    op.add_column(
        'event_reels',
        sa.Column('kind', reel_kind, nullable=False, server_default='FULL'),
    )
    # One running render per invitation and kind: a preview and the bought video may run together.
    op.drop_index('ix_event_reels_one_active', table_name='event_reels')
    op.create_index(
        'ix_event_reels_one_active',
        'event_reels',
        ['event_id', 'kind'],
        unique=True,
        postgresql_where=sa.text("status IN ('QUEUED', 'RENDERING')"),
    )

    # What a payment bought. Every existing payment was for the invitation alone.
    op.add_column(
        'payments',
        sa.Column('includes_template', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        'payments',
        sa.Column('includes_video', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():  # type: ignore
    op.drop_column('payments', 'includes_video')
    op.drop_column('payments', 'includes_template')
    op.drop_index('ix_event_reels_one_active', table_name='event_reels')
    op.execute("DELETE FROM event_reels WHERE kind = 'PREVIEW'")
    op.create_index(
        'ix_event_reels_one_active',
        'event_reels',
        ['event_id'],
        unique=True,
        postgresql_where=sa.text("status IN ('QUEUED', 'RENDERING')"),
    )
    op.drop_column('event_reels', 'kind')
    op.execute('DROP TYPE reel_kind')
