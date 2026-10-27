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


def engine_options(database_url: str, *, serverless: bool) -> dict[str, Any]:
    """`create_async_engine` options for where the app runs.

    - Transaction pooler: the pooler owns pooling, so no client-side pool
      (NullPool), and no prepared-statement caching — a statement prepared on
      one server connection is gone by the next transaction, which may run on
      another. Unique statement names keep asyncpg from colliding with ones a
      previous client left on a shared server connection.
    - Serverless on a direct/session connection: NullPool too, so an idle
      instance doesn't sit on connections other instances need.
    - Otherwise (local dev, tests, a long-running server): a regular pool.
    """
    options: dict[str, Any] = {"pool_pre_ping": True}
    if make_url(database_url).port == SUPABASE_TRANSACTION_POOLER_PORT:
        options["poolclass"] = NullPool
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
