from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class TokenIdentity:
    """The identity carried by a validated access token, independent of which
    identity provider issued it."""

    auth_user_id: str
    email: str | None
    claims: dict[str, Any]


class InvalidTokenError(Exception):
    pass


class IdentityProvider(Protocol):
    """Port for authentication token validation.

    The application must depend only on this interface, never on a specific provider's
    SDK or token format. `SupabaseIdentityProvider` is the initial adapter; a future
    `KeycloakIdentityProvider`, `Auth0IdentityProvider`, or `CognitoIdentityProvider`
    can replace it without changing any code that depends on `IdentityProvider`.
    """

    async def validate_token(self, token: str) -> TokenIdentity:
        """Validate a bearer access token and return the identity it carries.

        Raises `InvalidTokenError` if the token is missing, malformed, expired, or
        fails signature/issuer/audience validation.
        """
        ...
