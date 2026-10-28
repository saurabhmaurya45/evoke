from collections.abc import AsyncGenerator
from typing import Any
from uuid import uuid4

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


# Supabase's pooler (Supavisor) port for transaction mode. Session mode (5432)
# pins one server connection per client and caps clients at the pool size (15),
# which serverless instances — each with its own engine — exhaust quickly
# ("EMAXCONNSESSION max clients reached in session mode").
SUPABASE_TRANSACTION_POOLER_PORT = 6543

# Client-side pool per instance on the transaction pooler. Idle client connections
# hold no Postgres connection there, so keeping a few open is free and saves the
# TCP+TLS+auth handshake on every warm request. Budget: instances x (size +
# overflow) must stay well under the pooler's client limit (200 on Nano) — at 5
# per instance that's ~30 instances with room for the dashboard and migrations.
TRANSACTION_POOL_SIZE = 2
TRANSACTION_POOL_MAX_OVERFLOW = 3
# Under the pooler's idle-client timeout, so a pooled connection is replaced
# before the server side drops it (pre-ping catches any that slip through).
TRANSACTION_POOL_RECYCLE_SECONDS = 300
# Wait this long for a pooled connection, then fail the request cleanly rather
# than queueing indefinitely.
TRANSACTION_POOL_TIMEOUT_SECONDS = 10


def engine_options(database_url: str, *, serverless: bool) -> dict[str, Any]:
    """`create_async_engine` options for where the app runs.

    - Transaction pooler: a small persistent pool per instance (see
      TRANSACTION_POOL_*), and no prepared-statement caching — a statement
      prepared on one server connection is gone by the next transaction, which
      may run on another. Unique statement names keep asyncpg from colliding
      with ones a previous client left on a shared server connection.
    - Serverless on a direct/session connection: NullPool, because there an
      idle client still pins a Postgres connection other instances need.
    - Otherwise (local dev, tests, a long-running server): a regular pool.
    """
    options: dict[str, Any] = {"pool_pre_ping": True}
    if make_url(database_url).port == SUPABASE_TRANSACTION_POOLER_PORT:
        options["pool_size"] = TRANSACTION_POOL_SIZE
        options["max_overflow"] = TRANSACTION_POOL_MAX_OVERFLOW
        options["pool_recycle"] = TRANSACTION_POOL_RECYCLE_SECONDS
        options["pool_timeout"] = TRANSACTION_POOL_TIMEOUT_SECONDS
        options["connect_args"] = {
            "statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
        }
    elif serverless:
        options["poolclass"] = NullPool
    return options


def _database_url(database_url: str) -> str:
    # SQLAlchemy's own prepared-statement cache (separate from asyncpg's) must be
    # off on the transaction pooler too; it's configured through the URL.
    url = make_url(database_url)
    if url.port == SUPABASE_TRANSACTION_POOLER_PORT:
        url = url.update_query_dict({"prepared_statement_cache_size": "0"})
    return url.render_as_string(hide_password=False)


_settings = get_settings()
_engine = create_async_engine(
    _database_url(_settings.database_url),
    **engine_options(_settings.database_url, serverless=_settings.serverless),
)
_session_factory = async_sessionmaker(_engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        yield session
