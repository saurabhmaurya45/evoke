import enum
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, Boolean, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    icon_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Currency(Base):
    __tablename__ = "currencies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(3), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    minor_unit: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class TemplateStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class StorefrontStatus(str, enum.Enum):
    LISTED = "LISTED"
    UNLISTED = "UNLISTED"


class PricingModel(str, enum.Enum):
    FREE = "FREE"
    PAID = "PAID"


class TemplateVersionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(240), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True
    )
    pricing_model: Mapped[str] = mapped_column(String(20), nullable=False, default="FREE")
    price_amount_minor: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    currency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("currencies.id"), nullable=True
    )
    storefront_status: Mapped[str] = mapped_column(String(20), nullable=False, default="LISTED")
    thumbnail_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preview_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Content/catalog readiness only (is this template visible in the public catalog?),
    # not commercial visibility — storefront_status handles commercial visibility.
    status: Mapped[TemplateStatus] = mapped_column(
        Enum(TemplateStatus, name="template_status"), nullable=False, default=TemplateStatus.DRAFT
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class TemplateVersion(Base):
    __tablename__ = "template_versions"
    __table_args__ = (
        UniqueConstraint("template_id", "version", name="uq_template_versions_template_id_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("templates.id"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False)
    protocol_version: Mapped[int] = mapped_column(Integer, nullable=False)
    schema: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    defaults: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    capabilities: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default={})
    # Immutable once PUBLISHED: no edits, no un-publish, in this pass.
    status: Mapped[TemplateVersionStatus] = mapped_column(
        Enum(TemplateVersionStatus, name="template_version_status"),
        nullable=False,
        default=TemplateVersionStatus.DRAFT,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
