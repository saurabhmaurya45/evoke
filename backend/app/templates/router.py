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
    TemplateVersionCreate,
    TemplateVersionOut,
)
from app.templates.service import (
    create_template,
    create_template_version,
    get_template,
    get_template_version,
    list_templates,
    publish_template_version,
)
from app.users.models import User, UserRole

router = APIRouter(prefix="/v1/templates", tags=["templates"])


@router.get("", response_model=Page[TemplateOut])
async def list_templates_route(
    params: PageParams = Depends(page_params),
    category: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> Page[TemplateOut]:
    page = await list_templates(db, params, category=category, search=search)
    return Page[TemplateOut](
        data=[TemplateOut.model_validate(template) for template in page.data],
        pagination=page.pagination,
    )


@router.get("/{template_id}", response_model=Envelope[TemplateOut])
async def get_template_route(
    template_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> Envelope[TemplateOut]:
    template = await get_template(db, template_id)
    return Envelope(data=TemplateOut.model_validate(template))


@router.get("/{template_id}/versions/{version}", response_model=Envelope[TemplateVersionOut])
async def get_template_version_route(
    template_id: uuid.UUID,
    version: int,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> Envelope[TemplateVersionOut]:
    is_admin = current_user is not None and current_user.role == UserRole.ADMIN
    template_version = await get_template_version(db, template_id, version, is_admin=is_admin)
    return Envelope(data=TemplateVersionOut.model_validate(template_version))


@router.post("", response_model=Envelope[TemplateOut], status_code=status.HTTP_201_CREATED)
async def create_template_route(
    data: TemplateCreate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[TemplateOut]:
    template = await create_template(db, admin_user, data)
    return Envelope(data=TemplateOut.model_validate(template))


@router.post(
    "/{template_id}/versions",
    response_model=Envelope[TemplateVersionOut],
    status_code=status.HTTP_201_CREATED,
)
async def create_template_version_route(
    template_id: uuid.UUID,
    data: TemplateVersionCreate,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[TemplateVersionOut]:
    version = await create_template_version(db, admin_user, template_id, data)
    return Envelope(data=TemplateVersionOut.model_validate(version))


@router.post(
    "/{template_id}/versions/{version}/publish", response_model=Envelope[TemplateVersionOut]
)
async def publish_template_version_route(
    template_id: uuid.UUID,
    version: int,
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[TemplateVersionOut]:
    template_version = await publish_template_version(db, admin_user, template_id, version)
    return Envelope(data=TemplateVersionOut.model_validate(template_version))
