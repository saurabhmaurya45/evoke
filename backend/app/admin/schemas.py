import uuid
from datetime import datetime

from app.events.models import EventStatus, EventType
from app.shared.schema import CamelModel
from app.users.models import UserRole


class AdminCustomerOut(CamelModel):
    id: uuid.UUID
    email: str
    first_name: str | None
    last_name: str | None
    display_name: str | None
    role: UserRole
    joined_at: datetime
    event_count: int


class AdminSiteOut(CamelModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    owner_email: str
    type: EventType
    title: str
    slug: str
    status: EventStatus
    template_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class AdminMetricsOut(CamelModel):
    customer_count: int
    site_count: int
    draft_count: int
    archived_count: int


class AdminPaymentOut(CamelModel):
    """Placeholder — no Payment model yet. Reserved for when billing is added."""

    id: uuid.UUID
