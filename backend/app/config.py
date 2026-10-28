from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    # Short git SHA of the deployed commit, set by CI (see deploy-backend.yml)
    # so /health reports exactly what's live — "dev" when run locally.
    app_version: str = "dev"

    database_url: str
    # True on Vercel (it sets VERCEL=1 in every function): each instance gets its
    # own engine, so it must not hold a connection pool — see app/shared/database.py.
    serverless: bool = Field(default=False, validation_alias=AliasChoices("SERVERLESS", "VERCEL"))

    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str | None = None
    # Explicit JWKS URL. If unset, derived from supabase_url. Only needed if your Supabase
    # project fronts auth through a different host than the main project URL.
    supabase_jwks_url: str | None = None
    # Legacy shared HS256 secret. Leave unset for projects on the newer asymmetric
    # (JWKS-based) signing keys — which is the default for new Supabase projects.
    supabase_jwt_secret: str | None = None
    supabase_jwt_audience: str = "authenticated"

    cors_origins: str = "http://localhost:4200"

    log_level: str = "INFO"
    # How many invitations a user may publish without paying (free templates).
    # Paid templates are unlimited; admins are exempt.
    free_invitation_limit: int = 2

    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None
    razorpay_api_url: str = "https://api.razorpay.com/v1"
    # Public URL of this API — Razorpay redirects the browser back to it after payment.
    api_base_url: str = "http://localhost:8000"
    frontend_base_url: str = "http://localhost:4200"
    # Razorpay rejects payment links that expire in under 15 minutes. Values below
    # app.payments.service._MIN_EXPIRY_MINUTES (20) are floored there, not here, so
    # that margin lives in one place next to the constant it protects.
    payment_link_expiry_minutes: int = 30

    # Backblaze B2 (S3-compatible), single private bucket for all media. Two
    # application keys, split by pipeline stage: Producer (read+write) owns
    # upload presigning + ack verification; Consumer (read-only) owns signed
    # GET presigning on read. All unset -> get_b2_client() returns None and
    # media upload/retrieval is disabled, same as Razorpay's optional wiring.
    b2_endpoint_url: str | None = None
    b2_bucket_name: str | None = None
    b2_producer_key_id: str | None = None
    b2_producer_key_secret: str | None = None
    b2_consumer_key_id: str | None = None
    b2_consumer_key_secret: str | None = None
    # Public base URL of the (public) media bucket — Cloudflare R2's `r2.dev` host or
    # a custom domain, e.g. https://media.theinvitely.in. When set, every uploaded
    # object is served from here permanently (no expiring signed URLs) and the
    # Consumer key is not needed. Unset -> signed GET URLs, as before.
    public_media_base_url: str | None = None

    # Sentry (error tracking). Unset -> init_observability() skips Sentry entirely,
    # same "optional, no-op if unset" pattern as Razorpay/B2 above.
    sentry_dsn: str | None = None
    # Fraction of transactions traced for performance monitoring, not just errors.
    # Kept low by default since it's a separate, smaller quota than error events.
    sentry_traces_sample_rate: float = 0.0

    # Axiom (log shipping). Both unset -> logs stay local-only (stdout), same pattern.
    axiom_token: str | None = None
    axiom_dataset: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
