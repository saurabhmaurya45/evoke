import uuid
from datetime import datetime

from app.events.models import EventStatus, EventType
from app.shared.schema import CamelModel


class EventCreate(CamelModel):
    type: EventType = EventType.WEDDING
    title: str


class EventUpdate(CamelModel):
    """Partial update — every field is optional; only provided fields are applied."""

    title: str | None = None
    template_id: uuid.UUID | None = None
    template_version: int | None = None


class EventOut(CamelModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    type: EventType
    title: str
    slug: str
    status: EventStatus
    template_id: uuid.UUID | None
    template_version: int | None
    created_at: datetime
    updated_at: datetime
