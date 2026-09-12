import uuid
from datetime import datetime
from typing import Any

from pydantic import Field, model_validator

from app.shared.schema import CamelModel
from app.templates.models import (
    TemplateStatus,
    TemplateVersionStatus,
    StorefrontStatus,
    PricingModel,
)


class CategoryOut(CamelModel):
    """A template category (event type), e.g. Wedding, Birthday."""

    id: uuid.UUID
    slug: str = Field(description="Unique, URL-safe identifier, e.g. 'wedding'.")
    name: str = Field(description="Display name, e.g. 'Wedding'.")
    description: str | None = Field(default=None, description="Optional longer description.")
    icon_url: str | None = Field(default=None, description="URL of an icon representing the category.")
    display_order: int = Field(description="Sort order for gallery filters — ascending.")
    is_active: bool = Field(description="False if the category has been deactivated (soft-deleted).")
    created_at: datetime


class CategoryCreate(CamelModel):
    """ADMIN-only body — enforced by the router dependency, not here."""

    slug: str = Field(description="Unique, URL-safe identifier, e.g. 'wedding'. Must not already exist.")
    name: str = Field(description="Display name, e.g. 'Wedding'.")
    description: str | None = Field(default=None, description="Optional longer description.")
    icon_url: str | None = Field(default=None, description="URL of an icon representing the category.")
    display_order: int = Field(default=0, description="Sort order for gallery filters — ascending.")


class CategoryUpdate(CamelModel):
    """ADMIN-only partial update. Only provided fields are applied."""

    name: str | None = Field(default=None, description="Display name, e.g. 'Wedding'.")
    description: str | None = Field(default=None, description="Optional longer description.")
    icon_url: str | None = Field(default=None, description="URL of an icon representing the category.")
    display_order: int | None = Field(default=None, description="Sort order for gallery filters — ascending.")
    is_active: bool | None = Field(
        default=None, description="Set to false to deactivate without deleting."
    )


class CurrencyOut(CamelModel):
    """A currency usable for pricing PAID templates."""

    id: uuid.UUID
    code: str = Field(description="ISO 4217 currency code, e.g. 'USD'.")
    name: str = Field(description="Display name, e.g. 'US Dollar'.")
    symbol: str = Field(description="Display symbol, e.g. '$'.")
    minor_unit: int = Field(description="Decimal places in minor-unit amounts, e.g. 2 for cents.")
    is_active: bool = Field(description="False if the currency has been deactivated (soft-deleted).")
    created_at: datetime


class CurrencyCreate(CamelModel):
    """ADMIN-only body — enforced by the router dependency, not here."""

    code: str = Field(description="ISO 4217 currency code, e.g. 'USD'. Must not already exist.")
    name: str = Field(description="Display name, e.g. 'US Dollar'.")
    symbol: str = Field(description="Display symbol, e.g. '$'.")
    minor_unit: int = Field(description="Decimal places in minor-unit amounts, e.g. 2 for cents.")


class CurrencyUpdate(CamelModel):
    """ADMIN-only partial update. Only provided fields are applied.

    `code` is immutable after creation — it is not editable here."""

    name: str | None = Field(default=None, description="Display name, e.g. 'US Dollar'.")
    symbol: str | None = Field(default=None, description="Display symbol, e.g. '$'.")
    minor_unit: int | None = Field(
        default=None, description="Decimal places in minor-unit amounts, e.g. 2 for cents."
    )
    is_active: bool | None = Field(
        default=None, description="Set to false to deactivate without deleting."
    )


class TemplateCreate(CamelModel):
    """ADMIN-only body — enforced by the router dependency, not here.

    Creates only the catalog entry; the template has no schema/version yet
    and starts as DRAFT/UNLISTED (see `POST /{templateId}/versions`)."""

    slug: str = Field(description="Unique, URL-safe identifier. Must not already exist.")
    name: str = Field(description="Display name shown in the gallery.")
    description: str | None = Field(default=None, description="Optional marketing description.")
    category_id: uuid.UUID | None = Field(default=None, description="Category to file this template under.")
    pricing_model: PricingModel = Field(
        default=PricingModel.FREE, description="FREE or PAID."
    )
    price_amount_minor: int | None = Field(
        default=None, description="Price in minor units (e.g. cents). Required only when pricingModel=PAID."
    )
    currency_id: uuid.UUID | None = Field(
        default=None, description="Currency for price_amount_minor. Required only when pricingModel=PAID."
    )
    thumbnail_url: str | None = Field(default=None, description="Gallery thumbnail image URL.")
    preview_url: str | None = Field(default=None, description="Full-size preview image/link URL.")

    @model_validator(mode="after")
    def _validate_pricing(self) -> "TemplateCreate":
        if self.pricing_model == PricingModel.PAID:
            if self.price_amount_minor is None or self.price_amount_minor <= 0:
                raise ValueError(
                    "priceAmountMinor is required and must be positive when pricingModel is PAID."
                )
            if self.currency_id is None:
                raise ValueError("currencyId is required when pricingModel is PAID.")
        elif self.price_amount_minor is not None or self.currency_id is not None:
            raise ValueError("priceAmountMinor and currencyId must not be set when pricingModel is FREE.")
        return self


class TemplateUpdate(CamelModel):
    """ADMIN-only partial update. Only provided fields are applied.

    Cross-field pricing invariants (PAID requires priceAmountMinor + currencyId)
    are enforced against the template's final merged state in the service layer,
    since a partial payload alone doesn't know the template's current values."""

    name: str | None = Field(default=None, description="Display name shown in the gallery.")
    description: str | None = Field(default=None, description="Optional marketing description.")
    category_id: uuid.UUID | None = Field(default=None, description="Category to file this template under.")
    storefront_status: StorefrontStatus | None = Field(
        default=None,
        description="LISTED (visible in public gallery) or UNLISTED. Use this to unpublish "
        "a template without deleting it — templates have no hard-delete endpoint.",
    )
    pricing_model: PricingModel | None = Field(default=None, description="FREE or PAID.")
    price_amount_minor: int | None = Field(
        default=None, description="Price in minor units (e.g. cents)."
    )
    currency_id: uuid.UUID | None = Field(
        default=None, description="Currency for price_amount_minor."
    )
    thumbnail_url: str | None = Field(default=None, description="Gallery thumbnail image URL.")
    preview_url: str | None = Field(default=None, description="Full-size preview image/link URL.")

    @model_validator(mode="after")
    def _validate_pricing(self) -> "TemplateUpdate":
        if self.price_amount_minor is not None and self.price_amount_minor <= 0:
            raise ValueError("priceAmountMinor must be positive.")
        fields_set = self.model_fields_set
        if self.pricing_model == PricingModel.FREE:
            if ("price_amount_minor" in fields_set and self.price_amount_minor is not None) or (
                "currency_id" in fields_set and self.currency_id is not None
            ):
                raise ValueError(
                    "priceAmountMinor and currencyId must not be set when pricingModel is FREE."
                )
        return self


class TemplateOut(CamelModel):
    """Full template metadata — catalog entry, not including version content."""

    id: uuid.UUID
    slug: str
    name: str
    description: str | None = None
    category_id: uuid.UUID | None = None
    pricing_model: PricingModel
    price_amount_minor: int | None = None
    currency_id: uuid.UUID | None = None
    storefront_status: StorefrontStatus = Field(
        description="Commercial visibility: LISTED (public) or UNLISTED."
    )
    thumbnail_url: str | None = None
    preview_url: str | None = None
    status: TemplateStatus = Field(
        description="Catalog readiness: DRAFT (no published version yet), ACTIVE, or ARCHIVED. "
        "Distinct from storefrontStatus, which controls commercial visibility."
    )
    created_at: datetime
    updated_at: datetime


class TemplateGalleryOut(CamelModel):
    """Lightweight response for gallery listing — no schema/defaults.

    Fetch `GET /{templateId}` for full details, or
    `GET /{templateId}/versions/{version}` for the renderable schema."""

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
    created_at: datetime


class TemplateVersionCreate(CamelModel):
    """ADMIN-only body. The caller supplies these explicitly — the backend does not
    guess schema/protocol versions or the defaults.

    The version number itself is assigned automatically by the server."""

    schema_version: int = Field(description="Version of the schema format this version's `schema` conforms to.")
    protocol_version: int = Field(
        default=1, description="Version of the rendering protocol the frontend editor should use."
    )
    # Renamed from `schema` on the Python side only — that name shadows a deprecated
    # BaseModel.schema() classmethod. The JSON field stays "schema" via the alias.
    template_schema: dict[str, Any] = Field(
        alias="schema", description="JSON Schema describing the editable fields for this template."
    )
    defaults: dict[str, Any] | None = Field(
        default=None, description="Default field values pre-filled when a user starts from this template."
    )
    capabilities: dict[str, Any] = Field(
        default_factory=dict, description="Feature flags describing what this version supports."
    )


class TemplateVersionOut(CamelModel):
    """A single, immutable version of a template's schema/defaults/capabilities."""

    id: uuid.UUID
    template_id: uuid.UUID
    version: int = Field(description="Sequential version number, starting at 1, unique per template.")
    schema_version: int
    protocol_version: int
    template_schema: dict[str, Any] = Field(alias="schema")
    defaults: dict[str, Any] | None = None
    capabilities: dict[str, Any]
    status: TemplateVersionStatus = Field(
        description="DRAFT (admin-only, editable pre-publish), PUBLISHED (immutable, public), "
        "or ARCHIVED (immutable, can no longer be published)."
    )
    created_at: datetime
