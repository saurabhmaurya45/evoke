import hashlib
import hmac
import json
import uuid

import pytest
from sqlalchemy import select

from app.events.models import Event, EventStatus
from app.payments.models import Payment, PaymentStatus
from app.payments.razorpay_client import RazorpayClient, get_razorpay_client
from app.templates.models import PricingModel, Template, TemplateStatus

KEY_SECRET = "test_key_secret"
WEBHOOK_SECRET = "test_webhook_secret"


class FakeRazorpayClient(RazorpayClient):
    def __init__(self) -> None:
        super().__init__("rzp_test_key", KEY_SECRET, WEBHOOK_SECRET, "https://razorpay.invalid/v1")
        self.created: list[dict] = []

    async def create_payment_link(self, **kwargs):
        self.created.append(kwargs)
        n = len(self.created)
        return {"id": f"plink_test{n}", "short_url": f"https://rzp.io/i/test{n}", "status": "created"}


@pytest.fixture
def razorpay(client):
    from app.main import app

    fake = FakeRazorpayClient()
    app.dependency_overrides[get_razorpay_client] = lambda: fake
    return fake


def _sign(secret: str, message: bytes) -> str:
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


async def _make_template(db_session, *, paid: bool) -> Template:
    template = Template(
        slug=f"tpl-test-{uuid.uuid4().hex[:8]}",
        name="Test Template",
        status=TemplateStatus.ACTIVE,
        storefront_status="LISTED",
        pricing_model=(PricingModel.PAID if paid else PricingModel.FREE).value,
        price_amount_minor=149900 if paid else None,
    )
    db_session.add(template)
    await db_session.commit()
    return template


async def _make_event(client, headers, template: Template) -> dict:
    resp = await client.post("/v1/events", headers=headers, json={"title": template.slug})
    assert resp.status_code == 201
    return resp.json()["data"]


async def _checkout(client, headers, event_id: str):
    return await client.post("/v1/payments/checkout", headers=headers, json={"eventId": event_id})


def _callback_params(payment: Payment, *, status: str = "paid", secret: str = KEY_SECRET) -> dict:
    payment_id = "pay_test123"
    message = f"{payment.provider_link_id}|{payment.id}|{status}|{payment_id}".encode()
    return {
        "razorpay_payment_id": payment_id,
        "razorpay_payment_link_id": payment.provider_link_id,
        "razorpay_payment_link_reference_id": str(payment.id),
        "razorpay_payment_link_status": status,
        "razorpay_signature": _sign(secret, message),
    }


async def _payment_for(db_session, event_id: str) -> Payment:
    stmt = select(Payment).where(Payment.event_id == uuid.UUID(event_id))
    return (await db_session.execute(stmt)).scalar_one()


async def test_free_template_checkout_publishes_without_payment(
    client, db_session, auth_headers, razorpay
):
    headers = auth_headers()
    template = await _make_template(db_session, paid=False)
    event = await _make_event(client, headers, template)

    quote = await client.get(f"/v1/payments/quote?eventId={event['id']}", headers=headers)
    assert quote.status_code == 200
    assert quote.json()["data"]["paymentRequired"] is False

    resp = await _checkout(client, headers, event["id"])
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["paymentRequired"] is False
    assert body["event"]["status"] == "PUBLISHED"
    assert razorpay.created == []


async def test_free_template_checkout_works_without_razorpay_keys(client, db_session, auth_headers):
    from app.main import app

    app.dependency_overrides[get_razorpay_client] = lambda: None
    headers = auth_headers()
    template = await _make_template(db_session, paid=False)
    event = await _make_event(client, headers, template)

    resp = await _checkout(client, headers, event["id"])
    assert resp.status_code == 200
    assert resp.json()["data"]["event"]["status"] == "PUBLISHED"


async def test_paid_template_requires_payment(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    template = await _make_template(db_session, paid=True)
    event = await _make_event(client, headers, template)

    quote = (await client.get(f"/v1/payments/quote?eventId={event['id']}", headers=headers)).json()
    assert quote["data"]["paymentRequired"] is True
    assert quote["data"]["amountMinor"] == 149900
    assert quote["data"]["currency"] == "INR"

    resp = await _checkout(client, headers, event["id"])
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["paymentRequired"] is True
    assert body["checkoutUrl"] == "https://rzp.io/i/test1"
    assert body["amountMinor"] == 149900
    assert razorpay.created[0]["amount_minor"] == 149900
    assert razorpay.created[0]["reference_id"] == body["paymentId"]

    again = (await _checkout(client, headers, event["id"])).json()["data"]
    assert again["paymentId"] == body["paymentId"]
    assert len(razorpay.created) == 1

    publish = await client.post(f"/v1/events/{event['id']}/publish", headers=headers)
    assert publish.status_code == 402
    assert publish.json()["error"]["code"] == "PAYMENT_REQUIRED"


async def test_valid_callback_marks_paid_and_publishes(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    template = await _make_template(db_session, paid=True)
    event = await _make_event(client, headers, template)
    await _checkout(client, headers, event["id"])
    payment = await _payment_for(db_session, event["id"])

    params = _callback_params(payment)
    resp = await client.get("/v1/payments/razorpay/callback", params=params)
    assert resp.status_code == 303
    assert resp.headers["location"] == (
        f"http://localhost:4200/payment/result?status=success"
        f"&paymentId={payment.id}&eventId={event['id']}"
    )

    await db_session.refresh(payment)
    assert payment.status == PaymentStatus.PAID
    assert payment.provider_payment_id == "pay_test123"
    db_event = await db_session.get(Event, uuid.UUID(event["id"]))
    await db_session.refresh(db_event)
    assert db_event.status == EventStatus.PUBLISHED

    repeat = await client.get("/v1/payments/razorpay/callback", params=params)
    assert repeat.status_code == 303
    assert "status=success" in repeat.headers["location"]

    status_resp = await client.get(f"/v1/payments/{payment.id}", headers=headers)
    assert status_resp.json()["data"]["status"] == "PAID"
    assert status_resp.json()["data"]["templateName"] == "Test Template"

    listing = (await client.get("/v1/payments", headers=headers)).json()
    assert [p["id"] for p in listing["data"]] == [str(payment.id)]

    publish = await client.post(f"/v1/events/{event['id']}/publish", headers=headers)
    assert publish.status_code == 200


async def test_callback_with_bad_signature_changes_nothing(
    client, db_session, auth_headers, razorpay
):
    headers = auth_headers()
    template = await _make_template(db_session, paid=True)
    event = await _make_event(client, headers, template)
    await _checkout(client, headers, event["id"])
    payment = await _payment_for(db_session, event["id"])

    params = _callback_params(payment, secret="wrong_secret")
    resp = await client.get("/v1/payments/razorpay/callback", params=params)
    assert resp.status_code == 303
    assert "status=failed" in resp.headers["location"]

    await db_session.refresh(payment)
    assert payment.status == PaymentStatus.CREATED


async def test_webhook_paid_marks_paid(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    template = await _make_template(db_session, paid=True)
    event = await _make_event(client, headers, template)
    await _checkout(client, headers, event["id"])
    payment = await _payment_for(db_session, event["id"])

    body = json.dumps(
        {
            "event": "payment_link.paid",
            "payload": {
                "payment_link": {
                    "entity": {
                        "id": payment.provider_link_id,
                        "reference_id": str(payment.id),
                        "status": "paid",
                        "amount_paid": 149900,
                    }
                },
                "payment": {"entity": {"id": "pay_webhook1"}},
            },
        }
    ).encode()

    bad = await client.post(
        "/v1/payments/razorpay/webhook",
        content=body,
        headers={"X-Razorpay-Signature": "nope", "Content-Type": "application/json"},
    )
    assert bad.status_code == 400
    await db_session.refresh(payment)
    assert payment.status == PaymentStatus.CREATED

    ok = await client.post(
        "/v1/payments/razorpay/webhook",
        content=body,
        headers={
            "X-Razorpay-Signature": _sign(WEBHOOK_SECRET, body),
            "Content-Type": "application/json",
        },
    )
    assert ok.status_code == 200
    await db_session.refresh(payment)
    assert payment.status == PaymentStatus.PAID
    assert payment.provider_payment_id == "pay_webhook1"


async def test_other_user_cannot_checkout_someone_elses_event(
    client, db_session, auth_headers, razorpay
):
    owner = auth_headers()
    template = await _make_template(db_session, paid=True)
    event = await _make_event(client, owner, template)

    resp = await _checkout(client, auth_headers(), event["id"])
    assert resp.status_code == 403
    assert razorpay.created == []
