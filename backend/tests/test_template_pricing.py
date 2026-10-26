"""PAID templates default to INR (₹); switching to FREE clears the price."""

import uuid

import pytest

from app.templates.models import Currency
from tests.test_templates import _make_admin


@pytest.fixture
async def inr(db_session) -> Currency:
    currency = Currency(code="INR", name="Indian Rupee", symbol="₹", minor_unit=2, is_active=True)
    db_session.add(currency)
    await db_session.commit()
    await db_session.refresh(currency)
    return currency


@pytest.fixture
async def admin_headers(db_session, auth_headers):
    auth_id = uuid.uuid4()
    await _make_admin(db_session, auth_id)
    return auth_headers(str(auth_id))


async def _create(client, headers, **extra):
    return await client.post(
        "/v1/templates",
        headers=headers,
        json={"slug": f"tpl-{uuid.uuid4().hex[:8]}", "name": "Pricing Test", **extra},
    )


async def test_create_paid_without_currency_defaults_to_inr(client, admin_headers, inr):
    resp = await _create(client, admin_headers, pricingModel="PAID", priceAmountMinor=149900)
    assert resp.status_code == 201, resp.text
    body = resp.json()["data"]
    assert body["pricingModel"] == "PAID"
    assert body["currencyId"] == str(inr.id)


async def test_free_to_paid_without_currency_defaults_to_inr(client, admin_headers, inr):
    template_id = (await _create(client, admin_headers)).json()["data"]["id"]

    # Exactly what the admin dashboard used to send — it now succeeds.
    resp = await client.patch(
        f"/v1/templates/{template_id}",
        headers=admin_headers,
        json={
            "name": "Eternal Bond — Royal Wedding",
            "pricingModel": "PAID",
            "priceAmountMinor": 100,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()["data"]
    assert body["pricingModel"] == "PAID"
    assert body["priceAmountMinor"] == 100
    assert body["currencyId"] == str(inr.id)


async def test_paid_to_free_clears_price_and_currency(client, admin_headers, inr):
    template_id = (
        await _create(client, admin_headers, pricingModel="PAID", priceAmountMinor=50000)
    ).json()["data"]["id"]

    resp = await client.patch(
        f"/v1/templates/{template_id}", headers=admin_headers, json={"pricingModel": "FREE"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()["data"]
    assert body["pricingModel"] == "FREE"
    assert body["priceAmountMinor"] is None
    assert body["currencyId"] is None


async def test_paid_without_any_inr_currency_is_a_clear_422(client, admin_headers):
    template_id = (await _create(client, admin_headers)).json()["data"]["id"]

    resp = await client.patch(
        f"/v1/templates/{template_id}",
        headers=admin_headers,
        json={"pricingModel": "PAID", "priceAmountMinor": 100},
    )
    assert resp.status_code == 422
    assert "INR" in resp.json()["error"]["message"]


async def test_free_with_an_explicit_currency_is_still_rejected(client, admin_headers, inr):
    template_id = (await _create(client, admin_headers)).json()["data"]["id"]

    resp = await client.patch(
        f"/v1/templates/{template_id}",
        headers=admin_headers,
        json={"pricingModel": "FREE", "currencyId": str(inr.id)},
    )
    assert resp.status_code == 422
