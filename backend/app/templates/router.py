import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.auth.dependencies import get_current_user_optional, require_role
from app.shared.database import get_db
from app.shared.envelope import Envelope
from app.shared.pagination import Page, PageParams, page_params
from app.templates.schemas import (
    TemplateCreate,
    TemplateOut,
    TemplateGalleryOut,
    TemplateUpdate,
    TemplateVersionCreate,
    TemplateVersionOut,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    CurrencyCreate,
    CurrencyOut,
    CurrencyUpdate,
)
from app.templates.service import (
    create_category,
    create_currency,
    create_template,
    create_template_version,
    delete_category,
    delete_currency,
    get_template,
    get_template_version,
    list_categories,
    list_currencies,
    list_template_versions,
    list_templates,
    publish_template_version,
    update_category,
    update_currency,
    update_template,
)
from app.users.models import User, UserRole

router = APIRouter(prefix="/v1/templates")


# ---------------------------------------------------------------------------
# Categories — used to group templates by event type (e.g. Wedding, Birthday).
# Public read access; ADMIN role required to manage the catalog.
# ---------------------------------------------------------------------------


@router.get(
    "/categories",
    response_model=Envelope[list[CategoryOut]],
    tags=["template-categories"],
    summary="List active categories",
)
async def list_categories_route(db: AsyncSession = Depends(get_db)) -> Envelope[list[CategoryOut]]:
    """Return every active category, ordered by `displayOrder`.

    Public endpoint — no authentication required. Categories with
    `isActive=false` (soft-deleted) are excluded. Used to populate filters
    and dropdowns in the template gallery.
    """
    categories = await list_categories(db)
    return Envelope(data=[CategoryOut.model_validate(cat) for cat in categories])


@router.post(
    "/categories",
    response_model=Envelope[CategoryOut],
    status_code=status.HTTP_201_CREATED,
    tags=["template-categories"],
    summary="Create a category",
)
async def create_category_route(
    data: CategoryCreate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[CategoryOut]:
    """Create a new template category.

    **ADMIN role required.** `slug` must be unique — a duplicate returns
    `409 CONFLICT`. New categories default to `isActive=true`.
    """
    category = await create_category(db, admin_user, data)
    return Envelope(data=CategoryOut.model_validate(category))


@router.patch(
    "/categories/{category_id}",
    response_model=Envelope[CategoryOut],
    tags=["template-categories"],
    summary="Update a category",
)
async def update_category_route(
    category_id: uuid.UUID,
    data: CategoryUpdate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[CategoryOut]:
    """Partially update a category.

    **ADMIN role required.** Only fields present in the request body are
    changed; omitted fields are left untouched. Returns `404` if the
    category doesn't exist.
    """
    category = await update_category(db, admin_user, category_id, data)
    return Envelope(data=CategoryOut.model_validate(category))


@router.delete(
    "/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["template-categories"],
    summary="Deactivate a category",
)
async def delete_category_route(
    category_id: uuid.UUID,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deactivate a category (soft delete).

    **ADMIN role required.** Categories may be referenced by existing
    templates, so this sets `isActive=false` rather than removing the row —
    the category stops appearing in `GET /categories` and can no longer be
    assigned to new templates, but existing references are preserved.
    """
    await delete_category(db, admin_user, category_id)


# ---------------------------------------------------------------------------
# Currencies — pricing reference data for PAID templates (code, symbol, and
# minor-unit precision, e.g. USD/2 = cents). Public read access; ADMIN role
# required to manage.
# ---------------------------------------------------------------------------


@router.get(
    "/currencies",
    response_model=Envelope[list[CurrencyOut]],
    tags=["template-currencies"],
    summary="List active currencies",
)
async def list_currencies_route(db: AsyncSession = Depends(get_db)) -> Envelope[list[CurrencyOut]]:
    """Return every active currency, ordered by ISO code.

    Public endpoint — no authentication required. Currencies with
    `isActive=false` (soft-deleted) are excluded.
    """
    currencies = await list_currencies(db)
    return Envelope(data=[CurrencyOut.model_validate(curr) for curr in currencies])


@router.post(
    "/currencies",
    response_model=Envelope[CurrencyOut],
    status_code=status.HTTP_201_CREATED,
    tags=["template-currencies"],
    summary="Create a currency",
)
async def create_currency_route(
    data: CurrencyCreate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[CurrencyOut]:
    """Register a new currency.

    **ADMIN role required.** `code` must be unique (e.g. `USD`, `INR`) — a
    duplicate returns `409 CONFLICT`. `minorUnit` is the number of decimal
    places used for minor-unit amounts (e.g. `2` for cents).
    """
    currency = await create_currency(db, admin_user, data)
    return Envelope(data=CurrencyOut.model_validate(currency))


@router.patch(
    "/currencies/{currency_id}",
    response_model=Envelope[CurrencyOut],
    tags=["template-currencies"],
    summary="Update a currency",
)
async def update_currency_route(
    currency_id: uuid.UUID,
    data: CurrencyUpdate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[CurrencyOut]:
    """Partially update a currency.

    **ADMIN role required.** Only fields present in the request body are
    changed. The currency `code` itself is immutable after creation — create
    a new currency instead of renaming a code. Returns `404` if the
    currency doesn't exist.
    """
    currency = await update_currency(db, admin_user, currency_id, data)
    return Envelope(data=CurrencyOut.model_validate(currency))


@router.delete(
    "/currencies/{currency_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["template-currencies"],
    summary="Deactivate a currency",
)
async def delete_currency_route(
    currency_id: uuid.UUID,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deactivate a currency (soft delete).

    **ADMIN role required.** Currencies may be referenced by existing paid
    templates, so this sets `isActive=false` rather than removing the row —
    the currency stops appearing in `GET /currencies` and can no longer be
    assigned to new templates, but existing references are preserved.
    """
    await delete_currency(db, admin_user, currency_id)


# ---------------------------------------------------------------------------
# Templates — the invitation designs users pick from. Public catalog browsing
# is unauthenticated and only surfaces ACTIVE + LISTED templates; ADMIN role
# is required to create/update templates or manage their versions.
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=Page[TemplateGalleryOut],
    tags=["templates"],
    summary="Browse the template gallery",
)
async def list_templates_route(
    params: PageParams = Depends(page_params),
    category_id: uuid.UUID | None = Query(None, description="Filter to a single category."),
    search: str | None = Query(None, description="Case-insensitive substring match on name."),
    include_draft: bool = Query(False, description="Admin only: include draft templates."),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Page[TemplateGalleryOut]:
    """Paginated, public listing of templates for the gallery/storefront.

    By default only returns templates that are `status=ACTIVE` and
    `storefrontStatus=LISTED` — i.e. published and commercially visible.
    Authenticated admins may pass `includeDraft=true` to also see
    unpublished templates; the flag is silently ignored for non-admins.
    Response items are lightweight (no schema/version data) — fetch
    `GET /{templateId}` for full details.
    """
    is_admin = current_user is not None and current_user.role == UserRole.ADMIN
    page = await list_templates(
        db, params,
        category_id=category_id,
        search=search,
        include_draft=include_draft and is_admin,
    )
    return Page[TemplateGalleryOut](
        data=[TemplateGalleryOut.model_validate(template) for template in page.data],
        pagination=page.pagination,
    )


@router.get(
    "/{template_id}",
    response_model=Envelope[TemplateOut],
    tags=["templates"],
    summary="Get template details",
)
async def get_template_route(
    template_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> Envelope[TemplateOut]:
    """Fetch a single template's metadata by id.

    Public endpoint — no authentication required. Unlike the gallery
    listing, this is **not** filtered by status: draft/unlisted templates
    are still fetchable directly if the id is known (e.g. for admin
    preview links). Returns `404` if the template doesn't exist.
    """
    template = await get_template(db, template_id)
    return Envelope(data=TemplateOut.model_validate(template))


@router.patch(
    "/{template_id}",
    response_model=Envelope[TemplateOut],
    tags=["templates"],
    summary="Update template metadata",
)
async def update_template_route(
    template_id: uuid.UUID,
    data: TemplateUpdate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[TemplateOut]:
    """Partially update a template's catalog metadata.

    **ADMIN role required.** Only fields present in the request body are
    changed. Used for renaming, re-pricing, or toggling
    `storefrontStatus` (e.g. `LISTED` -> `UNLISTED` to unpublish a template
    from the storefront without deleting it — there is no hard-delete for
    templates). Returns `404` if the template doesn't exist.
    """
    template = await update_template(db, admin_user, template_id, data)
    return Envelope(data=TemplateOut.model_validate(template))


@router.post(
    "",
    response_model=Envelope[TemplateOut],
    status_code=status.HTTP_201_CREATED,
    tags=["templates"],
    summary="Create a template",
)
async def create_template_route(
    data: TemplateCreate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[TemplateOut]:
    """Register a new template shell.

    **ADMIN role required.** This only creates the catalog entry — the
    template has no versions yet and starts as `status=DRAFT`,
    `storefrontStatus=UNLISTED` (invisible to the public gallery). Use
    `POST /{templateId}/versions` to attach a schema, then
    `POST /{templateId}/versions/{version}/publish` to activate it.
    `slug` must be unique.
    """
    template = await create_template(db, admin_user, data)
    return Envelope(data=TemplateOut.model_validate(template))


# ---------------------------------------------------------------------------
# Template versions — immutable snapshots of a template's schema/defaults/
# capabilities. Once PUBLISHED, a version can never be edited or unpublished;
# publishing a new version is the only way to change a template's content.
# ---------------------------------------------------------------------------


@router.get(
    "/{template_id}/versions",
    response_model=Envelope[list[TemplateVersionOut]],
    tags=["templates"],
    summary="List a template's versions",
)
async def list_template_versions_route(
    template_id: uuid.UUID,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Envelope[list[TemplateVersionOut]]:
    """List all versions of a template, newest first.

    Non-admins (including anonymous callers) only see `PUBLISHED` versions —
    draft versions are hidden. Authenticated admins see every version
    regardless of status. Returns `404` if the template itself doesn't
    exist.
    """
    is_admin = current_user is not None and current_user.role == UserRole.ADMIN
    versions = await list_template_versions(db, template_id, is_admin=is_admin)
    return Envelope(data=[TemplateVersionOut.model_validate(v) for v in versions])


@router.get(
    "/{template_id}/versions/{version}",
    response_model=Envelope[TemplateVersionOut],
    tags=["templates"],
    summary="Get a specific template version",
)
async def get_template_version_route(
    template_id: uuid.UUID,
    version: int,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Envelope[TemplateVersionOut]:
    """Fetch one version's full schema/defaults/capabilities — used by the
    event editor to render a template.

    Non-admins get `404` (not `403`) for a `DRAFT` version, so the
    existence of unpublished versions isn't leaked to the public.
    """
    is_admin = current_user is not None and current_user.role == UserRole.ADMIN
    template_version = await get_template_version(db, template_id, version, is_admin=is_admin)
    return Envelope(data=TemplateVersionOut.model_validate(template_version))


@router.post(
    "/{template_id}/versions",
    response_model=Envelope[TemplateVersionOut],
    status_code=status.HTTP_201_CREATED,
    tags=["templates"],
    summary="Create a new template version",
)
async def create_template_version_route(
    template_id: uuid.UUID,
    data: TemplateVersionCreate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[TemplateVersionOut]:
    """Add a new draft version to an existing template.

    **ADMIN role required.** The version number is assigned automatically
    (max existing version + 1, starting at 1) — it is not caller-supplied.
    The new version starts as `status=DRAFT` and is invisible to non-admins
    until published. Returns `404` if the template doesn't exist.
    """
    version = await create_template_version(db, admin_user, template_id, data)
    return Envelope(data=TemplateVersionOut.model_validate(version))


@router.post(
    "/{template_id}/versions/{version}/publish",
    response_model=Envelope[TemplateVersionOut],
    tags=["templates"],
    summary="Publish a template version",
)
async def publish_template_version_route(
    template_id: uuid.UUID,
    version: int,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[TemplateVersionOut]:
    """Publish a draft version, making it visible to the public.

    **ADMIN role required.** Idempotent — publishing an already-published
    version simply returns it unchanged. An `ARCHIVED` version cannot be
    published (`409 CONFLICT`). Publishing a template's first version also
    flips the parent template from `status=DRAFT` to `status=ACTIVE`.
    Once published, a version is immutable: there is no way to edit or
    unpublish it — ship a new version instead.
    """
    template_version = await publish_template_version(db, admin_user, template_id, version)
    return Envelope(data=TemplateVersionOut.model_validate(template_version))
