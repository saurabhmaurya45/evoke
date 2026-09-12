import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.audit import log_action
from app.shared.auth.identity_provider import TokenIdentity
from app.users.models import User
from app.users.schemas import UserProfileUpdate


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


async def update_profile(db: AsyncSession, user: User, update: UserProfileUpdate) -> User:
    changes = update.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(user, field, value)
    if changes and not user.profile_completed and user.first_name and user.last_name:
        user.profile_completed = True
    await db.commit()
    await db.refresh(user)
    return user
