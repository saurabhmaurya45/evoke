import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.config import get_settings
from app.drafts.router import router as drafts_router
from app.events.router import router as events_router
from app.shared.database import get_db
from app.shared.errors import RequestIdMiddleware, register_error_handlers
from app.templates.router import router as templates_router
from app.users.router import router as users_router

settings = get_settings()

logging.basicConfig(level=settings.log_level)

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
            "description": "Categories used to group templates by event type (e.g. Wedding, Birthday).",
        },
        {
            "name": "template-currencies",
            "description": "Currencies usable for pricing PAID templates.",
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


@app.get("/health")
async def health() -> dict:
    """Process health — does not check dependencies. Used for liveness."""
    return {"status": "ok"}


@app.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)) -> dict:
    """Readiness — verifies dependencies required to serve traffic. Uses the same
    injected session as every other route, so it respects test overrides and never
    maintains a second connection pool."""
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database": db_ok}
