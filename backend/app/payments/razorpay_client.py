import hashlib
import hmac
import logging
from typing import Any

import httpx
from fastapi import status

from app.config import get_settings
from app.shared.errors import AppError

logger = logging.getLogger("evoke.payments")


class RazorpayClient:
    """Thin async wrapper over the Razorpay REST API (Payment Links)."""

    def __init__(
        self, key_id: str, key_secret: str, webhook_secret: str | None, api_url: str
    ) -> None:
        self._key_id = key_id
        self._key_secret = key_secret
        self._webhook_secret = webhook_secret
        self._api_url = api_url.rstrip("/")

    async def create_payment_link(
        self,
        *,
        amount_minor: int,
        currency: str,
        reference_id: str,
        description: str,
        customer_email: str | None,
        callback_url: str,
        expire_by: int,
        notes: dict[str, str],
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "amount": amount_minor,
            "currency": currency,
            "reference_id": reference_id,
            "description": description[:2048],
            "callback_url": callback_url,
            "callback_method": "get",
            "expire_by": expire_by,
            "notify": {"sms": False, "email": False},
            "reminder_enable": False,
            "notes": notes,
        }
        if customer_email:
            payload["customer"] = {"email": customer_email}

        try:
            async with httpx.AsyncClient(timeout=15) as http:
                resp = await http.post(
                    f"{self._api_url}/payment_links",
                    json=payload,
                    auth=(self._key_id, self._key_secret),
                )
        except httpx.HTTPError as exc:
            logger.exception("Razorpay request failed")
            raise AppError(
                "PAYMENT_PROVIDER_ERROR",
                "Could not reach the payment provider. Please try again.",
                status.HTTP_502_BAD_GATEWAY,
            ) from exc

        if resp.status_code >= 400:
            logger.error("Razorpay payment link error %s: %s", resp.status_code, resp.text)
            raise AppError(
                "PAYMENT_PROVIDER_ERROR",
                "The payment provider rejected the request.",
                status.HTTP_502_BAD_GATEWAY,
            )
        return resp.json()

    def verify_callback_signature(
        self, *, link_id: str, reference_id: str, link_status: str, payment_id: str, signature: str
    ) -> bool:
        message = f"{link_id}|{reference_id}|{link_status}|{payment_id}"
        return _hmac_matches(self._key_secret, message.encode(), signature)

    def verify_webhook_signature(self, raw_body: bytes, signature: str) -> bool:
        if not self._webhook_secret:
            return False
        return _hmac_matches(self._webhook_secret, raw_body, signature)


def _hmac_matches(secret: str, message: bytes, signature: str) -> bool:
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def require_client(client: RazorpayClient | None) -> RazorpayClient:
    if client is None:
        raise AppError(
            "PAYMENTS_NOT_CONFIGURED",
            "Payments are not configured on this server.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return client


def get_razorpay_client() -> RazorpayClient | None:
    """None when keys are unset, so free-template checkout still works without Razorpay."""
    settings = get_settings()
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        return None
    return RazorpayClient(
        key_id=settings.razorpay_key_id,
        key_secret=settings.razorpay_key_secret,
        webhook_secret=settings.razorpay_webhook_secret,
        api_url=settings.razorpay_api_url,
    )
