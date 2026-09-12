from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.audit import log_action
from app.shared.errors import ConflictError, NotFoundError
from app.shared.pagination import Page, PageParams, make_page
from app.templates.models import (
    Template,
    TemplateStatus,
    TemplateVersion,
    TemplateVersionStatus,
    Category,
    Currency,
    StorefrontStatus,
    PricingModel,
)
from app.templates.schemas import TemplateCreate, TemplateUpdate, TemplateVersionCreate
from app.users.models import User


async def seed_categories(db: AsyncSession) -> None:
    """Seed initial categories. Safe to call on every startup."""
    categories = [
        {"slug": "wedding", "name": "Wedding", "display_order": 1},
        {"slug": "engagement", "name": "Engagement", "display_order": 2},
        {"slug": "birthday", "name": "Birthday", "display_order": 3},
        {"slug": "anniversary", "name": "Anniversary", "display_order": 4},
        {"slug": "corporate", "name": "Corporate Event", "display_order": 5},
    ]
    for cat in categories:
        stmt = (
            pg_insert(Category)
            .values(
                id=uuid.uuid4(),
                slug=cat["slug"],
                name=cat["name"],
                display_order=cat["display_order"],
                is_active=True,
            )
            .on_conflict_do_nothing(index_elements=["slug"])
        )
        await db.execute(stmt)
    await db.commit()


async def seed_currencies(db: AsyncSession) -> None:
    """Seed initial currencies. Safe to call on every startup."""
    currencies = [
        {"code": "INR", "name": "Indian Rupee", "symbol": "₹", "minor_unit": 100},
        {"code": "USD", "name": "US Dollar", "symbol": "$", "minor_unit": 1},
        {"code": "EUR", "name": "Euro", "symbol": "€", "minor_unit": 1},
        {"code": "GBP", "name": "British Pound", "symbol": "£", "minor_unit": 1},
    ]
    for curr in currencies:
        stmt = (
            pg_insert(Currency)
            .values(
                id=uuid.uuid4(),
                code=curr["code"],
                name=curr["name"],
                symbol=curr["symbol"],
                minor_unit=curr["minor_unit"],
                is_active=True,
            )
            .on_conflict_do_nothing(index_elements=["code"])
        )
        await db.execute(stmt)
    await db.commit()


async def list_categories(db: AsyncSession) -> list[Category]:
    """List all active categories."""
    result = await db.execute(
        select(Category)
        .where(Category.is_active == True)
        .order_by(Category.display_order)
    )
    return list(result.scalars().all())


async def list_currencies(db: AsyncSession) -> list[Currency]:
    """List all active currencies."""
    result = await db.execute(
        select(Currency).where(Currency.is_active == True).order_by(Currency.code)
    )
    return list(result.scalars().all())


async def list_templates(
    db: AsyncSession,
    params: PageParams,
    *,
    category_id: uuid.UUID | None = None,
    search: str | None = None,
    include_draft: bool = False,
) -> Page[Template]:
    """Public listing — only ACTIVE templates with LISTED storefront status unless
    include_draft is True (admin only)."""
    filters = []
    if not include_draft:
        filters.extend([
            Template.status == TemplateStatus.ACTIVE,
            Template.storefront_status == StorefrontStatus.LISTED,
        ])
    if category_id:
        filters.append(Template.category_id == category_id)
    if search:
        filters.append(Template.name.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(Template).where(*filters))).scalar_one()

    stmt = (
        select(Template)
        .where(*filters)
        .order_by(Template.created_at.desc())
        .offset((params.page - 1) * params.page_size)
        .limit(params.page_size)
    )
    items = list((await db.execute(stmt)).scalars().all())
    return make_page(items, total, params)


async def get_template(db: AsyncSession, template_id: uuid.UUID) -> Template:
    """Public direct fetch — unlike the list, this is not filtered by status."""
    template = await db.get(Template, template_id)
    if template is None:
        raise NotFoundError("TEMPLATE_NOT_FOUND", "Template not found.")
    return template


async def create_template(db: AsyncSession, admin_user: User, data: TemplateCreate) -> Template:
    template = Template(
        slug=data.slug,
        name=data.name,
        description=data.description,
        category_id=data.category_id,
        pricing_model=data.pricing_model,
        price_amount_minor=data.price_amount_minor,
        currency_id=data.currency_id,
        thumbnail_url=data.thumbnail_url,
        preview_url=data.preview_url,
        status=TemplateStatus.DRAFT,
        storefront_status=StorefrontStatus.UNLISTED,
    )
    db.add(template)
    await db.flush()
    await log_action(
        db,
        action="TEMPLATE_CREATED",
        resource_type="template",
        resource_id=template.id,
        actor_user_id=admin_user.id,
    )
    await db.commit()
    await db.refresh(template)
    return template


async def update_template(
    db: AsyncSession, admin_user: User, template_id: uuid.UUID, data: TemplateUpdate
) -> Template:
    template = await get_template(db, template_id)
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(template, field, value)
    if changes:
        await log_action(
            db,
            action="TEMPLATE_UPDATED",
            resource_type="template",
            resource_id=template.id,
            actor_user_id=admin_user.id,
        )
    await db.commit()
    await db.refresh(template)
    return template


async def create_template_version(
    db: AsyncSession, admin_user: User, template_id: uuid.UUID, data: TemplateVersionCreate
) -> TemplateVersion:
    await get_template(db, template_id)  # 404s if the template doesn't exist

    max_version = (
        await db.execute(
            select(func.max(TemplateVersion.version)).where(TemplateVersion.template_id == template_id)
        )
    ).scalar_one()
    next_version = (max_version or 0) + 1

    version = TemplateVersion(
        template_id=template_id,
        version=next_version,
        schema_version=data.schema_version,
        protocol_version=data.protocol_version,
        schema=data.template_schema,
        defaults=data.defaults,
        capabilities=data.capabilities,
        status=TemplateVersionStatus.DRAFT,
    )
    db.add(version)
    await db.flush()
    await log_action(
        db,
        action="TEMPLATE_VERSION_CREATED",
        resource_type="template_version",
        resource_id=version.id,
        actor_user_id=admin_user.id,
    )
    await db.commit()
    await db.refresh(version)
    return version


async def _get_version(db: AsyncSession, template_id: uuid.UUID, version: int) -> TemplateVersion | None:
    result = await db.execute(
        select(TemplateVersion).where(
            TemplateVersion.template_id == template_id, TemplateVersion.version == version
        )
    )
    return result.scalar_one_or_none()


async def get_template_version(
    db: AsyncSession, template_id: uuid.UUID, version: int, *, is_admin: bool
) -> TemplateVersion:
    template_version = await _get_version(db, template_id, version)
    if template_version is None:
        raise NotFoundError("TEMPLATE_VERSION_NOT_FOUND", "Template version not found.")
    # Non-admins cannot see unpublished versions — treat as not found rather than
    # forbidden, so the existence of draft versions isn't leaked.
    if template_version.status == TemplateVersionStatus.DRAFT and not is_admin:
        raise NotFoundError("TEMPLATE_VERSION_NOT_FOUND", "Template version not found.")
    return template_version


async def publish_template_version(
    db: AsyncSession, admin_user: User, template_id: uuid.UUID, version: int
) -> TemplateVersion:
    template_version = await _get_version(db, template_id, version)
    if template_version is None:
        raise NotFoundError("TEMPLATE_VERSION_NOT_FOUND", "Template version not found.")

    if template_version.status == TemplateVersionStatus.PUBLISHED:
        return template_version  # already published — publishing is idempotent

    if template_version.status == TemplateVersionStatus.ARCHIVED:
        raise ConflictError(
            "TEMPLATE_VERSION_ARCHIVED", "An archived template version cannot be published."
        )

    template_version.status = TemplateVersionStatus.PUBLISHED

    template = await db.get(Template, template_id)
    if template is not None and template.status == TemplateStatus.DRAFT:
        # First published version activates the template in the catalog.
        template.status = TemplateStatus.ACTIVE

    await log_action(
        db,
        action="TEMPLATE_VERSION_PUBLISHED",
        resource_type="template_version",
        resource_id=template_version.id,
        actor_user_id=admin_user.id,
    )
    await db.commit()
    await db.refresh(template_version)
    return template_version
