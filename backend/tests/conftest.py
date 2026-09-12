"""Test harness.

Prefers `TEST_DATABASE_URL` (any reachable Postgres — local, CI service container,
or a scratch Supabase branch) so tests run without Docker. Falls back to spinning up
an ephemeral Postgres via testcontainers when that env var is unset and Docker is
available. Either way, tests never touch a real Supabase project or a real JWT —
`FakeIdentityProvider` stands in for `IdentityProvider` so auth is exercised without
network calls.
"""

import os
import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

import app.db_models  # noqa: F401  (registers all models on Base.metadata)
from app.shared.auth.identity_provider import IdentityProvider, InvalidTokenError, TokenIdentity
from app.shared.auth.supabase_identity_provider import get_identity_provider
from app.shared.database import Base, get_db


class FakeIdentityProvider(IdentityProvider):
    """Test double: the bearer token IS the auth_user_id, no signature/JWKS involved."""

    async def validate_token(self, token: str) -> TokenIdentity:
        if not token:
            raise InvalidTokenError("empty token")
        return TokenIdentity(auth_user_id=token, email=f"{token}@example.test", claims={})


def _to_async_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


@pytest.fixture(scope="session")
def postgres_url() -> str:
    env_url = os.environ.get("TEST_DATABASE_URL")
    if env_url:
        yield _to_async_url(env_url)
        return

    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine") as container:
        yield _to_async_url(container.get_connection_url())


@pytest_asyncio.fixture
async def db_engine(postgres_url: str):
    """Function-scoped even though the underlying Postgres (postgres_url) is shared
    for the whole session: `AsyncEngine`/asyncpg connections are bound to the event
    loop they were created on, and pytest-asyncio gives each test its own loop by
    default. A session-scoped engine would be used from a different loop than it was
    created in on every test after the first, which asyncpg rejects outright."""
    engine = create_async_engine(postgres_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """One test = one outer transaction, rolled back at the end. Application code is
    free to call `session.commit()` — it commits into a SAVEPOINT, not the outer
    transaction, so nothing survives past the test."""
    async with db_engine.connect() as conn:
        await conn.begin()
        session = AsyncSession(
            bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )
        try:
            yield session
        finally:
            await session.close()
            await conn.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    from app.main import app

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_identity_provider] = lambda: FakeIdentityProvider()
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    """A fresh fake auth_user_id per call, so tests don't collide with each other's
    provisioned users within the same (rolled-back) session."""

    def _make(auth_user_id: str | None = None) -> dict[str, str]:
        token = auth_user_id or str(uuid.uuid4())
        return {"Authorization": f"Bearer {token}"}

    return _make
