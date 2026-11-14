import json
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.drafts.models import Draft
from app.events.models import Event, EventStatus
from app.payments.models import Payment, PaymentStatus
from app.reels.models import EventReel, ReelKind, ReelStatus
from app.reels.service import REEL_FILMS
from app.reels.worker import (
    MAX_ATTEMPTS,
    allowed_media_hosts,
    claim_next,
    process_reel,
    requeue_abandoned,
)
from app.shared.storage.b2_client import get_b2_client
from app.templates.models import Template, TemplateStatus
from app.users.models import User, UserRole

FILMS_DIR = Path(__file__).resolve().parents[2] / "tools" / "reel" / "templates"
SLOT = "tpl-lace-classic"
NAMES = {"couple": {"groomName": "Arjun", "brideName": "Priya"}}


class FakeB2:
    bucket = "test"

    def __init__(self) -> None:
        self.uploads: dict[str, dict] = {}
        self.deleted: list[str] = []

    def get_url(self, key: str, expires_in: int) -> str:
        return f"https://media.test/{key}"

    def upload_file(self, key: str, path: Path, content_type: str, download_name: str) -> None:
        self.uploads[key] = {"bytes": path.read_bytes(), "name": download_name}

    def delete_object(self, key: str) -> None:
        self.deleted.append(key)


@pytest.fixture
def b2(client) -> Iterator[FakeB2]:
    from app.main import app

    fake = FakeB2()
    app.dependency_overrides[get_b2_client] = lambda: fake
    yield fake


@pytest.fixture(autouse=True)
def reels_on(monkeypatch) -> None:
    monkeypatch.setattr(get_settings(), "reels_enabled", True)


class SessionFactory:
    """Hands the worker the test's own session, without closing it."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def __call__(self):
        return self

    async def __aenter__(self) -> AsyncSession:
        return self.session

    async def __aexit__(self, *exc) -> None:
        return None


async def _invitation(
    db: AsyncSession,
    *,
    slot: str = SLOT,
    status: EventStatus = EventStatus.PUBLISHED,
    data: dict | None = None,
    role: UserRole = UserRole.USER,
    paid: bool = True,
) -> tuple[Event, str]:
    """An invitation; with `paid`, its invitation and video were both bought."""
    auth_id = uuid.uuid4()
    user = User(auth_user_id=auth_id, email=f"{auth_id}@example.test", role=role)
    db.add(user)
    await db.flush()
    event = Event(owner_id=user.id, title=slot, slug=f"s-{uuid.uuid4().hex[:10]}", status=status)
    db.add(event)
    await db.flush()
    db.add(Draft(event_id=event.id, data=NAMES if data is None else data, revision=1))
    if paid:
        await _pay(db, event)
    await db.commit()
    return event, str(auth_id)


async def _pay(
    db: AsyncSession,
    event: Event,
    status: PaymentStatus = PaymentStatus.PAID,
    *,
    template: bool = True,
    video: bool = True,
) -> None:
    includes = {"includes_template": template, "includes_video": video}
    row = Template(
        slug=f"t-{uuid.uuid4().hex[:10]}",
        name="t",
        status=TemplateStatus.ACTIVE,
        storefront_status="LISTED",
    )
    db.add(row)
    await db.flush()
    db.add(
        Payment(
            event_id=event.id,
            user_id=event.owner_id,
            template_id=row.id,
            amount_minor=49900,
            currency="INR",
            status=status,
            **includes,
        )
    )
    await db.flush()


def test_films_listed_match_the_films_that_exist():
    on_disk = {p.parent.name: p for p in FILMS_DIR.glob("*/meta.json")}
    assert set(REEL_FILMS) == set(on_disk)
    for slot, meta_file in on_disk.items():
        assert set(REEL_FILMS[slot]) == set(json.loads(meta_file.read_text())["required"])


async def test_request_queues_once_and_reports_progress(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session)
    url = f"/v1/events/{event.id}/reel"

    before = (await client.get(url, headers=auth_headers(user))).json()["data"]
    assert before["available"] is True
    assert before["status"] is None

    first = await client.post(url, headers=auth_headers(user))
    assert first.status_code == 202
    assert first.json()["data"]["status"] == "QUEUED"

    again = await client.post(url, headers=auth_headers(user))
    assert again.status_code == 202
    rows = (await db_session.execute(select(EventReel))).scalars().all()
    assert len(rows) == 1


async def test_other_users_cannot_see_or_request_it(client, db_session, auth_headers, b2):
    event, _ = await _invitation(db_session)
    _, stranger = await _invitation(db_session)
    url = f"/v1/events/{event.id}/reel"
    assert (await client.get(url, headers=auth_headers(stranger))).status_code == 404
    assert (await client.post(url, headers=auth_headers(stranger))).status_code == 404


async def test_template_without_film_is_unavailable(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session, slot="tpl-without-a-film")
    url = f"/v1/events/{event.id}/reel"
    assert (await client.get(url, headers=auth_headers(user))).json()["data"]["available"] is False
    refused = await client.post(url, headers=auth_headers(user))
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "REEL_NOT_AVAILABLE"


async def test_draft_invitation_is_refused(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session, status=EventStatus.DRAFT)
    refused = await client.post(f"/v1/events/{event.id}/reel", headers=auth_headers(user))
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "EVENT_NOT_PUBLISHED"


@pytest.mark.parametrize("role", [UserRole.USER, UserRole.ADMIN])
@pytest.mark.parametrize("template_paid", [False, True])
async def test_video_not_bought_offers_only_the_preview(
    client, db_session, auth_headers, b2, role, template_paid
):
    event, user = await _invitation(db_session, paid=False, role=role)
    if template_paid:  # paying for the invitation alone doesn't buy the video
        await _pay(db_session, event, video=False)
        await db_session.commit()
    url = f"/v1/events/{event.id}/reel"
    state = (await client.get(url, headers=auth_headers(user))).json()["data"]
    assert state["available"] is True
    assert state["purchased"] is False
    # No template row in these tests, so it counts as free: the fixed video price.
    assert state["priceMinor"] == get_settings().reel_price_free_template_minor
    refused = await client.post(url, headers=auth_headers(user))
    assert refused.status_code == 402
    assert refused.json()["error"]["code"] == "REEL_PAYMENT_REQUIRED"
    assert (await db_session.execute(select(EventReel))).scalars().all() == []


@pytest.mark.parametrize(
    "status", [PaymentStatus.CREATED, PaymentStatus.FAILED, PaymentStatus.CANCELLED]
)
async def test_unfinished_payment_does_not_count(client, db_session, auth_headers, b2, status):
    event, user = await _invitation(db_session, paid=False)
    await _pay(db_session, event, status)
    await db_session.commit()
    refused = await client.post(f"/v1/events/{event.id}/reel", headers=auth_headers(user))
    assert refused.status_code == 402


async def test_payment_unlocks_the_video(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session, paid=False)
    await _pay(db_session, event, template=False)  # the video bought on its own
    await db_session.commit()
    url = f"/v1/events/{event.id}/reel"
    assert (await client.get(url, headers=auth_headers(user))).json()["data"]["purchased"] is True
    assert (await client.post(url, headers=auth_headers(user))).status_code == 202


async def test_missing_names_are_named_in_the_error(client, db_session, auth_headers, b2):
    data = {"couple": {"groomName": "Arjun", "brideName": "   "}}
    event, user = await _invitation(db_session, data=data)
    refused = await client.post(f"/v1/events/{event.id}/reel", headers=auth_headers(user))
    assert refused.status_code == 422
    assert refused.json()["error"]["details"]["fields"] == ["couple.brideName"]


async def test_disabled_until_a_worker_exists(client, db_session, auth_headers, b2, monkeypatch):
    monkeypatch.setattr(get_settings(), "reels_enabled", False)
    event, user = await _invitation(db_session)
    url = f"/v1/events/{event.id}/reel"
    assert (await client.get(url, headers=auth_headers(user))).json()["data"]["available"] is False
    refused = await client.post(url, headers=auth_headers(user))
    assert refused.status_code == 503
    assert refused.json()["error"]["code"] == "REELS_DISABLED"


async def test_daily_limit_ignores_failures_and_admins(
    client, db_session, auth_headers, b2, monkeypatch
):
    monkeypatch.setattr(get_settings(), "reel_daily_limit", 1)
    first, user = await _invitation(db_session)
    owner_id = first.owner_id
    db_session.add(
        EventReel(
            event_id=first.id,
            requested_by_user_id=owner_id,
            template_slot_id=SLOT,
            draft_revision=1,
            status=ReelStatus.FAILED,
        )
    )
    await db_session.commit()
    ok = await client.post(f"/v1/events/{first.id}/reel", headers=auth_headers(user))
    assert ok.status_code == 202

    second = Event(owner_id=owner_id, title=SLOT, slug="second", status=EventStatus.PUBLISHED)
    db_session.add(second)
    await db_session.flush()
    db_session.add(Draft(event_id=second.id, data=NAMES, revision=1))
    await _pay(db_session, second)
    await db_session.commit()
    refused = await client.post(f"/v1/events/{second.id}/reel", headers=auth_headers(user))
    assert refused.status_code == 429
    assert refused.json()["error"]["code"] == "REEL_DAILY_LIMIT"


async def _render_ok(slot, data, out: Path, on_progress, preview=False) -> None:
    on_progress(50)
    out.write_bytes(b"video")


async def test_worker_renders_current_data_and_serves_it(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session)
    url = f"/v1/events/{event.id}/reel"
    await client.post(url, headers=auth_headers(user))
    # Edited while queued: the video must show this, and must not read as stale.
    draft = (await db_session.execute(select(Draft))).scalar_one()
    draft.data = {"couple": {"groomName": "Rahul", "brideName": "Priya"}}
    draft.revision = 2
    await db_session.commit()

    seen = {}

    async def renderer(slot, data, out, on_progress, preview):
        seen.update(slot=slot, data=data)
        await _render_ok(slot, data, out, on_progress, preview)

    reel_id = await claim_next(db_session)
    assert reel_id is not None
    await process_reel(
        reel_id, b2=b2, session_factory=SessionFactory(db_session), renderer=renderer
    )

    assert seen["slot"] == SLOT
    assert seen["data"]["couple"]["groomName"] == "Rahul"
    state = (await client.get(url, headers=auth_headers(user))).json()["data"]
    assert state["status"] == "READY"
    assert state["isStale"] is False
    assert state["sizeBytes"] == 5
    key = state["downloadUrl"].removeprefix("https://media.test/")
    assert key.startswith(f"public/{event.owner_id}/{event.id}/reel/")
    assert b2.uploads[key]["name"] == f"{event.slug}-video.mp4"

    # Up to date: nothing new is queued. After an edit: flagged, and a new video replaces it.
    await client.post(url, headers=auth_headers(user))
    assert await claim_next(db_session) is None
    draft.revision = 3
    await db_session.commit()
    assert (await client.get(url, headers=auth_headers(user))).json()["data"]["isStale"] is True
    await client.post(url, headers=auth_headers(user))
    next_id = await claim_next(db_session)
    assert next_id is not None
    await process_reel(
        next_id, b2=b2, session_factory=SessionFactory(db_session), renderer=_render_ok
    )
    assert b2.deleted == [key]


async def test_failed_render_retries_then_fails_and_keeps_old_video(
    client, db_session, auth_headers, b2
):
    event, user = await _invitation(db_session)
    url = f"/v1/events/{event.id}/reel"
    await client.post(url, headers=auth_headers(user))

    async def broken(slot, data, out, on_progress, preview):
        raise RuntimeError("boom https://bucket/x.mp3?X-Amz-Signature=secret")

    for _ in range(MAX_ATTEMPTS):
        reel_id = await claim_next(db_session)
        assert reel_id is not None
        await process_reel(
            reel_id, b2=b2, session_factory=SessionFactory(db_session), renderer=broken
        )
    assert await claim_next(db_session) is None

    reel = (await db_session.execute(select(EventReel))).scalar_one()
    assert reel.status == ReelStatus.FAILED
    assert "secret" not in (reel.failure_reason or "")
    body = (await client.get(url, headers=auth_headers(user))).json()["data"]
    assert body["status"] == "FAILED"
    assert "boom" not in json.dumps(body)


async def test_archived_while_queued_is_not_rendered(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session)
    await client.post(f"/v1/events/{event.id}/reel", headers=auth_headers(user))
    event.status = EventStatus.ARCHIVED
    await db_session.commit()

    async def must_not_run(slot, data, out, on_progress, preview):
        raise AssertionError("rendered an archived invitation")

    reel_id = await claim_next(db_session)
    assert reel_id is not None
    await process_reel(
        reel_id, b2=b2, session_factory=SessionFactory(db_session), renderer=must_not_run
    )
    reel = (await db_session.execute(select(EventReel))).scalar_one()
    assert reel.status == ReelStatus.FAILED
    assert b2.uploads == {}


async def test_abandoned_render_is_requeued_then_given_up_on(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session)
    await client.post(f"/v1/events/{event.id}/reel", headers=auth_headers(user))
    reel_id = await claim_next(db_session)
    reel = await db_session.get(EventReel, reel_id)
    assert reel is not None

    reel.heartbeat_at = datetime.now(UTC) - timedelta(hours=1)
    await db_session.commit()
    await requeue_abandoned(db_session)
    await db_session.refresh(reel)
    assert reel.status == ReelStatus.QUEUED

    reel.status = ReelStatus.RENDERING
    reel.attempts = MAX_ATTEMPTS
    reel.heartbeat_at = datetime.now(UTC)
    await db_session.commit()
    await requeue_abandoned(db_session)
    await db_session.refresh(reel)
    assert reel.status == ReelStatus.RENDERING  # still alive, so left alone

    reel.heartbeat_at = datetime.now(UTC) - timedelta(hours=1)
    await db_session.commit()
    await requeue_abandoned(db_session)
    await db_session.refresh(reel)
    assert reel.status == ReelStatus.FAILED


def test_films_may_only_fetch_from_our_own_storage(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "public_media_base_url", "https://media.example.com/x")
    monkeypatch.setattr(settings, "b2_endpoint_url", "https://acct.r2.cloudflarestorage.com")
    assert allowed_media_hosts(settings) == ["acct.r2.cloudflarestorage.com", "media.example.com"]


async def test_preview_is_made_before_paying_even_for_a_draft(
    client, db_session, auth_headers, b2
):
    event, user = await _invitation(db_session, status=EventStatus.DRAFT, paid=False)
    url = f"/v1/events/{event.id}/reel"

    first = await client.post(f"{url}/preview", headers=auth_headers(user))
    assert first.status_code == 202
    assert first.json()["data"]["previewStatus"] == "QUEUED"
    assert (await client.post(f"{url}/preview", headers=auth_headers(user))).status_code == 202
    reel = (await db_session.execute(select(EventReel))).scalar_one()
    assert reel.kind == ReelKind.PREVIEW

    seen = {}

    async def renderer(slot, data, out, on_progress, preview):
        seen["preview"] = preview
        await _render_ok(slot, data, out, on_progress, preview)

    reel_id = await claim_next(db_session)
    await process_reel(
        reel_id, b2=b2, session_factory=SessionFactory(db_session), renderer=renderer
    )
    assert seen["preview"] is True
    state = (await client.get(url, headers=auth_headers(user))).json()["data"]
    assert state["previewStatus"] == "READY"
    assert state["downloadUrl"] is None and state["status"] is None
    key = state["previewUrl"].removeprefix("https://media.test/")
    assert key.startswith(f"public/{event.owner_id}/{event.id}/reel/preview-")
    assert b2.uploads[key]["name"] == f"{event.slug}-preview.mp4"

    # Up to date, so nothing new; after an edit it's stale and a new preview replaces it.
    await client.post(f"{url}/preview", headers=auth_headers(user))
    assert await claim_next(db_session) is None
    draft = (await db_session.execute(select(Draft))).scalar_one()
    draft.revision = 2
    await db_session.commit()
    assert (await client.get(url, headers=auth_headers(user))).json()["data"]["previewIsStale"]
    await client.post(f"{url}/preview", headers=auth_headers(user))
    next_id = await claim_next(db_session)
    await process_reel(
        next_id, b2=b2, session_factory=SessionFactory(db_session), renderer=_render_ok
    )
    assert b2.deleted == [key]


async def test_preview_and_bought_video_keep_their_own_files(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session)
    url = f"/v1/events/{event.id}/reel"
    await client.post(url, headers=auth_headers(user))
    await client.post(f"{url}/preview", headers=auth_headers(user))  # both may run at once
    for _ in range(2):
        reel_id = await claim_next(db_session)
        await process_reel(
            reel_id, b2=b2, session_factory=SessionFactory(db_session), renderer=_render_ok
        )
    state = (await client.get(url, headers=auth_headers(user))).json()["data"]
    assert state["downloadUrl"] and state["previewUrl"]
    assert state["downloadUrl"] != state["previewUrl"]
    assert b2.deleted == []


async def test_archived_invitation_gets_no_preview(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session, status=EventStatus.ARCHIVED, paid=False)
    refused = await client.post(f"/v1/events/{event.id}/reel/preview", headers=auth_headers(user))
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "EVENT_ARCHIVED"


async def test_preview_has_its_own_daily_limit(client, db_session, auth_headers, b2, monkeypatch):
    monkeypatch.setattr(get_settings(), "reel_preview_daily_limit", 1)
    monkeypatch.setattr(get_settings(), "reel_daily_limit", 0)
    event, user = await _invitation(db_session, paid=False)
    url = f"/v1/events/{event.id}/reel/preview"
    assert (await client.post(url, headers=auth_headers(user))).status_code == 202
    reel = (await db_session.execute(select(EventReel))).scalar_one()
    reel.status = ReelStatus.READY
    await db_session.commit()
    draft = (await db_session.execute(select(Draft))).scalar_one()
    draft.revision = 2
    await db_session.commit()
    refused = await client.post(url, headers=auth_headers(user))
    assert refused.status_code == 429
    assert "previews" in refused.json()["error"]["message"]


async def test_each_publish_remakes_a_bought_video(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session)
    publish = f"/v1/events/{event.id}/publish"
    assert (await client.post(publish, headers=auth_headers(user))).status_code == 200
    reel_id = await claim_next(db_session)
    assert reel_id is not None
    reel = await db_session.get(EventReel, reel_id)
    assert reel is not None and reel.kind == ReelKind.FULL
    await process_reel(
        reel_id, b2=b2, session_factory=SessionFactory(db_session), renderer=_render_ok
    )

    # Publishing again without changes makes nothing; after a change, a new video.
    await client.post(publish, headers=auth_headers(user))
    assert await claim_next(db_session) is None
    draft = (await db_session.execute(select(Draft))).scalar_one()
    draft.revision = 2
    await db_session.commit()
    await client.post(publish, headers=auth_headers(user))
    assert await claim_next(db_session) is not None


async def test_publish_makes_no_video_that_was_not_bought(client, db_session, auth_headers, b2):
    event, user = await _invitation(db_session, paid=False)
    await _pay(db_session, event, video=False)
    await db_session.commit()
    assert (
        await client.post(f"/v1/events/{event.id}/publish", headers=auth_headers(user))
    ).status_code == 200
    assert (await db_session.execute(select(EventReel))).scalars().all() == []
