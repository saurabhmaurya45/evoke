"""add_payments_table

Revision ID: c3d9e1f2a4b5
Revises: e96201c0a4ba
Create Date: 2026-09-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c3d9e1f2a4b5'
down_revision: Union[str, None] = 'e96201c0a4ba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


payment_status = postgresql.ENUM(
    'CREATED', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', name='payment_status', create_type=False
)


def upgrade() -> None:
    payment_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        'payments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('event_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('template_id', sa.UUID(), nullable=False),
        sa.Column('amount_minor', sa.BigInteger(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('status', payment_status, nullable=False),
        sa.Column('provider', sa.String(length=20), nullable=False),
        sa.Column('provider_link_id', sa.String(length=64), nullable=True),
        sa.Column('provider_payment_id', sa.String(length=64), nullable=True),
        sa.Column('checkout_url', sa.String(length=255), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['events.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['template_id'], ['templates.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('provider_link_id'),
    )
    op.create_index(op.f('ix_payments_event_id'), 'payments', ['event_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_payments_event_id'), table_name='payments')
    op.drop_table('payments')
    payment_status.drop(op.get_bind(), checkfirst=True)
