"""Engine options per deployment: the Supabase transaction pooler and serverless
instances must not keep a client-side pool (EMAXCONNSESSION in production)."""

from sqlalchemy.pool import NullPool

from app.shared.database import _database_url, engine_options

SESSION_URL = "postgresql+asyncpg://u:p@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
TRANSACTION_URL = "postgresql+asyncpg://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
LOCAL_URL = "postgresql+asyncpg://u:p@127.0.0.1:5432/evoke"


def test_transaction_pooler_keeps_small_persistent_pool_and_no_statement_cache():
    options = engine_options(TRANSACTION_URL, serverless=True)
    assert "poolclass" not in options  # default QueuePool: connections reused
    assert (options["pool_size"], options["max_overflow"]) == (2, 3)
    assert options["pool_recycle"] == 300
    assert options["pool_timeout"] == 10
    assert options["connect_args"]["statement_cache_size"] == 0
    name_func = options["connect_args"]["prepared_statement_name_func"]
    assert name_func() != name_func()
    assert "prepared_statement_cache_size=0" in _database_url(TRANSACTION_URL)


def test_serverless_session_pooler_uses_null_pool():
    options = engine_options(SESSION_URL, serverless=True)
    assert options["poolclass"] is NullPool
    assert "connect_args" not in options
    assert _database_url(SESSION_URL) == SESSION_URL


def test_long_running_server_keeps_a_pool():
    options = engine_options(LOCAL_URL, serverless=False)
    assert "poolclass" not in options
    assert options["pool_pre_ping"] is True
    assert _database_url(LOCAL_URL) == LOCAL_URL


def test_password_survives_url_rewrite():
    assert ":p@" in _database_url(TRANSACTION_URL)
