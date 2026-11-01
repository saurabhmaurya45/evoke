import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class ReelStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RENDERING = "RENDERING"
    READY = "READY"
    FAILED = "FAILED"


class EventReel(Base):
    """One render of an invitation's video. The row is also the job: the API inserts
    it as QUEUED and a worker (app.reels.worker) claims and finishes it."""

    __tablename__ = "event_reels"
    __table_args__ = (
        # Last-resort guard against two requests both queueing a render for one
        # invitation; `request_reel` checks for an active render first.
        Index(
            "ix_event_reels_one_active",
            "event_id",
            unique=True,
            postgresql_where=text("status IN ('QUEUED', 'RENDERING')"),
        ),
        Index("ix_event_reels_status_created", "status", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id"), nullable=False, index=True
    )
    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    template_slot_id: Mapped[str] = mapped_column(String(240), nullable=False)
    # The draft revision this video shows. Refreshed when a worker claims the job, so
    # edits made while it waited in the queue are included.
    draft_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ReelStatus] = mapped_column(
        Enum(ReelStatus, name="reel_status"), nullable=False, default=ReelStatus.QUEUED
    )
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Null until READY, and again once a newer video replaces this one in storage.
    storage_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # For operators only: never returned to clients.
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
