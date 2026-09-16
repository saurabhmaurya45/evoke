from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.events.models import Event, EventStatus
from app.events.schemas import EventOut
from app.events.service import get_event, publish_event, resolve_event_template
from app.payments.models import Payment, PaymentStatus
from app.payments.pricing import get_template_price, has_paid_payment
from app.payments.razorpay_client import RazorpayClient, require_client
from app.payments.schemas import CheckoutOut, PaymentOut, PriceQuoteOut
from app.shared.audit import log_action
from app.shared.authorization import ensure_owner_or_admin
from app.shared.errors import AppError, NotFoundError, ValidationFailedError
from app.shared.pagination import Page, PageParams, make_page
from app.templates.models import Template
from app.users.models import User

logger = logging.getLogger("evoke.payments")

# Don't hand out a link that will expire while the user is still on Razorpay's page.
_REUSE_MIN_REMAINING = timedelta(minutes=5)


async def _event_and_template(
    db: AsyncSession, user: User, event_id: uuid.UUID, *, lock: bool = False
) -> tuple[Event, Template]:
    event = await get_event(db, event_id, user)
    if lock:
        # Row lock (held until commit/rollback) serializes concurrent checkouts for one
        # event, so a second request waits and then reuses the first request's link.
        # Taken only after the ownership check; populate_existing picks up changes made
        # by the request we waited on.
        event = (
            await db.execute(
                select(Event)
                .where(Event.id == event.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one()
    if event.status == EventStatus.ARCHIVED:
        raise ValidationFailedError("An archived event cannot be paid for or published.")
    template = await resolve_event_template(db, event)
    if template is None:
        raise ValidationFailedError("This event is not linked to a template.")
    return event, template


async def get_quote(db: AsyncSession, user: User, event_id: uuid.UUID) -> PriceQuoteOut:
    event, template = await _event_and_template(db, user, event_id)
    price = await get_template_price(db, template)
    return PriceQuoteOut(
        event_id=event.id,
        event_slug=event.slug,
        event_status=event.status,
        template_id=template.id,
        template_slug=template.slug,
        template_name=template.name,
        pricing_model=template.pricing_model,
        amount_minor=price.amount_minor,
        currency=price.currency,
        payment_required=not price.is_free,
        already_paid=await has_paid_payment(db, event.id),
    )


async def start_checkout(
    db: AsyncSession, client: RazorpayClient | None, user: User, event_id: uuid.UUID
) -> CheckoutOut:
    event, template = await _event_and_template(db, user, event_id, lock=True)
    price = await get_template_price(db, template)

    if price.is_free or await has_paid_payment(db, event.id):
        event = await publish_event(db, event.id, user)
        return CheckoutOut(payment_required=False, event=EventOut.model_validate(event))

    now = datetime.now(timezone.utc)
    reusable = (
        await db.execute(
            select(Payment)
            .where(
                Payment.event_id == event.id,
                Payment.status == PaymentStatus.CREATED,
                Payment.amount_minor == price.amount_minor,
                Payment.currency == price.currency,
                Payment.checkout_url.is_not(None),
                Payment.expires_at > now + _REUSE_MIN_REMAINING,
            )
            .order_by(Payment.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if reusable is not None:
        out = _checkout_out(reusable, event)
        await db.rollback()  # nothing written; release the event lock now
        return out

    razorpay = require_client(client)
    settings = get_settings()
    expires_at = now + timedelta(minutes=settings.payment_link_expiry_minutes)

    payment = Payment(
        event_id=event.id,
        user_id=user.id,
        template_id=template.id,
        amount_minor=price.amount_minor,
        currency=price.currency,
        status=PaymentStatus.CREATED,
        expires_at=expires_at,
    )
    db.add(payment)
    await db.flush()

    try:
        link = await razorpay.create_payment_link(
            amount_minor=price.amount_minor,
            currency=price.currency,
            reference_id=str(payment.id),
            description=f"{template.name} invitation",
            customer_email=user.email,
            callback_url=f"{settings.api_base_url.rstrip('/')}/v1/payments/razorpay/callback",
            expire_by=int(expires_at.timestamp()),
            notes={"event_id": str(event.id), "template_id": str(template.id)},
        )
    except Exception:
        await db.rollback()
        raise
    payment.provider_link_id = link["id"]
    payment.checkout_url = link["short_url"]

    await log_action(
        db,
        action="PAYMENT_CREATED",
        resource_type="payment",
        resource_id=payment.id,
        actor_user_id=user.id,
        metadata={"event_id": str(event.id), "amount_minor": price.amount_minor},
    )
    await db.commit()
    await db.refresh(payment)
    return _checkout_out(payment, event)


def _checkout_out(payment: Payment, event: Event) -> CheckoutOut:
    return CheckoutOut(
        payment_required=True,
        payment_id=payment.id,
        checkout_url=payment.checkout_url,
        amount_minor=payment.amount_minor,
        currency=payment.currency,
        event=EventOut.model_validate(event),
    )


def _payment_out(payment: Payment, template_name: str | None) -> PaymentOut:
    out = PaymentOut.model_validate(payment)
    out.template_name = template_name
    return out


async def get_payment(db: AsyncSession, user: User, payment_id: uuid.UUID) -> PaymentOut:
    payment = await db.get(Payment, payment_id)
    if payment is None:
        raise NotFoundError("PAYMENT_NOT_FOUND", "Payment not found.")
    ensure_owner_or_admin(user, payment.user_id)
    template = await db.get(Template, payment.template_id)
    return _payment_out(payment, template.name if template else None)


async def list_my_payments(db: AsyncSession, user: User, params: PageParams) -> Page[PaymentOut]:
    filters = [Payment.user_id == user.id]
    total = (
        await db.execute(select(func.count()).select_from(Payment).where(*filters))
    ).scalar_one()
    rows = (
        await db.execute(
            select(Payment, Template.name)
            .join(Template, Template.id == Payment.template_id)
            .where(*filters)
            .order_by(Payment.created_at.desc())
            .offset((params.page - 1) * params.page_size)
            .limit(params.page_size)
        )
    ).all()
    return make_page([_payment_out(p, name) for p, name in rows], total, params)


async def _lock_payment(db: AsyncSession, payment_id: uuid.UUID) -> Payment | None:
    stmt = select(Payment).where(Payment.id == payment_id).with_for_update()
    return (await db.execute(stmt)).scalar_one_or_none()


async def mark_paid(db: AsyncSession, payment: Payment, provider_payment_id: str | None) -> Event:
    """Idempotent: the browser callback and the webhook can both land for one payment."""
    event = await db.get(Event, payment.event_id)
    assert event is not None
    if payment.status == PaymentStatus.PAID:
        return event

    payment.status = PaymentStatus.PAID
    payment.paid_at = datetime.now(timezone.utc)
    if provider_payment_id:
        payment.provider_payment_id = provider_payment_id
    await log_action(
        db,
        action="PAYMENT_PAID",
        resource_type="payment",
        resource_id=payment.id,
        actor_user_id=payment.user_id,
        metadata={"provider_payment_id": provider_payment_id},
    )

    if event.status == EventStatus.DRAFT:
        event.status = EventStatus.PUBLISHED
        await log_action(
            db,
            action="EVENT_PUBLISHED",
            resource_type="event",
            resource_id=event.id,
            actor_user_id=payment.user_id,
        )
    await db.commit()
    await db.refresh(event)
    return event


def _parse_uuid(value: str | None) -> uuid.UUID | None:
    try:
        return uuid.UUID(value) if value else None
    except ValueError:
        return None


def _frontend_redirect(outcome: str, payment_id: uuid.UUID | None = None,
                       event_id: uuid.UUID | None = None) -> str:
    base = get_settings().frontend_base_url.rstrip("/")
    query = {"status": outcome}
    if payment_id and event_id:
        query |= {"paymentId": str(payment_id), "eventId": str(event_id)}
    return f"{base}/payment/result?{urlencode(query)}"


async def handle_callback(
    db: AsyncSession, client: RazorpayClient | None, params: dict[str, str]
) -> str:
    """Verify Razorpay's browser redirect and return the frontend URL to send the user to."""
    razorpay = require_client(client)
    link_id = params.get("razorpay_payment_link_id", "")
    reference_id = params.get("razorpay_payment_link_reference_id", "")
    link_status = params.get("razorpay_payment_link_status", "")
    provider_payment_id = params.get("razorpay_payment_id", "")
    signature = params.get("razorpay_signature", "")

    payment_uuid = _parse_uuid(reference_id)
    payment = await _lock_payment(db, payment_uuid) if payment_uuid else None
    if payment is None:
        logger.warning("Razorpay callback for unknown reference_id=%r", reference_id)
        return _frontend_redirect("failed")

    # Read before any rollback: rollback expires ORM attributes, and lazy reloads
    # are not allowed on an AsyncSession.
    payment_id, event_id = payment.id, payment.event_id

    valid = payment.provider_link_id == link_id and razorpay.verify_callback_signature(
        link_id=link_id,
        reference_id=reference_id,
        link_status=link_status,
        payment_id=provider_payment_id,
        signature=signature,
    )
    if not valid:
        logger.warning("Invalid Razorpay callback signature for payment %s", payment_id)
        await db.rollback()
        return _frontend_redirect("failed", payment_id, event_id)

    if link_status != "paid":
        await db.rollback()
        return _frontend_redirect("failed", payment_id, event_id)

    await mark_paid(db, payment, provider_payment_id)
    return _frontend_redirect("success", payment_id, event_id)


async def handle_webhook(
    db: AsyncSession, client: RazorpayClient | None, raw_body: bytes, signature: str
) -> None:
    razorpay = require_client(client)
    if not razorpay.verify_webhook_signature(raw_body, signature):
        raise AppError("INVALID_SIGNATURE", "Webhook signature verification failed.", 400)

    try:
        body: dict[str, Any] = json.loads(raw_body)
    except ValueError as exc:
        raise ValidationFailedError("Webhook body is not valid JSON.") from exc

    event_name = body.get("event")
    payload = body.get("payload") or {}
    link = (payload.get("payment_link") or {}).get("entity") or {}
    payment_uuid = _parse_uuid(link.get("reference_id"))
    if event_name not in {"payment_link.paid", "payment_link.expired", "payment_link.cancelled"}:
        return
    if payment_uuid is None:
        return

    payment = await _lock_payment(db, payment_uuid)
    if payment is None or payment.provider_link_id != link.get("id"):
        logger.warning("Razorpay webhook %s for unknown link %r", event_name, link.get("id"))
        await db.rollback()
        return

    if event_name == "payment_link.paid":
        amount_paid = int(link.get("amount_paid") or 0)
        if amount_paid < payment.amount_minor:
            logger.error(
                "Razorpay link %s paid %s < expected %s", link.get("id"), amount_paid,
                payment.amount_minor,
            )
            await db.rollback()
            return
        provider_payment_id = ((payload.get("payment") or {}).get("entity") or {}).get("id")
        await mark_paid(db, payment, provider_payment_id)
        return

    if payment.status == PaymentStatus.CREATED:
        payment.status = (
            PaymentStatus.EXPIRED if event_name == "payment_link.expired" else PaymentStatus.CANCELLED
        )
        await db.commit()
    else:
        await db.rollback()
