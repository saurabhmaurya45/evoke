import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.payments.models import Payment, PaymentStatus
from app.templates.models import Currency, PricingModel, Template

DEFAULT_CURRENCY = "INR"


@dataclass(frozen=True)
class TemplatePrice:
    amount_minor: int
    currency: str

    @property
    def is_free(self) -> bool:
        return self.amount_minor <= 0


async def get_template_price(db: AsyncSession, template: Template) -> TemplatePrice:
    """Server-side source of truth for what a template costs."""
    currency = DEFAULT_CURRENCY
    if template.currency_id:
        row = await db.get(Currency, template.currency_id)
        if row:
            currency = row.code
    if template.pricing_model != PricingModel.PAID.value or not template.price_amount_minor:
        return TemplatePrice(amount_minor=0, currency=currency)
    return TemplatePrice(amount_minor=template.price_amount_minor, currency=currency)


async def has_paid_payment(db: AsyncSession, event_id: uuid.UUID) -> bool:
    """Whether the invitation itself was paid for (a payment for its video alone doesn't count)."""
    return await _paid(db, event_id, Payment.includes_template.is_(True))


async def has_paid_video(db: AsyncSession, event_id: uuid.UUID) -> bool:
    """Whether the invitation's video was paid for, with the invitation or on its own."""
    return await _paid(db, event_id, Payment.includes_video.is_(True))


async def _paid(db: AsyncSession, event_id: uuid.UUID, condition) -> bool:
    stmt = (
        select(Payment.id)
        .where(Payment.event_id == event_id, Payment.status == PaymentStatus.PAID, condition)
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none() is not None


def video_price(template_price: TemplatePrice) -> TemplatePrice:
    """What the invitation video costs: the same as its template, or a fixed price (₹500 by
    default, `reel_price_free_template_minor`) when the template is free."""
    if not template_price.is_free:
        return template_price
    from app.config import get_settings

    return TemplatePrice(
        amount_minor=get_settings().reel_price_free_template_minor, currency=DEFAULT_CURRENCY
    )


async def event_video_price(db: AsyncSession, template: Template | None) -> TemplatePrice:
    """The video price for an invitation on `template` (none counts as a free template)."""
    price = (
        await get_template_price(db, template)
        if template is not None
        else TemplatePrice(amount_minor=0, currency=DEFAULT_CURRENCY)
    )
    return video_price(price)
