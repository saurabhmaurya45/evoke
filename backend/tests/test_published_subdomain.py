"""Published invitations get a wedding subdomain: `arjun-priya.theinvitely.in`."""

from app.events.subdomain import published_subdomain_base
from tests.test_payments import _checkout
from tests.test_published_slug import NAMES, _event_with_names


NAMES = {"hero": {"groomName": "Arjun Sharma", "brideName": "Priya"}}


def test_subdomain_base_omits_and():
    assert published_subdomain_base(NAMES) == "arjun-priya"


async def test_free_publish_assigns_subdomain(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    event = await _event_with_names(client, db_session, headers, NAMES)

    published = (await _checkout(client, headers, event["id"])).json()["data"]["event"]
    assert published["publicSubdomain"] == "arjun-priya"

    by_sub = await client.get(f"/v1/i/by-subdomain/{published['publicSubdomain']}")
    assert by_sub.status_code == 200
    assert by_sub.json()["slug"] == published["slug"]


async def test_duplicate_names_get_suffix(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    first = await _event_with_names(client, db_session, headers, NAMES)
    first_pub = (await _checkout(client, headers, first["id"])).json()["data"]["event"]
    assert first_pub["publicSubdomain"] == "arjun-priya"

    second = await _event_with_names(client, db_session, auth_headers(), NAMES)
    second_pub = (await _checkout(client, headers, second["id"])).json()["data"]["event"]
    assert second_pub["publicSubdomain"] == "arjun-priya-2"


async def test_republishing_keeps_subdomain(client, db_session, auth_headers, razorpay):
    headers = auth_headers()
    event = await _event_with_names(client, db_session, headers, NAMES)
    published = (await _checkout(client, headers, event["id"])).json()["data"]["event"]
    subdomain = published["publicSubdomain"]

    again = await client.post(f"/v1/events/{event['id']}/publish", headers=headers)
    assert again.json()["data"]["publicSubdomain"] == subdomain