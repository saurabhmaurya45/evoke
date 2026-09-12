from __future__ import annotations

import random
import re
import string
import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.drafts.models import Draft
from app.events.models import Event, EventStatus, EventType
from app.events.schemas import EventCreate, EventUpdate
from app.shared.audit import log_action
from app.shared.authorization import ensure_owner_or_admin
from app.shared.errors import NotFoundError
from app.shared.pagination import Page, PageParams, make_page
from app.users.models import User

_SLUG_SUFFIX_ALPHABET = string.ascii_lowercase + string.digits
_SLUG_CREATE_ATTEMPTS = 5


def _slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.strip().lower()).strip("-")
    return slug or "event"


def _random_suffix(length: int = 6) -> str:
    return "".join(random.choices(_SLUG_SUFFIX_ALPHABET, k=length))


async def create_event(db: AsyncSession, owner: User, data: EventCreate) -> Event:
    """Create an event and its 1:1 draft in a single transaction.

    Slugs are generated from the title plus a short random suffix; on the rare
    collision (another event already took that exact slug) we retry with a fresh
    suffix a few times before giving up.
    """
    base_slug = _slugify(data.title)[:140]

    last_error: IntegrityError | None = None
    for _ in range(_SLUG_CREATE_ATTEMPTS):
        slug = f"{base_slug}-{_random_suffix()}"[:160]
        event = Event(owner_id=owner.id, type=data.type, title=data.title, slug=slug)
        db.add(event)
        try:
            await db.flush()
        except IntegrityError as exc:
            last_error = exc
            await db.rollback()
            continue

        db.add(Draft(event_id=event.id, data={}, revision=0))
        await log_action(
            db,
            action="EVENT_CREATED",
            resource_type="event",
            resource_id=event.id,
            actor_user_id=owner.id,
        )
        await db.commit()
        await db.refresh(event)
        return event

    assert last_error is not None
    raise last_error


async def list_events(
    db: AsyncSession,
    owner: User,
    params: PageParams,
    *,
    status: EventStatus | None = None,
    type: EventType | None = None,
) -> Page[Event]:
    """Always scoped to the owner — no cross-user/admin listing in this pass."""
    filters = [Event.owner_id == owner.id]
    if status is not None:
        filters.append(Event.status == status)
    if type is not None:
        filters.append(Event.type == type)

    total = (await db.execute(select(func.count()).select_from(Event).where(*filters))).scalar_one()

    stmt = (
        select(Event)
        .where(*filters)
        .order_by(Event.created_at.desc())
        .offset((params.page - 1) * params.page_size)
        .limit(params.page_size)
    )
    items = list((await db.execute(stmt)).scalars().all())
    return make_page(items, total, params)


async def get_event(db: AsyncSession, event_id: uuid.UUID, current_user: User) -> Event:
    event = await db.get(Event, event_id)
    if event is None:
        raise NotFoundError("EVENT_NOT_FOUND", "Event not found.")
    ensure_owner_or_admin(current_user, event.owner_id)
    return event


async def update_event(
    db: AsyncSession, event_id: uuid.UUID, current_user: User, data: EventUpdate
) -> Event:
    event = await get_event(db, event_id, current_user)
    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(event, field, value)
    if changes:
        await log_action(
            db,
            action="EVENT_UPDATED",
            resource_type="event",
            resource_id=event.id,
            actor_user_id=current_user.id,
        )
    await db.commit()
    await db.refresh(event)
    return event


async def archive_event(db: AsyncSession, event_id: uuid.UUID, current_user: User) -> Event:
    """Soft delete: sets status=ARCHIVED. There is no hard row delete for events."""
    event = await get_event(db, event_id, current_user)
    event.status = EventStatus.ARCHIVED
    await log_action(
        db,
        action="EVENT_ARCHIVED",
        resource_type="event",
        resource_id=event.id,
        actor_user_id=current_user.id,
    )
    await db.commit()
    await db.refresh(event)
    return event
