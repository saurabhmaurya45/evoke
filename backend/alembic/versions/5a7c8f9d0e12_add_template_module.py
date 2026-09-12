"""Add template module: categories, currencies, and template enhancements.

Revision ID: 5a7c8f9d0e12
Revises: 4fa19b719b6e
Create Date: 2026-09-12 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5a7c8f9d0e12'
down_revision: Union[str, None] = '4fa19b719b6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():  # type: ignore
    # Create categories table
    op.create_table(
        'categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('slug', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon_url', sa.String(255), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_categories_slug')
    )

    # Create currencies table
    op.create_table(
        'currencies',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(3), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('symbol', sa.String(10), nullable=False),
        sa.Column('minor_unit', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.current_timestamp()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_currencies_code')
    )

    # Add new columns to templates table
    op.add_column('templates', sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('templates', sa.Column('pricing_model', sa.String(20), nullable=False, server_default='FREE'))
    op.add_column('templates', sa.Column('price_amount_minor', sa.BigInteger(), nullable=True))
    op.add_column('templates', sa.Column('currency_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('templates', sa.Column('storefront_status', sa.String(20), nullable=False, server_default='LISTED'))
    op.add_column('templates', sa.Column('thumbnail_url', sa.String(255), nullable=True))
    op.add_column('templates', sa.Column('preview_url', sa.String(255), nullable=True))

    # Create foreign keys for templates
    op.create_foreign_key('fk_templates_category_id', 'templates', 'categories', ['category_id'], ['id'])
    op.create_foreign_key('fk_templates_currency_id', 'templates', 'currencies', ['currency_id'], ['id'])

    # Add index for storefront_status
    op.create_index('idx_templates_storefront_status', 'templates', ['storefront_status'])

    # Add new columns to template_versions table
    op.add_column('template_versions', sa.Column('capabilities', sa.JSON(), nullable=False, server_default='{}'))
    op.add_column('template_versions', sa.Column('defaults', sa.JSON(), nullable=True))

    # default_config was already dropped in previous schema, no migration needed


def downgrade():  # type: ignore
    op.drop_column('template_versions', 'defaults')
    op.drop_column('template_versions', 'capabilities')

    # Drop foreign keys and columns from templates
    op.drop_index('idx_templates_storefront_status', table_name='templates')
    op.drop_constraint('fk_templates_currency_id', 'templates', type_='foreignkey')
    op.drop_constraint('fk_templates_category_id', 'templates', type_='foreignkey')
    op.drop_column('templates', 'preview_url')
    op.drop_column('templates', 'thumbnail_url')
    op.drop_column('templates', 'storefront_status')
    op.drop_column('templates', 'currency_id')
    op.drop_column('templates', 'price_amount_minor')
    op.drop_column('templates', 'pricing_model')
    op.drop_column('templates', 'category_id')

    # Drop currencies and categories tables
    op.drop_table('currencies')
    op.drop_table('categories')
