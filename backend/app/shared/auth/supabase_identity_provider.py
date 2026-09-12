import asyncio
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from app.config import Settings, get_settings
from app.shared.auth.identity_provider import IdentityProvider, InvalidTokenError, TokenIdentity


class SupabaseIdentityProvider(IdentityProvider):
    """Validates Supabase Auth access tokens.

    Supports both Supabase JWT signing modes:
    - Legacy shared HS256 secret (`SUPABASE_JWT_SECRET` set) — verified locally, no network call.
    - Asymmetric signing keys (secret unset) — verified against the project's JWKS endpoint,
      fetched once and cached by `PyJWKClient` rather than on every request.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._issuer = f"{self._settings.supabase_url}/auth/v1"
        self._jwks_client: PyJWKClient | None = None
        if not self._settings.supabase_jwt_secret:
            jwks_url = (
                self._settings.supabase_jwks_url
                or f"{self._settings.supabase_url}/auth/v1/.well-known/jwks.json"
            )
            self._jwks_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)

    async def validate_token(self, token: str) -> TokenIdentity:
        # jwt.decode / JWKS lookup are blocking calls; keep them off the event loop.
        return await asyncio.to_thread(self._validate_token_sync, token)

    def _validate_token_sync(self, token: str) -> TokenIdentity:
        try:
            if self._settings.supabase_jwt_secret:
                claims = jwt.decode(
                    token,
                    self._settings.supabase_jwt_secret,
                    algorithms=["HS256"],
                    audience=self._settings.supabase_jwt_audience,
                    issuer=self._issuer,
                )
            else:
                assert self._jwks_client is not None
                signing_key = self._jwks_client.get_signing_key_from_jwt(token)
                claims = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256", "ES256"],
                    audience=self._settings.supabase_jwt_audience,
                    issuer=self._issuer,
                )
        except jwt.PyJWTError as exc:
            raise InvalidTokenError(str(exc)) from exc

        auth_user_id = claims.get("sub")
        if not auth_user_id:
            raise InvalidTokenError("Token is missing a subject claim.")

        return TokenIdentity(auth_user_id=auth_user_id, email=claims.get("email"), claims=claims)


@lru_cache
def get_identity_provider() -> IdentityProvider:
    return SupabaseIdentityProvider()
