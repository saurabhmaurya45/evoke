"""Error tracking (Sentry) and log shipping (Axiom) wiring.

Both are optional, same pattern as Razorpay/B2 in `app/config.py`: unset credentials
mean the feature is a no-op rather than a boot failure. `configure_logging` must run
before any module-level `logging.getLogger(...)` call emits, so `app/main.py` calls it
first, before importing the routers.
"""

import logging
from contextvars import ContextVar

from app.config import Settings

# Set by `RequestIdMiddleware` for the lifetime of one request's asyncio task, so any
# log line emitted anywhere during that request can be correlated back to it (and, via
# the request ID in the error envelope, back to a specific user report).
request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


class _RequestIdLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get() or "-"
        return True


def configure_logging(settings: Settings) -> None:
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)s [%(name)s] [req=%(request_id)s] %(message)s",
    )
    root = logging.getLogger()
    # A Logger's own filters only run for records it originates, not ones propagated
    # up from child loggers — the filter has to sit on each handler instead, since
    # Logger.callHandlers applies handler-level filters to every propagated record.
    for handler in root.handlers:
        handler.addFilter(_RequestIdLogFilter())

    if settings.axiom_token and settings.axiom_dataset:
        from axiom_py import Client as AxiomClient
        from axiom_py.logging import AxiomHandler

        handler = AxiomHandler(AxiomClient(token=settings.axiom_token), settings.axiom_dataset)
        handler.addFilter(_RequestIdLogFilter())
        root.addHandler(handler)


def init_sentry(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return

    import sentry_sdk
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        release=settings.app_version,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[
            # event_level=None: a `logger.error`/`logger.exception` call (e.g. a
            # handled Razorpay/B2 provider failure already turned into a typed
            # AppError and a clean 502/503) stays a breadcrumb, not its own Sentry
            # event — only truly unhandled exceptions, captured separately by the
            # FastAPI/Starlette integration, should count against the error quota.
            LoggingIntegration(event_level=None),
        ],
    )
