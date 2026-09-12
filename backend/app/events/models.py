import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class EventType(str, enum.Enum):
    WEDDING = "WEDDING"
    ENGAGEMENT = "ENGAGEMENT"
    BIRTHDAY = "BIRTHDAY"
    BABY_SHOWER = "BABY_SHOWER"
    CORPORATE_EVENT = "CORPORATE_EVENT"
    CONFERENCE = "CONFERENCE"
    PARTY = "PARTY"
    OTHER = "OTHER"


class EventStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ARCHIVED = "ARCHIVED"
    # PUBLISHED is intentionally not modeled yet: that state only becomes reachable
    # once a future Publishing module exists, and adding it now with no way to reach
    # it would be a half-finished state machine.


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="event_type"), nullable=False, default=EventType.WEDDING
    )
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    status: Mapped[EventStatus] = mapped_column(
        Enum(EventStatus, name="event_status"), nullable=False, default=EventStatus.DRAFT
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("templates.id"), nullable=True
    )
    template_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
