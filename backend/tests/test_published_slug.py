"""Published invitations get a readable link: `arjun-and-priya-k7x2`."""

import re
import uuid

import pytest

from app.events import service as events_service
from app.events.models import Event
from app.events.service import published_slug_base
from app.payments.razorpay_client import get_razorpay_client
from tests.test_payments import (
    FakeRazorpayClient,
    _callback_params,
    _checkout,
    _make_event,
    _make_template,
    _payment_for,
)


@pytest.fixture
def razorpay(client):
    from app.main import app

    fake = FakeRazorpayClient()
    app.dependency_overrides[get_razorpay_client] = lambda: fake
    return fake


PUBLISHED = re.compile(r"^arjun-and-priya-[a-z0-9]{4}$")


# --- building the name part ------------------------------------------------


def test_slug_base_uses_first_names_from_any_section():
    assert published_slug_base({"hero": {"groomName": "Arjun", "brideName": "Priya"}}) == (
        "arjun-and-priya"
    )
    assert published_slug_base(
        {"couple": {"groomName": "Arjun Sharma", "brideName": "Priya Kapoor"}}
    ) == ("arjun-and-priya")
    # Bride and groom in different sections still pair up.
    assert published_slug_base({"a": {"groomName": "Arjun"}, "b": {"brideName": "Priya"}}) == (
        "arjun-and-priya"
    )


def test_slug_base_prefers_a_first_name_field():
    data = {
        "couple": {
            "groomName": "Vihaan Rathore",
            "groomShort": "Vihaan",
            "brideName": "Meera Singh",
            "brideShort": "Meera",
        }
    }
    assert published_slug_base(data) == "vihaan-and-meera"


def test_slug_base_transliterates_accents_and_drops_symbols():
    data = {"hero": {"groomName": "  Zoë-Ann ", "brideName": "Renée!"}}
    assert published_slug_base(data) == "zoe-and-renee"


def test_slug_base_needs_both_names_in_latin_letters():
    assert published_slug_base({}) is None
    assert published_slug_base({"hero": {"groomName": "Arjun", "brideName": ""}}) is None
    assert published_slug_base({"hero": {"groomName": "अर्जुन", "brideName": "Priya"}}) is None


# --- publishing ------------------------------------------------------------


async def _event_with_names(client, db_session, headers, data, *, paid=False):
    template = await _make_template(db_session, paid=paid)
    event = await _make_event(client, headers, template)
    save = await client.put(
        f"/v1/events/{event['id']}/draft", headers=headers, json={"data": data, "revision": 0}
    )
    assert save.status_code == 200
    return event


NAMES = {"hero": {"groomName": "Arjun Sharma", "brideName": "Priya"}}


async def test_free_publish_gets_a_readable_link(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    event = await _event_with_names(client, db_session, headers, NAMES)
    draft_slug = event["slug"]
    assert draft_slug.startswith("tpl-test-")

    published = (await _checkout(client, headers, event["id"])).json()["data"]["event"]
    assert PUBLISHED.match(published["slug"])

    # The invitation is served at the new link…
    page = await client.get(f"/v1/i/{published['slug']}")
    assert page.status_code == 200
    assert page.json()["eventId"] == event["id"]

    # …and publishing again never renames it.
    again = await client.post(f"/v1/events/{event['id']}/publish", headers=headers)
    assert again.json()["data"]["slug"] == published["slug"]


async def test_paid_publish_via_payment_gets_a_readable_link(
    client, db_session, auth_headers, razorpay
):
    headers = auth_headers()
    event = await _event_with_names(client, db_session, headers, NAMES, paid=True)
    await _checkout(client, headers, event["id"])
    payment = await _payment_for(db_session, event["id"])

    resp = await client.get("/v1/payments/razorpay/callback", params=_callback_params(payment))
    assert resp.status_code == 303

    db_event = await db_session.get(Event, uuid.UUID(event["id"]))
    await db_session.refresh(db_event)
    assert PUBLISHED.match(db_event.slug)


async def test_publish_without_names_keeps_the_draft_link(
    client, db_session, auth_headers, razorpay
):
    headers = auth_headers()
    event = await _event_with_names(client, db_session, headers, {"hero": {"tagline": "Hi"}})

    published = (await _checkout(client, headers, event["id"])).json()["data"]["event"]
    assert published["slug"] == event["slug"]


async def test_a_taken_code_picks_another(client, db_session, auth_headers, razorpay, monkeypatch):
    headers = auth_headers()
    # Another couple already has arjun-and-priya-aaaa.
    other = await _event_with_names(client, db_session, auth_headers(), NAMES)
    other_row = await db_session.get(Event, uuid.UUID(other["id"]))
    other_row.slug = "arjun-and-priya-aaaa"
    await db_session.commit()

    event = await _event_with_names(client, db_session, headers, NAMES)
    codes = iter(["aaaa", "bbbb"])
    real = events_service._random_suffix
    monkeypatch.setattr(
        events_service,
        "_random_suffix",
        lambda length=6: next(codes) if length == 4 else real(length),
    )

    published = (await _checkout(client, headers, event["id"])).json()["data"]["event"]
    assert published["slug"] == "arjun-and-priya-bbbb"
