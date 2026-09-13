import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.drafts.models import Draft
from app.events.models import Event
from app.shared.audit import log_action
from app.shared.auth.identity_provider import TokenIdentity
from app.shared.pagination import Page, PageParams, make_page
from app.templates.models import Template
from app.users.models import User
from app.users.schemas import UserProfileUpdate, UserSiteOut


async def get_or_provision_user(db: AsyncSession, identity: TokenIdentity) -> User:
    """Find the application user for this identity, provisioning one on first login.

    Keyed on `auth_user_id`, never email — email can change on the identity provider
    side without breaking the relationship to business data.
    """
    auth_user_id = uuid.UUID(identity.auth_user_id)
    existing = await _find_by_auth_user_id(db, auth_user_id)
    if existing is not None:
        return existing

    user = User(auth_user_id=auth_user_id, email=identity.email or "")
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        # Lost a provisioning race to a concurrent request for the same identity.
        await db.rollback()
        existing = await _find_by_auth_user_id(db, auth_user_id)
        if existing is None:
            raise
        return existing

    await log_action(db, action="USER_CREATED", resource_type="user", resource_id=user.id)
    await db.commit()
    await db.refresh(user)
    return user


async def _find_by_auth_user_id(db: AsyncSession, auth_user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.auth_user_id == auth_user_id))
    return result.scalar_one_or_none()


async def list_my_sites(db: AsyncSession, user: User, params: PageParams) -> Page[UserSiteOut]:
    filters = [Event.owner_id == user.id]

    total = (await db.execute(select(func.count()).select_from(Event).where(*filters))).scalar_one()

    stmt = (
        select(Event)
        .where(*filters)
        .order_by(Event.created_at.desc())
        .offset((params.page - 1) * params.page_size)
        .limit(params.page_size)
    )
    events = list((await db.execute(stmt)).scalars().all())

    # Resolve template_slot_id for each event: prefer the draft's linked template
    # slug (authoritative), fall back to event.title when it looks like a slot id.
    event_ids = [e.id for e in events]
    drafts_by_event: dict[uuid.UUID, Draft] = {}
    if event_ids:
        draft_rows = (await db.execute(select(Draft).where(Draft.event_id.in_(event_ids)))).scalars().all()
        drafts_by_event = {d.event_id: d for d in draft_rows}

    template_slugs: dict[uuid.UUID, str] = {}
    template_ids = {d.template_id for d in drafts_by_event.values() if d.template_id}
    if template_ids:
        tpl_rows = (await db.execute(select(Template).where(Template.id.in_(template_ids)))).scalars().all()
        template_slugs = {t.id: t.slug for t in tpl_rows}

    items = []
    for event in events:
        draft = drafts_by_event.get(event.id)
        slot_id: str | None = None
        if draft and draft.template_id and draft.template_id in template_slugs:
            slot_id = template_slugs[draft.template_id]
        elif event.title and event.title.startswith("tpl-"):
            slot_id = event.title
        items.append(UserSiteOut(
            id=event.id,
            type=event.type,
            title=event.title,
            slug=event.slug,
            status=event.status,
            template_id=event.template_id,
            template_slot_id=slot_id,
            created_at=event.created_at,
            updated_at=event.updated_at,
        ))
    return make_page(items, total, params)


async def update_profile(db: AsyncSession, user: User, update: UserProfileUpdate) -> User:
    changes = update.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(user, field, value)
    if changes and not user.profile_completed and user.first_name and user.last_name:
        user.profile_completed = True
    await db.commit()
    await db.refresh(user)
    return user
