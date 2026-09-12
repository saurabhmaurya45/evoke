# Evoke Backend

FastAPI + SQLAlchemy 2.0 (async) backend for the Evoke event-invitation platform.
See `../docs/` for the full architecture (identity, portability boundary, domain
model, API contract). This is Phase 1-2 of that design: Foundation, Auth, Users,
Events, Templates, Drafts. Media, Publishing, Billing, and RSVP are not implemented
yet.

## Stack

- **API:** FastAPI, async endpoints throughout
- **DB access:** SQLAlchemy 2.0 (async, `asyncpg` driver), Alembic for migrations
- **Identity:** Supabase Auth, behind the `IdentityProvider` interface
  (`app/shared/auth/identity_provider.py`) — see the portability boundary in the
  architecture docs. Swapping providers later means writing a new adapter, not
  rewriting business logic.
- **Database:** PostgreSQL, managed by Supabase in production; any Postgres works
  locally/in tests.

## Local setup

1. **Python env**

   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   ```

2. **Environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in `DATABASE_URL` (Supabase project settings → Database → Connection string,
   using the `postgresql+asyncpg://` scheme) and `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`
   / `SUPABASE_SECRET_KEY` (Supabase project settings → API Keys). Set
   `SUPABASE_JWT_SECRET` only if your project still uses the legacy shared HS256
   secret (Project settings → JWT Keys) — leave it blank (and optionally set
   `SUPABASE_JWKS_URL` explicitly) to validate tokens against the project's JWKS
   endpoint instead.

   Never commit `.env`.

3. **Run migrations**

   ```bash
   alembic upgrade head
   ```

4. **Run the API**

   ```bash
   uvicorn app.main:app --reload
   ```

   - `GET /health` — process liveness
   - `GET /ready` — checks the DB connection
   - `GET /docs` — OpenAPI/Swagger UI

## Tests

Tests never touch a real Supabase project or issue real JWTs — auth is exercised
through a `FakeIdentityProvider` test double (`tests/conftest.py`), and the DB layer
needs any reachable Postgres:

```bash
# Option A: point at any Postgres you already have running (fastest, no Docker)
export TEST_DATABASE_URL="postgresql+asyncpg://<user>@localhost:5432/<some_db>"
pytest

# Option B: no TEST_DATABASE_URL set + Docker running -> spins up an ephemeral
# Postgres container automatically via testcontainers
pytest
```

## Adding a new domain module

Follow the existing modules (`app/users`, `app/events`, `app/templates`,
`app/drafts`) as the template: `models.py` (SQLAlchemy), `schemas.py` (Pydantic
`CamelModel` subclasses — the API is camelCase JSON, Python stays snake_case),
`service.py` (business logic, ownership checks via
`app.shared.authorization.ensure_owner_or_admin`, audit logging via
`app.shared.audit.log_action`), `router.py` (thin, delegates to `service.py`).

Register new models in `app/db_models.py` and new routers in `app/main.py`. Write
migrations by hand (see `alembic/versions/`) rather than relying on autogenerate
against a live DB — this repo doesn't assume you have one connected at write time.

## Portability

Business logic (ownership rules, draft optimistic concurrency, template versioning)
lives in this codebase's `service.py` files — never in Supabase Edge Functions or
solely in RLS policies. Migrations are plain Alembic/SQL. The backend talks to
Postgres via a normal connection string, not the Supabase SDK. See
`docs/wedding-platform-architecture.md` §4.5 for the full exit-strategy rationale.
