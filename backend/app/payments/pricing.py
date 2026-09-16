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
    stmt = (
        select(Payment.id)
        .where(Payment.event_id == event_id, Payment.status == PaymentStatus.PAID)
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none() is not None
