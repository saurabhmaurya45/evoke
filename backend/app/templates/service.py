from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.audit import log_action
from app.shared.errors import ConflictError, NotFoundError
from app.shared.pagination import Page, PageParams, make_page
from app.templates.models import Template, TemplateStatus, TemplateVersion, TemplateVersionStatus
from app.templates.schemas import TemplateCreate, TemplateUpdate, TemplateVersionCreate
from app.users.models import User

# Canonical template definitions — kept in sync with the frontend HomeContentService.
_SEED_TEMPLATES: list[dict] = [
    {"slug": "tpl-samarpan-royal",  "name": "Samarpan — Royal Union",          "category": "Wedding"},
    {"slug": "tpl-eternal-bond",    "name": "Eternal Bond — Royal Wedding",     "category": "Wedding"},
    {"slug": "tpl-beloved-nikkah",  "name": "Beloved — Nikkah Invitation",      "category": "Wedding"},
    {"slug": "tpl-harpreet-ritika", "name": "Rosewood — Punjabi Wedding",       "category": "Wedding"},
    {"slug": "tpl-karan-nisha",     "name": "Maroon & Gold — Royal Hindu Wedding", "category": "Wedding"},
    {"slug": "tpl-joe-serin",       "name": "Doorway — Modern Wedding",         "category": "Wedding"},
    {"slug": "tpl-golden-promise",  "name": "Golden Promise",                   "category": "Engagement"},
]


async def seed_catalog(db: AsyncSession) -> None:
    """Upsert the canonical template catalog. Safe to call on every startup —
    existing rows are left unchanged (slug is the conflict key)."""
    for tpl in _SEED_TEMPLATES:
        stmt = (
            pg_insert(Template)
            .values(
                id=uuid.uuid4(),
                slug=tpl["slug"],
                name=tpl["name"],
                category=tpl["category"],
                status=TemplateStatus.ACTIVE,
            )
            .on_conflict_do_nothing(index_elements=["slug"])
        )
        await db.execute(stmt)
    await db.commit()


async def list_templates(
    db: AsyncSession,
    params: PageParams,
    *,
    category: str | None = None,
    search: str | None = None,
    include_all: bool = False,
) -> Page[Template]:
    """Public listing — only ACTIVE templates unless include_all is True (admin only)."""
    filters = [] if include_all else [Template.status == TemplateStatus.ACTIVE]
    if category:
        filters.append(Template.category == category)
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
    """Public direct fetch — unlike the list, this is not filtered by status. Matches
    the docs' "list vs get" pattern: only the catalog listing hides non-ACTIVE items."""
    template = await db.get(Template, template_id)
    if template is None:
        raise NotFoundError("TEMPLATE_NOT_FOUND", "Template not found.")
    return template


async def create_template(db: AsyncSession, admin_user: User, data: TemplateCreate) -> Template:
    template = Template(slug=data.slug, name=data.name, category=data.category)
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
        default_config=data.default_config,
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
