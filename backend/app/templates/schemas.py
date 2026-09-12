import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.shared.schema import CamelModel
from app.templates.models import (
    TemplateStatus,
    TemplateVersionStatus,
    StorefrontStatus,
    PricingModel,
)


class CategoryOut(CamelModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str | None = None
    icon_url: str | None = None
    display_order: int
    is_active: bool
    created_at: datetime


class CurrencyOut(CamelModel):
    id: uuid.UUID
    code: str
    name: str
    symbol: str
    minor_unit: int
    is_active: bool
    created_at: datetime


class TemplateCreate(CamelModel):
    """ADMIN-only body — enforced by the router dependency, not here."""

    slug: str
    name: str
    description: str | None = None
    category_id: uuid.UUID | None = None
    pricing_model: PricingModel = PricingModel.FREE
    price_amount_minor: int | None = None
    currency_id: uuid.UUID | None = None
    thumbnail_url: str | None = None
    preview_url: str | None = None


class TemplateUpdate(CamelModel):
    """ADMIN-only partial update. Only provided fields are applied."""

    name: str | None = None
    description: str | None = None
    storefront_status: StorefrontStatus | None = None
    pricing_model: PricingModel | None = None
    price_amount_minor: int | None = None
    thumbnail_url: str | None = None
    preview_url: str | None = None


class TemplateOut(CamelModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str | None = None
    category_id: uuid.UUID | None = None
    pricing_model: PricingModel
    price_amount_minor: int | None = None
    currency_id: uuid.UUID | None = None
    storefront_status: StorefrontStatus
    thumbnail_url: str | None = None
    preview_url: str | None = None
    status: TemplateStatus
    created_at: datetime
    updated_at: datetime


class TemplateGalleryOut(CamelModel):
    """Lightweight response for gallery listing — no schema/defaults."""

    id: uuid.UUID
    slug: str
    name: str
    description: str | None = None
    category_id: uuid.UUID | None = None
    pricing_model: PricingModel
    price_amount_minor: int | None = None
    currency_id: uuid.UUID | None = None
    thumbnail_url: str | None = None
    preview_url: str | None = None
    capabilities: dict[str, Any]
    created_at: datetime


class TemplateVersionCreate(CamelModel):
    """ADMIN-only body. The caller supplies these explicitly — the backend does not
    guess schema/protocol versions or the defaults."""

    schema_version: int
    protocol_version: int = 1
    # Renamed from `schema` on the Python side only — that name shadows a deprecated
    # BaseModel.schema() classmethod. The JSON field stays "schema" via the alias.
    template_schema: dict[str, Any] = Field(alias="schema")
    defaults: dict[str, Any] | None = None
    capabilities: dict[str, Any] = Field(default_factory=dict)


class TemplateVersionOut(CamelModel):
    id: uuid.UUID
    template_id: uuid.UUID
    version: int
    schema_version: int
    protocol_version: int
    template_schema: dict[str, Any] = Field(alias="schema")
    defaults: dict[str, Any] | None = None
    capabilities: dict[str, Any]
    status: TemplateVersionStatus
    created_at: datetime
