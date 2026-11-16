import uuid
from datetime import datetime

from pydantic import Field

from app.events.models import EventStatus
from app.events.schemas import EventOut
from app.payments.models import PaymentStatus
from app.shared.schema import CamelModel


class CheckoutRequest(CamelModel):
    event_id: uuid.UUID = Field(description="The invitation to publish (and pay for).")
    include_video: bool = Field(
        default=False,
        description="Also buy the invitation's video. Ignored if it was already bought; "
        "fails with 409 REEL_NOT_AVAILABLE if the template has no video.",
    )


class PriceQuoteOut(CamelModel):
    event_id: uuid.UUID
    event_slug: str
    event_public_subdomain: str | None = None
    event_status: EventStatus
    template_id: uuid.UUID
    template_slug: str
    template_name: str
    pricing_model: str
    amount_minor: int
    currency: str
    payment_required: bool
    already_paid: bool
    video_available: bool = Field(
        description="Whether the video can be added: its template has a film and videos are on."
    )
    video_price_minor: int = Field(
        description="What the video costs, in minor units (paise): the same as the template, "
        "or a fixed price when the template is free."
    )
    video_currency: str = Field(description="ISO currency code of videoPriceMinor.")
    video_already_paid: bool = Field(description="Whether the video was already bought.")


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
    includes_template: bool = Field(description="Whether this payment was for the invitation.")
    includes_video: bool = Field(description="Whether this payment was for the invitation's video.")
    amount_minor: int
    currency: str
    checkout_url: str | None
    provider_payment_id: str | None
    paid_at: datetime | None
    created_at: datetime
