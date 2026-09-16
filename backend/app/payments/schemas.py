import uuid
from datetime import datetime

from app.events.models import EventStatus
from app.events.schemas import EventOut
from app.payments.models import PaymentStatus
from app.shared.schema import CamelModel


class CheckoutRequest(CamelModel):
    event_id: uuid.UUID


class PriceQuoteOut(CamelModel):
    event_id: uuid.UUID
    event_slug: str
    event_status: EventStatus
    template_id: uuid.UUID
    template_slug: str
    template_name: str
    pricing_model: str
    amount_minor: int
    currency: str
    payment_required: bool
    already_paid: bool


class CheckoutOut(CamelModel):
    payment_required: bool
    payment_id: uuid.UUID | None = None
    checkout_url: str | None = None
    amount_minor: int | None = None
    currency: str | None = None
    event: EventOut


class PaymentOut(CamelModel):
    id: uuid.UUID
    event_id: uuid.UUID
    template_name: str | None = None
    status: PaymentStatus
    amount_minor: int
    currency: str
    checkout_url: str | None
    provider_payment_id: str | None
    paid_at: datetime | None
    created_at: datetime
