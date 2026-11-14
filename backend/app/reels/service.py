import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.drafts.models import Draft
from app.events.models import Event, EventStatus
from app.events.service import get_event, resolve_event_template
from app.payments.pricing import event_video_price, has_paid_video
from app.reels.models import EventReel, ReelKind, ReelStatus
from app.reels.schemas import ReelOut
from app.shared.audit import log_action
from app.shared.errors import AppError, ConflictError, ValidationFailedError
from app.shared.storage.b2_client import B2Client, require_client
from app.users.models import User, UserRole

# Templates with a film in tools/reel/templates/, each with the details its film can't
# go without (meta.json's `required`). The API runs on Vercel without that folder, so
# they are listed here; tests/test_reels.py fails if this falls out of step with it.
REEL_FILMS: dict[str, tuple[str, ...]] = {
    "tpl-ayodhya-royal": ("couple.groomName", "couple.brideName"),
    "tpl-lace-classic": ("couple.brideName", "couple.groomName"),
    "tpl-samarpan-royal": ("hero.brideName", "hero.groomName"),
    "tpl-eternal-bond": ("hero.groomName", "hero.brideName"),
    "tpl-beloved-nikkah": ("couple.groomName", "couple.brideName"),
    "tpl-rosewood-punjabi": ("couple.groomName", "couple.brideName"),
    "tpl-maroon-gold-royal": ("hero.groomName", "hero.brideName"),
    "tpl-doorway-modern": ("couple.groomName", "couple.brideName"),
    "tpl-golden-promise": ("family.brideName", "family.groomName"),
    "tpl-royal-gate": ("couple.groomName", "couple.brideName"),
    "tpl-chateau-classic": ("couple.groomName", "couple.brideName"),
    "tpl-temple-bells": ("couple.groomName", "couple.brideName"),
    "tpl-embroidered-garden": ("couple.brideName", "couple.groomName"),
}

_ACTIVE_STATUSES = (ReelStatus.QUEUED, ReelStatus.RENDERING)
_DOWNLOAD_URL_TTL_SECONDS = 60 * 60


async def _template_slot_id(db: AsyncSession, event: Event) -> str | None:
    template = await resolve_event_template(db, event)
    if template is not None:
        return template.slug
    return event.title if event.title.startswith("tpl-") else None


async def _get_draft(db: AsyncSession, event_id: uuid.UUID) -> Draft | None:
    result = await db.execute(select(Draft).where(Draft.event_id == event_id))
    return result.scalar_one_or_none()


async def _latest(
    db: AsyncSession, event_id: uuid.UUID, kind: ReelKind, *conditions: Any
) -> EventReel | None:
    result = await db.execute(
        select(EventReel)
        .where(EventReel.event_id == event_id, EventReel.kind == kind, *conditions)
        .order_by(EventReel.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _missing_details(data: dict[str, Any], required: tuple[str, ...]) -> list[str]:
    def value_at(path: str) -> Any:
        value: Any = data
        for key in path.split("."):
            value = value.get(key) if isinstance(value, dict) else None
        return value

    return [path for path in required if not str(value_at(path) or "").strip()]


async def video_offered(db: AsyncSession, event: Event, b2: B2Client | None = None) -> bool:
    """Whether this invitation can have a video at all: videos are switched on and its
    template has a film. Says nothing about whether it was bought."""
    if not get_settings().reels_enabled or event.status == EventStatus.ARCHIVED:
        return False
    return await _template_slot_id(db, event) in REEL_FILMS


async def get_reel(
    db: AsyncSession, b2: B2Client | None, event_id: uuid.UUID, current_user: User
) -> ReelOut:
    event = await get_event(db, event_id, current_user)
    price = await event_video_price(db, await resolve_event_template(db, event))
    if b2 is None or not await video_offered(db, event):
        return ReelOut(available=False, price_minor=price.amount_minor, currency=price.currency)

    draft = await _get_draft(db, event.id)
    revision = draft.revision if draft else None
    purchased = await has_paid_video(db, event.id)

    preview = await _latest(db, event.id, ReelKind.PREVIEW)
    preview_done = await _latest(
        db, event.id, ReelKind.PREVIEW, EventReel.storage_path.is_not(None)
    )
    out = ReelOut(
        available=True,
        purchased=purchased,
        price_minor=price.amount_minor,
        currency=price.currency,
        preview_status=preview.status if preview else None,
        preview_progress=preview.progress if preview else 0,
        preview_url=(
            b2.get_url(preview_done.storage_path, _DOWNLOAD_URL_TTL_SECONDS)
            if preview_done and preview_done.storage_path
            else None
        ),
        preview_is_stale=bool(preview_done and preview_done.draft_revision != revision),
    )
    if not purchased:
        return out

    latest = await _latest(db, event.id, ReelKind.FULL)
    finished = await _latest(db, event.id, ReelKind.FULL, EventReel.storage_path.is_not(None))
    out.status = latest.status if latest else None
    out.progress = latest.progress if latest else 0
    out.download_url = (
        b2.get_url(finished.storage_path, _DOWNLOAD_URL_TTL_SECONDS)
        if finished and finished.storage_path
        else None
    )
    out.size_bytes = finished.size_bytes if finished else None
    out.is_stale = bool(finished and finished.draft_revision != revision)
    return out


async def _check_daily_limit(db: AsyncSession, user: User, kind: ReelKind) -> None:
    """A render ties up a worker for minutes, so requests are capped per user. Failed
    renders don't count: those are our failure, and retrying must stay possible."""
    if user.role == UserRole.ADMIN:
        return
    settings = get_settings()
    limit = (
        settings.reel_preview_daily_limit if kind == ReelKind.PREVIEW else settings.reel_daily_limit
    )
    used = await db.scalar(
        select(func.count())
        .select_from(EventReel)
        .where(
            EventReel.requested_by_user_id == user.id,
            EventReel.kind == kind,
            EventReel.status != ReelStatus.FAILED,
            EventReel.created_at > datetime.now(UTC) - timedelta(hours=24),
        )
    )
    if (used or 0) >= limit:
        noun = "previews" if kind == ReelKind.PREVIEW else "videos"
        raise AppError(
            "REEL_DAILY_LIMIT",
            f"You can create up to {limit} {noun} a day. Please try again tomorrow.",
            status.HTTP_429_TOO_MANY_REQUESTS,
            {"limit": limit},
        )


async def _needs_render(
    db: AsyncSession, event_id: uuid.UUID, kind: ReelKind, revision: int
) -> bool:
    """False while a render of this kind runs, or when the newest one shows this revision."""
    if await _latest(db, event_id, kind, EventReel.status.in_(_ACTIVE_STATUSES)) is not None:
        return False
    latest = await _latest(db, event_id, kind)
    return not (
        latest is not None
        and latest.status == ReelStatus.READY
        and latest.draft_revision == revision
    )


def _queue(
    db: AsyncSession,
    event: Event,
    user_id: uuid.UUID,
    slot_id: str,
    kind: ReelKind,
    revision: int,
) -> None:
    db.add(
        EventReel(
            event_id=event.id,
            requested_by_user_id=user_id,
            template_slot_id=slot_id,
            kind=kind,
            draft_revision=revision,
        )
    )


async def _checked_film(db: AsyncSession, event: Event) -> tuple[str, Draft]:
    """The invitation's film and saved details, or the reason it can't be filmed."""
    slot_id = await _template_slot_id(db, event)
    required = REEL_FILMS.get(slot_id) if slot_id else None
    if required is None or slot_id is None:
        raise ConflictError("REEL_NOT_AVAILABLE", "Videos aren't available for this template yet.")
    draft = await _get_draft(db, event.id)
    missing = _missing_details(draft.data if draft else {}, required)
    if draft is None or missing:
        raise ValidationFailedError(
            f"Fill in these details before creating the video: {', '.join(missing)}.",
            details={"fields": missing},
        )
    return slot_id, draft


def _require_enabled(b2: B2Client | None) -> None:
    if not get_settings().reels_enabled:
        raise AppError(
            "REELS_DISABLED",
            "Video creation isn't switched on yet.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    require_client(b2)


async def _commit_queued(db: AsyncSession) -> None:
    try:
        await db.commit()
    except IntegrityError:
        # A concurrent request queued one first, which is what was wanted.
        await db.rollback()


async def request_preview(
    db: AsyncSession, b2: B2Client | None, event_id: uuid.UUID, current_user: User
) -> ReelOut:
    """Queue a watermarked preview of the invitation's video, unless one is running or the
    newest preview already shows the latest details. Works before anything is paid."""
    user_id = current_user.id
    event = await get_event(db, event_id, current_user)
    _require_enabled(b2)
    if event.status == EventStatus.ARCHIVED:
        raise ConflictError("EVENT_ARCHIVED", "An archived invitation can't have a video.")
    slot_id, draft = await _checked_film(db, event)

    if await _needs_render(db, event.id, ReelKind.PREVIEW, draft.revision):
        await _check_daily_limit(db, current_user, ReelKind.PREVIEW)
        _queue(db, event, user_id, slot_id, ReelKind.PREVIEW, draft.revision)
        await log_action(
            db,
            action="REEL_PREVIEW_REQUESTED",
            resource_type="event",
            resource_id=event.id,
            actor_user_id=user_id,
        )
        await _commit_queued(db)
    return await get_reel(db, b2, event_id, current_user)


async def request_reel(
    db: AsyncSession, b2: B2Client | None, event_id: uuid.UUID, current_user: User
) -> ReelOut:
    """Queue the bought video, unless one is running or the current video is already up to date.
    Videos are normally made on their own when the invitation is published; this is for retrying."""
    user_id = current_user.id
    event = await get_event(db, event_id, current_user)
    _require_enabled(b2)
    if event.status != EventStatus.PUBLISHED:
        raise ConflictError(
            "EVENT_NOT_PUBLISHED", "Publish the invitation before creating its video."
        )
    # No exemption for admins: the video is bought on its own.
    if not await has_paid_video(db, event.id):
        raise AppError(
            "REEL_PAYMENT_REQUIRED",
            "Buy the video to download it without the watermark.",
            status.HTTP_402_PAYMENT_REQUIRED,
        )
    slot_id, draft = await _checked_film(db, event)

    if await _needs_render(db, event.id, ReelKind.FULL, draft.revision):
        await _check_daily_limit(db, current_user, ReelKind.FULL)
        _queue(db, event, user_id, slot_id, ReelKind.FULL, draft.revision)
        await log_action(
            db,
            action="REEL_REQUESTED",
            resource_type="event",
            resource_id=event.id,
            actor_user_id=user_id,
        )
        await _commit_queued(db)
    return await get_reel(db, b2, event_id, current_user)


async def queue_video_on_publish(db: AsyncSession, event: Event, user_id: uuid.UUID) -> bool:
    """Called each time the invitation is published (and when its video is paid for): if the
    video was bought, makes a new one from the latest details. The caller commits.

    Never fails the publish or the payment it is part of: when the video can't be made
    (details missing, videos switched off), the owner sees that on the video itself.
    """
    if event.status != EventStatus.PUBLISHED or not await video_offered(db, event):
        return False
    if not await has_paid_video(db, event.id):
        return False
    try:
        slot_id, draft = await _checked_film(db, event)
    except (ConflictError, ValidationFailedError):
        return False
    if not await _needs_render(db, event.id, ReelKind.FULL, draft.revision):
        return False
    try:
        # A savepoint, so a render queued by a concurrent request can't undo the caller's work.
        async with db.begin_nested():
            _queue(db, event, user_id, slot_id, ReelKind.FULL, draft.revision)
            await db.flush()
    except IntegrityError:
        return False
    await log_action(
        db,
        action="REEL_REQUESTED",
        resource_type="event",
        resource_id=event.id,
        actor_user_id=user_id,
        metadata={"reason": "published"},
    )
    return True
