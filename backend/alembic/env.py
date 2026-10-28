import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

import app.db_models  # noqa: F401  (registers all models on Base.metadata)
from alembic import context
from app.config import get_settings
from app.shared.database import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

config.set_main_option("sqlalchemy.url", get_settings().database_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    # The app role has statement / idle-in-transaction timeouts (15s / 30s) so a
    # stuck request can't hold a pooled connection; a migration (index build,
    # backfill) may legitimately run longer. Session-level, so this needs the
    # session pooler (5432) or a direct connection — never the 6543 pooler.
    connection.exec_driver_sql("SET statement_timeout = 0")
    connection.exec_driver_sql("SET idle_in_transaction_session_timeout = 0")
    # Commit the autobegun transaction: otherwise Alembic sees one already open,
    # treats it as the caller's and never commits the migration itself. Plain
    # SET (not SET LOCAL) outlives the commit for the rest of the session.
    connection.commit()
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
