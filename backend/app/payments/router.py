import uuid

from fastapi import APIRouter, Depends, Header, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.payments.razorpay_client import RazorpayClient, get_razorpay_client
from app.payments.schemas import CheckoutOut, CheckoutRequest, PaymentOut, PriceQuoteOut
from app.payments.service import (
    get_payment,
    get_quote,
    handle_callback,
    handle_webhook,
    list_my_payments,
    start_checkout,
)
from app.shared.auth.dependencies import get_current_user
from app.shared.database import get_db
from app.shared.envelope import Envelope
from app.shared.pagination import Page, PageParams, page_params
from app.users.models import User

router = APIRouter(prefix="/v1/payments", tags=["payments"])


@router.get("/quote", response_model=Envelope[PriceQuoteOut])
async def quote_route(
    event_id: uuid.UUID = Query(..., alias="eventId"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Envelope[PriceQuoteOut]:
    """Price of the event's template, computed server-side."""
    return Envelope(data=await get_quote(db, current_user, event_id))


@router.post("/checkout", response_model=Envelope[CheckoutOut])
async def checkout_route(
    data: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    client: RazorpayClient | None = Depends(get_razorpay_client),
) -> Envelope[CheckoutOut]:
    """Free template (or already paid): publishes and returns `paymentRequired=false`.
    Paid template: returns a Razorpay `checkoutUrl` the frontend should redirect to."""
    return Envelope(data=await start_checkout(db, client, current_user, data.event_id))


@router.get("/razorpay/callback", include_in_schema=False)
async def razorpay_callback_route(
    request: Request,
    db: AsyncSession = Depends(get_db),
    client: RazorpayClient | None = Depends(get_razorpay_client),
) -> RedirectResponse:
    redirect_url = await handle_callback(db, client, dict(request.query_params))
    return RedirectResponse(redirect_url, status_code=status.HTTP_303_SEE_OTHER)


@router.post("/razorpay/webhook", include_in_schema=False)
async def razorpay_webhook_route(
    request: Request,
    x_razorpay_signature: str = Header(""),
    db: AsyncSession = Depends(get_db),
    client: RazorpayClient | None = Depends(get_razorpay_client),
) -> dict:
    await handle_webhook(db, client, await request.body(), x_razorpay_signature)
    return {"status": "ok"}


@router.get("", response_model=Page[PaymentOut])
async def list_my_payments_route(
    params: PageParams = Depends(page_params),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[PaymentOut]:
    return await list_my_payments(db, current_user, params)


@router.get("/{payment_id}", response_model=Envelope[PaymentOut])
async def get_payment_route(
    payment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Envelope[PaymentOut]:
    return Envelope(data=await get_payment(db, current_user, payment_id))
