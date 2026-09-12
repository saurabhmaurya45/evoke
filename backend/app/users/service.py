import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.models import Event
from app.shared.audit import log_action
from app.shared.auth.identity_provider import TokenIdentity
from app.shared.pagination import Page, PageParams, make_page
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

    items = [
        UserSiteOut(
            id=event.id,
            type=event.type,
            title=event.title,
            slug=event.slug,
            status=event.status,
            template_id=event.template_id,
            created_at=event.created_at,
            updated_at=event.updated_at,
        )
        for event in events
    ]
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
