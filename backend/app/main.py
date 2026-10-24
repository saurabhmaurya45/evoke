from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.shared.observability import configure_logging, init_sentry

settings = get_settings()

# Must run before any other app module's `logging.getLogger(...)` calls emit, and
# before Sentry (which hooks the logging module) — hence first, ahead of router
# imports below.
configure_logging(settings)
init_sentry(settings)

from app.admin.router import router as admin_router  # noqa: E402
from app.auth.router import router as auth_router  # noqa: E402
from app.drafts.router import router as drafts_router  # noqa: E402
from app.events.router import router as events_router  # noqa: E402
from app.invitation.router import router as invitation_router  # noqa: E402
from app.media.router import router as media_router  # noqa: E402
from app.payments.router import router as payments_router  # noqa: E402
from app.shared.database import get_db  # noqa: E402
from app.shared.errors import RequestIdMiddleware, register_error_handlers  # noqa: E402
from app.templates.router import router as templates_router  # noqa: E402
from app.users.router import router as users_router  # noqa: E402

app = FastAPI(
    title="Evoke API",
    version="v1",
    openapi_tags=[
        {
            "name": "templates",
            "description": "Browse and manage invitation templates and their immutable versions.",
        },
        {
            "name": "template-categories",
            "description": (
                "Categories used to group templates by event type (e.g. Wedding, Birthday)."
            ),
        },
        {
            "name": "template-currencies",
            "description": "Currencies usable for pricing PAID templates.",
        },
        {
            "name": "payments",
            "description": "Razorpay checkout for publishing invitations built on PAID templates.",
        },
        {
            "name": "media",
            "description": (
                "Presigned upload/retrieval of template and draft media via Backblaze B2."
            ),
        },
    ],
)

app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(events_router)
app.include_router(templates_router)
app.include_router(drafts_router)
app.include_router(admin_router)
app.include_router(invitation_router)
app.include_router(payments_router)
app.include_router(media_router)


@app.get("/health")
async def health() -> dict:
    """Process health — does not check dependencies. Used for liveness.

    Includes the deployed commit SHA (`version`) so it's possible to confirm
    exactly what's live without needing CI/dashboard access.
    """
    return {"status": "ok", "version": settings.app_version}


@app.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)) -> dict:
    """Readiness — verifies dependencies required to serve traffic. Uses the same
    injected session as every other route, so it respects test overrides and never
    maintains a second connection pool."""
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001 — any DB failure means "degraded", not a crash
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database": db_ok}
