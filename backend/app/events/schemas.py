import uuid
from datetime import datetime
from typing import Any

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


class InvitationOut(CamelModel):
    """Public/owner-only viewer response — event metadata + saved draft content.

    `template_slot_id` is the frontend template slot id (e.g. 'tpl-samarpan-royal')
    the Angular app uses to look up the local previewUrl from templates.index.json.
    `draft_data` is the user's saved field values for that template.
    """

    event_id: uuid.UUID
    slug: str
    title: str
    status: EventStatus
    owner_id: uuid.UUID
    template_slot_id: str | None
    draft_data: dict[str, Any]
    schema_version: int | None
