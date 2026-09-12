from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.audit import log_action
from app.shared.errors import ConflictError, NotFoundError, ValidationFailedError
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
from app.templates.schemas import (
    CategoryCreate,
    CategoryUpdate,
    CurrencyCreate,
    CurrencyUpdate,
    TemplateCreate,
    TemplateUpdate,
    TemplateVersionCreate,
)
from app.users.models import User


async def list_categories(db: AsyncSession) -> list[Category]:
    """List all active categories."""
    result = await db.execute(
        select(Category)
        .where(Category.is_active == True)
        .order_by(Category.display_order)
    )
    return list(result.scalars().all())


async def get_category(db: AsyncSession, category_id: uuid.UUID) -> Category:
    category = await db.get(Category, category_id)
    if category is None:
        raise NotFoundError("CATEGORY_NOT_FOUND", "Category not found.")
    return category


async def create_category(db: AsyncSession, admin_user: User, data: CategoryCreate) -> Category:
    existing = (
        await db.execute(select(Category).where(Category.slug == data.slug))
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("CATEGORY_SLUG_EXISTS", "A category with this slug already exists.")

    category = Category(
        slug=data.slug,
        name=data.name,
        description=data.description,
        icon_url=data.icon_url,
        display_order=data.display_order,
    )
    db.add(category)
    await db.flush()
    await log_action(
        db,
        action="CATEGORY_CREATED",
        resource_type="category",
        resource_id=category.id,
        actor_user_id=admin_user.id,
    )
    await db.commit()
    await db.refresh(category)
    return category


async def update_category(
    db: AsyncSession, admin_user: User, category_id: uuid.UUID, data: CategoryUpdate
) -> Category:
    category = await get_category(db, category_id)
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(category, field, value)
    if changes:
        await log_action(
            db,
            action="CATEGORY_UPDATED",
            resource_type="category",
            resource_id=category.id,
            actor_user_id=admin_user.id,
        )
    await db.commit()
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, admin_user: User, category_id: uuid.UUID) -> None:
    """Soft delete — categories may be referenced by templates, so we deactivate
    rather than hard-delete."""
    category = await get_category(db, category_id)
    category.is_active = False
    await log_action(
        db,
        action="CATEGORY_DEACTIVATED",
        resource_type="category",
        resource_id=category.id,
        actor_user_id=admin_user.id,
    )
    await db.commit()


async def list_currencies(db: AsyncSession) -> list[Currency]:
    """List all active currencies."""
    result = await db.execute(
        select(Currency).where(Currency.is_active == True).order_by(Currency.code)
    )
    return list(result.scalars().all())


async def get_currency(db: AsyncSession, currency_id: uuid.UUID) -> Currency:
    currency = await db.get(Currency, currency_id)
    if currency is None:
        raise NotFoundError("CURRENCY_NOT_FOUND", "Currency not found.")
    return currency


async def create_currency(db: AsyncSession, admin_user: User, data: CurrencyCreate) -> Currency:
    existing = (
        await db.execute(select(Currency).where(Currency.code == data.code))
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("CURRENCY_CODE_EXISTS", "A currency with this code already exists.")

    currency = Currency(
        code=data.code,
        name=data.name,
        symbol=data.symbol,
        minor_unit=data.minor_unit,
    )
    db.add(currency)
    await db.flush()
    await log_action(
        db,
        action="CURRENCY_CREATED",
        resource_type="currency",
        resource_id=currency.id,
        actor_user_id=admin_user.id,
    )
    await db.commit()
    await db.refresh(currency)
    return currency


async def update_currency(
    db: AsyncSession, admin_user: User, currency_id: uuid.UUID, data: CurrencyUpdate
) -> Currency:
    currency = await get_currency(db, currency_id)
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(currency, field, value)
    if changes:
        await log_action(
            db,
            action="CURRENCY_UPDATED",
            resource_type="currency",
            resource_id=currency.id,
            actor_user_id=admin_user.id,
        )
    await db.commit()
    await db.refresh(currency)
    return currency


async def delete_currency(db: AsyncSession, admin_user: User, currency_id: uuid.UUID) -> None:
    """Soft delete — currencies may be referenced by templates, so we deactivate
    rather than hard-delete."""
    currency = await get_currency(db, currency_id)
    currency.is_active = False
    await log_action(
        db,
        action="CURRENCY_DEACTIVATED",
        resource_type="currency",
        resource_id=currency.id,
        actor_user_id=admin_user.id,
    )
    await db.commit()


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
        filters.append(Template.status == TemplateStatus.ACTIVE)
        filters.append(Template.storefront_status == StorefrontStatus.LISTED)
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


async def _validate_catalog_refs(
    db: AsyncSession, *, category_id: uuid.UUID | None, currency_id: uuid.UUID | None
) -> None:
    """Cross-field validation that needs the database — a category/currency id must
    reference an existing, active row. Pydantic alone can't check this (no DB
    access), so a bad id would otherwise surface as a raw FK-constraint error at
    commit time instead of a clean 422."""
    if category_id is not None:
        category = await db.get(Category, category_id)
        if category is None or not category.is_active:
            raise ValidationFailedError(
                "categoryId does not reference an active category.",
                details={"categoryId": str(category_id)},
            )
    if currency_id is not None:
        currency = await db.get(Currency, currency_id)
        if currency is None or not currency.is_active:
            raise ValidationFailedError(
                "currencyId does not reference an active currency.",
                details={"currencyId": str(currency_id)},
            )


def _validate_pricing_invariant(template: Template) -> None:
    """Re-checks the same PAID/FREE invariant `TemplateCreate`/`TemplateUpdate`
    enforce at the schema level, but against the template's final merged state —
    a partial update payload alone can't see fields it didn't touch (e.g. clearing
    currencyId on an already-PAID template)."""
    if template.pricing_model == PricingModel.PAID:
        if template.price_amount_minor is None or template.price_amount_minor <= 0:
            raise ValidationFailedError(
                "priceAmountMinor is required and must be positive when pricingModel is PAID."
            )
        if template.currency_id is None:
            raise ValidationFailedError("currencyId is required when pricingModel is PAID.")
    elif template.price_amount_minor is not None or template.currency_id is not None:
        raise ValidationFailedError(
            "priceAmountMinor and currencyId must not be set when pricingModel is FREE."
        )


async def create_template(db: AsyncSession, admin_user: User, data: TemplateCreate) -> Template:
    existing = (
        await db.execute(select(Template).where(Template.slug == data.slug))
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("TEMPLATE_SLUG_EXISTS", "A template with this slug already exists.")

    await _validate_catalog_refs(db, category_id=data.category_id, currency_id=data.currency_id)

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

    await _validate_catalog_refs(
        db, category_id=changes.get("category_id"), currency_id=changes.get("currency_id")
    )

    for field, value in changes.items():
        setattr(template, field, value)

    if changes:
        _validate_pricing_invariant(template)
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


async def list_template_versions(
    db: AsyncSession, template_id: uuid.UUID, *, is_admin: bool
) -> list[TemplateVersion]:
    """List versions for a template. Non-admins only see published versions —
    draft versions aren't leaked to the public."""
    await get_template(db, template_id)  # 404s if the template doesn't exist

    filters = [TemplateVersion.template_id == template_id]
    if not is_admin:
        filters.append(TemplateVersion.status == TemplateVersionStatus.PUBLISHED)

    result = await db.execute(
        select(TemplateVersion).where(*filters).order_by(TemplateVersion.version.desc())
    )
    return list(result.scalars().all())


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
