"""Add event_reels table.

One row per render of an invitation's video; the row is also the worker's job.

Revision ID: f2a6c8e4b1d3
Revises: b7c2d4e6f8a1
Create Date: 2026-10-31 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f2a6c8e4b1d3'
down_revision: Union[str, None] = 'b7c2d4e6f8a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():  # type: ignore
    op.create_table(
        'event_reels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('events.id'), nullable=False),
        sa.Column('requested_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('template_slot_id', sa.String(240), nullable=False),
        sa.Column('draft_revision', sa.Integer(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('QUEUED', 'RENDERING', 'READY', 'FAILED', name='reel_status'),
            nullable=False,
        ),
        sa.Column('progress', sa.Integer(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('storage_path', sa.String(512), nullable=True),
        sa.Column('size_bytes', sa.BigInteger(), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('heartbeat_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_event_reels_event_id', 'event_reels', ['event_id'])
    op.create_index('ix_event_reels_requested_by_user_id', 'event_reels', ['requested_by_user_id'])
    op.create_index('ix_event_reels_status_created', 'event_reels', ['status', 'created_at'])
    op.create_index(
        'ix_event_reels_one_active',
        'event_reels',
        ['event_id'],
        unique=True,
        postgresql_where=sa.text("status IN ('QUEUED', 'RENDERING')"),
    )


def downgrade():  # type: ignore
    op.drop_table('event_reels')
    op.execute('DROP TYPE reel_status')
