from __future__ import annotations

import asyncio
import random
import re
import string
import unicodedata
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.drafts.models import Draft
from app.events.models import Event, EventStatus, EventType
from app.events.schemas import EventCreate, EventUpdate
from app.payments.pricing import get_template_price, has_paid_payment
from app.shared.audit import log_action
from app.shared.authorization import ensure_owner_or_admin
from app.shared.database import _session_factory
from app.shared.errors import (
    ConflictError,
    NotFoundError,
    PaymentRequiredError,
    ValidationFailedError,
)
from app.shared.pagination import Page, PageParams, make_page
from app.templates.models import Template
from app.users.models import User, UserRole

_SLUG_SUFFIX_ALPHABET = string.ascii_lowercase + string.digits
_SLUG_CREATE_ATTEMPTS = 5


def _slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.strip().lower()).strip("-")
    return slug or "event"


def _random_suffix(length: int = 6) -> str:
    return "".join(random.choices(_SLUG_SUFFIX_ALPHABET, k=length))


# ---------------------------------------------------------------------------
# Published links. A draft keeps the random link it was created with; on first
# publish it gets a readable one from the couple's names — `arjun-and-priya-k7x2`.
# The code is always added (not only on a clash) so a couple's link can't be
# guessed from their names, and so there's no counting `-2`, `-3`… to walk
# through other couples' invitations.
# ---------------------------------------------------------------------------

_PUBLISHED_CODE_LENGTH = 4
_PUBLISHED_SLUG_ATTEMPTS = 8
# Name fields, most preferred first: a first-name field when the template has
# one (Temple Bells' `groomShort`), else the name field every template has.
_GROOM_KEYS = ("groomShort", "groomName")
_BRIDE_KEYS = ("brideShort", "brideName")


def _find_name(data: dict[str, Any], keys: tuple[str, ...]) -> str:
    """The first non-empty value for any of `keys` in any section of draft data."""
    for key in keys:
        for section in data.values():
            if isinstance(section, dict):
                value = section.get(key)
                if isinstance(value, str) and value.strip():
                    return value
    return ""


def _name_part(name: str) -> str:
    """First name as ASCII slug text: "Zoë Mehra" → "zoe". Names written only in
    a non-Latin script (e.g. Devanagari) have no ASCII form and give ""."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    words = re.findall(r"[a-z0-9]+", ascii_name.lower())
    return words[0][:24] if words else ""


def published_slug_base(data: dict[str, Any]) -> str | None:
    """`arjun-and-priya` from a draft's couple names, or None without both."""
    groom = _name_part(_find_name(data, _GROOM_KEYS))
    bride = _name_part(_find_name(data, _BRIDE_KEYS))
    if not groom or not bride:
        return None
    return f"{groom}-and-{bride}"


def _is_draft_slug(event: Event) -> bool:
    """Still the random link from creation (`{title}-xxxxxx`)? Published links
    are never renamed again."""
    prefix = _slugify(event.title)[:140] + "-"
    suffix = event.slug[len(prefix) :]
    return event.slug.startswith(prefix) and len(suffix) == 6 and suffix.isalnum()


async def assign_published_slug(db: AsyncSession, event: Event) -> None:
    """On first publish, swap the event's random draft link for a readable one.
    Keeps the current link when the draft has no usable names, or if every
    attempt is taken (practically impossible with ~1.7M codes per name pair).
    Call before committing the publish."""
    if not _is_draft_slug(event):
        return
    draft = (await db.execute(select(Draft).where(Draft.event_id == event.id))).scalar_one_or_none()
    base = published_slug_base(draft.data if draft else {})
    if base is None:
        return
    for _ in range(_PUBLISHED_SLUG_ATTEMPTS):
        candidate = f"{base}-{_random_suffix(_PUBLISHED_CODE_LENGTH)}"
        # Checked first so a clash just picks another code; the unique index on
        # events.slug remains the last-resort guard.
        taken = await db.scalar(select(func.count()).where(Event.slug == candidate))
        if not taken:
            event.slug = candidate
            return


async def create_event(db: AsyncSession, owner: User, data: EventCreate) -> Event:
    """Create an event and its 1:1 draft in a single transaction — or, for a
    template-backed event, return the existing one.

    `title` doubles as the template slot id for events created from the editor
    (e.g. 'tpl-samarpan-royal' — see `resolve_event_template`), and a user editing
    the same template should only ever have one active (non-archived) draft for
    it: reopening the editor, a second tab, or a cleared localStorage cache must
    resume that draft, not fork a new one. Checked up front so the common case
    (no duplicate) never pays for a wasted slug/draft insert; `ix_events_owner_title_active`
    is the last-resort guard if two requests for the same new template race each other —
    caught below and resolved the same way, by adopting the winner instead of erroring.

    Slugs are generated from the title plus a short random suffix; on a slug collision
    (another event already took that exact slug) we retry with a fresh suffix a few
    times before giving up.
    """
    # Captured once: `db.rollback()` below expires every attribute on every ORM object
    # attached to this session, `owner` included, regardless of `expire_on_commit`. Reading
    # `owner.id` again after that triggers SQLAlchemy to lazily re-fetch it — a sync-style
    # load attempted outside an awaited query, which raised MissingGreenlet under
    # concurrent load. `owner_id` is a plain value; it can't expire.
    owner_id = owner.id

    existing = await _find_active_event(db, owner_id, data.title)
    if existing is not None:
        return existing

    base_slug = _slugify(data.title)[:140]

    last_error: IntegrityError | None = None
    for _ in range(_SLUG_CREATE_ATTEMPTS):
        slug = f"{base_slug}-{_random_suffix()}"[:160]
        event = Event(owner_id=owner_id, type=data.type, title=data.title, slug=slug)
        db.add(event)
        try:
            await db.flush()
        except IntegrityError as exc:
            last_error = exc
            await db.rollback()
            # Either the random slug collided (retry below) or a concurrent request for
            # this same (owner, title) won the race — tell them apart directly rather
            # than guessing from the error.
            winner = await _await_active_event(owner_id, data.title)
            if winner is not None:
                return winner
            continue

        db.add(Draft(event_id=event.id, data={}, revision=0))
        await log_action(
            db,
            action="EVENT_CREATED",
            resource_type="event",
            resource_id=event.id,
            actor_user_id=owner_id,
        )
        await db.commit()
        await db.refresh(event)
        return event

    assert last_error is not None
    if data.title.startswith("tpl-"):
        # Every attempt hit the (owner, title) conflict and never found the winner row —
        # pathological (contended enough that its commit never became visible within our
        # poll budget), but a clean 409 beats a raw IntegrityError reaching the client.
        raise ConflictError(
            "EVENT_ALREADY_EXISTS",
            "You already have an active draft for this template.",
            details={"title": data.title},
        )
    raise last_error


async def _find_active_event(db: AsyncSession, owner_id: uuid.UUID, title: str) -> Event | None:
    """The owner's non-archived event for this template slot id, if any — see
    `ix_events_owner_title_active`. Only template-backed titles ('tpl-*') are deduped;
    this app has no other event-creation path today, but scoping it keeps a future
    freeform-titled event (e.g. two same-named birthday parties) from colliding here.
    """
    if not title.startswith("tpl-"):
        return None
    result = await db.execute(
        select(Event).where(
            Event.owner_id == owner_id,
            Event.title == title,
            Event.status != EventStatus.ARCHIVED,
        )
    )
    return result.scalar_one_or_none()


_WINNER_POLL_ATTEMPTS = 5
_WINNER_POLL_DELAY_S = 0.05


async def _await_active_event(owner_id: uuid.UUID, title: str) -> Event | None:
    """After our own insert lost a race on `ix_events_owner_title_active`, the winning
    request's row exists but may not be visible yet — under READ COMMITTED it only
    becomes visible once that request's transaction *commits*, which happens a few
    statements (and an audit-log insert) after the point our insert collided with it.
    Polls briefly rather than looking once. A fresh session per attempt, since the
    caller's `db` just rolled back and is mid-retry — no need to hold its connection
    idle across a wait it doesn't otherwise need."""
    for attempt in range(_WINNER_POLL_ATTEMPTS):
        async with _session_factory() as lookup_db:
            winner = await _find_active_event(lookup_db, owner_id, title)
        if winner is not None:
            return winner
        if attempt < _WINNER_POLL_ATTEMPTS - 1:
            await asyncio.sleep(_WINNER_POLL_DELAY_S)
    return None


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
    ensure_owner_or_admin(
        current_user,
        event.owner_id,
        not_found_code="EVENT_NOT_FOUND",
        not_found_message="Event not found.",
    )
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


async def get_event_by_slug(db: AsyncSession, slug: str) -> Event | None:
    """Fetch an event by its public slug — no auth check, caller decides access."""
    result = await db.execute(select(Event).where(Event.slug == slug))
    return result.scalar_one_or_none()


async def resolve_event_template(db: AsyncSession, event: Event) -> Template | None:
    """Find the template an event is built on.

    Falls back to the event title because HttpTemplateRepository creates events with the
    template slot id (== template slug, e.g. 'tpl-samarpan-royal') as the title.
    """
    if event.template_id:
        template = await db.get(Template, event.template_id)
        if template:
            return template

    draft = (await db.execute(select(Draft).where(Draft.event_id == event.id))).scalar_one_or_none()
    if draft and draft.template_id:
        template = await db.get(Template, draft.template_id)
        if template:
            return template

    if event.title and event.title.startswith("tpl-"):
        return (
            await db.execute(select(Template).where(Template.slug == event.title))
        ).scalar_one_or_none()
    return None


async def publish_event(db: AsyncSession, event_id: uuid.UUID, current_user: User) -> Event:
    """Transition a DRAFT event to PUBLISHED — makes it publicly visible.

    Events on a PAID template need a PAID payment first (admins are exempt).
    """
    event = await get_event(db, event_id, current_user)
    if event.status == EventStatus.ARCHIVED:
        raise ValidationFailedError("An archived event cannot be published.")
    if event.status == EventStatus.PUBLISHED:
        return event

    if current_user.role != UserRole.ADMIN:
        template = await resolve_event_template(db, event)
        if template is not None:
            price = await get_template_price(db, template)
            if not price.is_free and not await has_paid_payment(db, event.id):
                raise PaymentRequiredError(price.amount_minor, price.currency)

    event.status = EventStatus.PUBLISHED
    await assign_published_slug(db, event)
    await log_action(
        db,
        action="EVENT_PUBLISHED",
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
