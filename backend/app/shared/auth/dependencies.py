from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.auth.identity_provider import IdentityProvider, InvalidTokenError
from app.shared.auth.supabase_identity_provider import get_identity_provider
from app.shared.database import get_db
from app.shared.errors import AuthForbiddenError, AuthRequiredError
from app.users.models import User, UserRole
from app.users.service import get_or_provision_user

# auto_error=False so the optional-auth dependency can fall back to None instead of
# FastAPI raising its own 403 before we get a chance to. Registering this as a real
# security scheme (rather than parsing the Authorization header by hand) is what
# makes Swagger UI show the padlock icon and "Authorize" button.
bearer_scheme = HTTPBearer(auto_error=False, description="Supabase-issued JWT access token.")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    identity_provider: IdentityProvider = Depends(get_identity_provider),
) -> User:
    """Resolve the authenticated application user for this request.

    Validates the bearer token via the `IdentityProvider` abstraction (never a
    provider-specific SDK call here), then looks up — lazily provisioning if this is
    the user's first authenticated request — the local `users` row keyed on
    `auth_user_id`. Never keys on email.
    """
    if credentials is None:
        raise AuthRequiredError()

    try:
        identity = await identity_provider.validate_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise AuthRequiredError(str(exc)) from exc

    return await get_or_provision_user(db, identity)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
    identity_provider: IdentityProvider = Depends(get_identity_provider),
) -> User | None:
    """Same token resolution as `get_current_user`, but returns None instead of
    raising when no bearer token is present (or it's invalid) — for endpoints that are
    public but behave differently for an authenticated (e.g. ADMIN) caller.
    """
    if credentials is None:
        return None

    try:
        identity = await identity_provider.validate_token(credentials.credentials)
    except InvalidTokenError:
        return None

    return await get_or_provision_user(db, identity)


def require_role(*roles: UserRole):
    """Dependency factory: only allow the given roles. Coarse RBAC only — resource
    ownership must still be checked separately (see `app.shared.authorization`)."""

    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise AuthForbiddenError("This action requires a different role.")
        return current_user

    return dependency
