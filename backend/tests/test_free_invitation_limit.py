"""A user can publish at most 2 invitations without paying (free templates)."""

import uuid

import pytest

from app.payments.razorpay_client import get_razorpay_client
from tests.test_payments import (
    FakeRazorpayClient,
    _callback_params,
    _checkout,
    _make_event,
    _make_template,
    _payment_for,
)
from tests.test_templates import _make_admin


@pytest.fixture
def razorpay(client):
    from app.main import app

    fake = FakeRazorpayClient()
    app.dependency_overrides[get_razorpay_client] = lambda: fake
    return fake


async def _free_event(client, db_session, headers):
    template = await _make_template(db_session, paid=False)
    return await _make_event(client, headers, template)


async def test_third_free_publish_is_refused(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    events = [await _free_event(client, db_session, headers) for _ in range(3)]

    for e in events[:2]:
        resp = await _checkout(client, headers, e["id"])
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["event"]["status"] == "PUBLISHED"

    third = await _checkout(client, headers, events[2]["id"])
    assert third.status_code == 409
    err = third.json()["error"]
    assert err["code"] == "FREE_INVITATION_LIMIT"
    assert err["details"] == {"limit": 2, "published": 2}
    # The same rule applies on the direct publish endpoint.
    direct = await client.post(f"/v1/events/{events[2]['id']}/publish", headers=headers)
    assert direct.status_code == 409


async def test_archiving_one_frees_a_slot(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    events = [await _free_event(client, db_session, headers) for _ in range(3)]
    for e in events[:2]:
        await _checkout(client, headers, e["id"])

    archived = await client.delete(f"/v1/events/{events[0]['id']}", headers=headers)
    assert archived.status_code == 204

    resp = await _checkout(client, headers, events[2]["id"])
    assert resp.status_code == 200, resp.text


async def test_republishing_does_not_count_again(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    events = [await _free_event(client, db_session, headers) for _ in range(2)]
    for e in events:
        await _checkout(client, headers, e["id"])

    again = await client.post(f"/v1/events/{events[0]['id']}/publish", headers=headers)
    assert again.status_code == 200


async def test_paid_invitations_are_not_limited(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    for _ in range(2):
        await _checkout(client, headers, (await _free_event(client, db_session, headers))["id"])

    paid_template = await _make_template(db_session, paid=True)
    paid_event = await _make_event(client, headers, paid_template)
    await _checkout(client, headers, paid_event["id"])
    payment = await _payment_for(db_session, paid_event["id"])
    callback = await client.get("/v1/payments/razorpay/callback", params=_callback_params(payment))
    assert callback.status_code == 303
    assert "status=success" in callback.headers["location"]

    status = await client.get(f"/v1/events/{paid_event['id']}", headers=headers)
    assert status.json()["data"]["status"] == "PUBLISHED"


async def test_admins_are_exempt(client, db_session, auth_headers, razorpay):
    auth_id = uuid.uuid4()
    await _make_admin(db_session, auth_id)
    headers = auth_headers(str(auth_id))
    for _ in range(3):
        event = await _free_event(client, db_session, headers)
        resp = await _checkout(client, headers, event["id"])
        assert resp.status_code == 200, resp.text
