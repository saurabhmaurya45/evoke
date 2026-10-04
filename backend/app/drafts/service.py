import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.drafts.models import Draft
from app.drafts.schemas import DraftUpdate
from app.events.models import Event
from app.media.service import ensure_event_media, to_storage_refs
from app.shared.authorization import ensure_owner_or_admin
from app.shared.errors import ConflictError, NotFoundError
from app.shared.storage.b2_client import B2Client
from app.users.models import User


async def _get_event_or_404(db: AsyncSession, event_id: uuid.UUID) -> Event:
    event = await db.get(Event, event_id)
    if event is None:
        raise NotFoundError("EVENT_NOT_FOUND", "Event not found.")
    return event


async def _get_draft_by_event_id(db: AsyncSession, event_id: uuid.UUID) -> Draft:
    result = await db.execute(select(Draft).where(Draft.event_id == event_id))
    draft = result.scalar_one_or_none()
    if draft is None:
        raise NotFoundError("DRAFT_NOT_FOUND", "Draft not found.")
    return draft


async def get_draft(db: AsyncSession, event_id: uuid.UUID, current_user: User) -> Draft:
    event = await _get_event_or_404(db, event_id)
    ensure_owner_or_admin(
        current_user,
        event.owner_id,
        not_found_code="DRAFT_NOT_FOUND",
        not_found_message="Draft not found.",
    )
    return await _get_draft_by_event_id(db, event_id)


async def save_draft(
    db: AsyncSession,
    event_id: uuid.UUID,
    current_user: User,
    update: DraftUpdate,
    b2: B2Client | None = None,
) -> Draft:
    event = await _get_event_or_404(db, event_id)
    ensure_owner_or_admin(
        current_user,
        event.owner_id,
        not_found_code="DRAFT_NOT_FOUND",
        not_found_message="Draft not found.",
    )
    draft = await _get_draft_by_event_id(db, event_id)

    if update.revision != draft.revision:
        raise ConflictError(
            "DRAFT_CONFLICT",
            "The draft was modified since you last loaded it.",
            details={"currentRevision": draft.revision},
        )

    # Clients send back the signed media URLs they loaded; store the paths, which
    # don't expire, and refuse uploads that belong to some other event.
    update.data = to_storage_refs(b2, update.data)
    ensure_event_media(update.data, event.owner_id, event.id)

    changes = update.model_dump(exclude_unset=True, exclude={"revision"})
    for field, value in changes.items():
        setattr(draft, field, value)
    draft.revision += 1

    # Deliberately no log_action here: autosave fires roughly every 800ms from the
    # frontend, and auditing every keystroke-adjacent save would flood audit_logs
    # with no real signal.
    await db.commit()
    await db.refresh(draft)
    return draft
