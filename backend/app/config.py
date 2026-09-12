from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"

    database_url: str

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

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
