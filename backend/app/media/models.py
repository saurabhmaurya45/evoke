import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class MediaOwnerKind(str, enum.Enum):
    BASE = "BASE"  # owner_id references templates.id
    USER = "USER"  # owner_id references events.id


class MediaType(str, enum.Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    MUSIC = "MUSIC"


class MediaStatus(str, enum.Enum):
    PENDING = "PENDING"
    UPLOADED = "UPLOADED"
    FAILED = "FAILED"
    ABANDONED = "ABANDONED"


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    owner_kind: Mapped[MediaOwnerKind] = mapped_column(
        Enum(MediaOwnerKind, name="media_owner_kind"), nullable=False
    )
    # BASE -> templates.id ; USER -> events.id. Polymorphic association,
    # enforced in the service layer rather than a DB-level FK (see
    # aidlc-docs architecture doc ADR-2 — mirrors AuditLog.resource_type +
    # resource_id, an established precedent in this codebase).
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    media_type: Mapped[MediaType] = mapped_column(
        Enum(MediaType, name="media_type"), nullable=False
    )
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    bucket: Mapped[str] = mapped_column(String(100), nullable=False)

    original_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    declared_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    actual_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    status: Mapped[MediaStatus] = mapped_column(
        Enum(MediaStatus, name="media_status"), nullable=False, default=MediaStatus.PENDING
    )
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    presign_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
