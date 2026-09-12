import enum
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class TemplateStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class TemplateVersionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(240), nullable=False)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # Content/catalog readiness only (is this template visible in the public catalog?),
    # not commercial visibility — billing/pricing fields are out of scope for this pass.
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
    default_config: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    # Immutable once PUBLISHED: no edits, no un-publish, in this pass.
    status: Mapped[TemplateVersionStatus] = mapped_column(
        Enum(TemplateVersionStatus, name="template_version_status"),
        nullable=False,
        default=TemplateVersionStatus.DRAFT,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
