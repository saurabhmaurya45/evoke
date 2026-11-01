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
from app.payments.pricing import has_paid_payment
from app.reels.models import EventReel, ReelStatus
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
    db: AsyncSession, event_id: uuid.UUID, *conditions: Any
) -> EventReel | None:
    result = await db.execute(
        select(EventReel)
        .where(EventReel.event_id == event_id, *conditions)
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


async def get_reel(
    db: AsyncSession, b2: B2Client | None, event_id: uuid.UUID, current_user: User
) -> ReelOut:
    event = await get_event(db, event_id, current_user)
    slot_id = await _template_slot_id(db, event)
    if (
        not get_settings().reels_enabled
        or b2 is None
        or event.status != EventStatus.PUBLISHED
        or slot_id not in REEL_FILMS
        or not await has_paid_payment(db, event.id)
    ):
        return ReelOut(available=False)

    latest = await _latest(db, event.id)
    finished = await _latest(db, event.id, EventReel.storage_path.is_not(None))
    draft = await _get_draft(db, event.id)
    return ReelOut(
        available=True,
        status=latest.status if latest else None,
        progress=latest.progress if latest else 0,
        download_url=(
            b2.get_url(finished.storage_path, _DOWNLOAD_URL_TTL_SECONDS)
            if finished and finished.storage_path
            else None
        ),
        size_bytes=finished.size_bytes if finished else None,
        is_stale=bool(finished and draft and finished.draft_revision != draft.revision),
    )


async def _check_daily_limit(db: AsyncSession, user: User) -> None:
    """A render ties up a worker for minutes, so requests are capped per user. Failed
    renders don't count: those are our failure, and retrying must stay possible."""
    if user.role == UserRole.ADMIN:
        return
    limit = get_settings().reel_daily_limit
    used = await db.scalar(
        select(func.count())
        .select_from(EventReel)
        .where(
            EventReel.requested_by_user_id == user.id,
            EventReel.status != ReelStatus.FAILED,
            EventReel.created_at > datetime.now(UTC) - timedelta(hours=24),
        )
    )
    if (used or 0) >= limit:
        raise AppError(
            "REEL_DAILY_LIMIT",
            f"You can create up to {limit} videos a day. Please try again tomorrow.",
            status.HTTP_429_TOO_MANY_REQUESTS,
            {"limit": limit},
        )


async def request_reel(
    db: AsyncSession, b2: B2Client | None, event_id: uuid.UUID, current_user: User
) -> ReelOut:
    """Queue a render, unless one is running or the current video is already up to date."""
    # Plain values: a rollback below expires the ORM objects' attributes.
    user_id = current_user.id
    event = await get_event(db, event_id, current_user)

    if not get_settings().reels_enabled:
        raise AppError(
            "REELS_DISABLED",
            "Video creation isn't switched on yet.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    require_client(b2)
    if event.status != EventStatus.PUBLISHED:
        raise ConflictError(
            "EVENT_NOT_PUBLISHED", "Publish the invitation before creating its video."
        )
    # Videos are for paid invitations only, with no exemption for admins or free templates.
    if not await has_paid_payment(db, event.id):
        raise AppError(
            "REEL_PAYMENT_REQUIRED",
            "Videos are available once payment for this invitation is complete.",
            status.HTTP_402_PAYMENT_REQUIRED,
        )
    slot_id = await _template_slot_id(db, event)
    required = REEL_FILMS.get(slot_id) if slot_id else None
    if required is None:
        raise ConflictError(
            "REEL_NOT_AVAILABLE", "Videos aren't available for this template yet."
        )

    draft = await _get_draft(db, event.id)
    data = draft.data if draft else {}
    missing = _missing_details(data, required)
    if draft is None or missing:
        raise ValidationFailedError(
            f"Fill in these details before creating the video: {', '.join(missing)}.",
            details={"fields": missing},
        )

    if await _latest(db, event.id, EventReel.status.in_(_ACTIVE_STATUSES)) is None:
        latest = await _latest(db, event.id)
        up_to_date = (
            latest is not None
            and latest.status == ReelStatus.READY
            and latest.draft_revision == draft.revision
        )
        if not up_to_date:
            await _check_daily_limit(db, current_user)
            db.add(
                EventReel(
                    event_id=event.id,
                    requested_by_user_id=user_id,
                    template_slot_id=slot_id,
                    draft_revision=draft.revision,
                )
            )
            await log_action(
                db,
                action="REEL_REQUESTED",
                resource_type="event",
                resource_id=event.id,
                actor_user_id=user_id,
            )
            try:
                await db.commit()
            except IntegrityError:
                # A concurrent request queued one first, which is what was wanted.
                await db.rollback()

    return await get_reel(db, b2, event_id, current_user)
