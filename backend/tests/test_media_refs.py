"""Pure tests for media references inside draft JSON (no database)."""

import uuid

import pytest

from app.media.service import ensure_event_media, resolve_media_refs, to_storage_refs
from app.shared.errors import ValidationFailedError
from app.shared.storage.b2_client import B2Client


def _real_client() -> B2Client:
    return B2Client(
        endpoint_url="https://s3.us-east-005.backblazeb2.com",
        bucket="evoke-media",
        producer_key_id="p",
        producer_key_secret="p",
        consumer_key_id="c",
        consumer_key_secret="c",
    )


OWNER = uuid.uuid4()
EVENT = uuid.uuid4()
PATH = f"public/{OWNER}/{EVENT}/image/{uuid.uuid4()}.jpg"


def test_round_trip_through_real_presigned_urls():
    b2 = _real_client()
    data = {"hero": {"photo": PATH, "title": "Hi"}, "gallery": {"items": [{"image": PATH}]}}

    resolved = resolve_media_refs(b2, data)
    url = resolved["hero"]["photo"]
    assert url.startswith(f"https://s3.us-east-005.backblazeb2.com/evoke-media/{PATH}?")
    assert "X-Amz-Signature=" in url
    assert resolved["gallery"]["items"][0]["image"].startswith("https://")
    assert resolved["hero"]["title"] == "Hi"

    assert to_storage_refs(b2, resolved) == data


def test_leaves_everything_else_alone():
    b2 = _real_client()
    data = {
        "a": "https://cdn.example.com/x.jpg",
        "b": "/invitation-templates/template 1/x.jpg",
        "c": "data:image/png;base64,AAAA",
        "d": "https://s3.us-east-005.backblazeb2.com/other-bucket/public/x.jpg?sig=1",
        "e": 3,
        "f": None,
        "g": True,
    }
    assert resolve_media_refs(b2, data) == data
    assert to_storage_refs(b2, data) == data


def test_without_b2_data_is_unchanged():
    data = {"photo": PATH}
    assert resolve_media_refs(None, data) == data
    assert to_storage_refs(None, data) == data


def test_event_media_must_belong_to_the_event():
    ensure_event_media({"photo": PATH, "base": "asset/x/image/y.jpg"}, OWNER, EVENT)

    other = f"public/{uuid.uuid4()}/{uuid.uuid4()}/image/z.jpg"
    with pytest.raises(ValidationFailedError) as exc:
        ensure_event_media({"list": [{"image": other}]}, OWNER, EVENT)
    assert exc.value.details == {"paths": [other]}
