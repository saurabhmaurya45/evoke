from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.models import EventStatus
from app.events.service import get_event_by_public_subdomain, get_event_by_slug
from app.invitation.service import build_invitation_out
from app.events.schemas import InvitationOut
from app.shared.auth.dependencies import get_current_user_optional
from app.shared.database import get_db
from app.shared.errors import NotFoundError
from app.shared.storage.b2_client import B2Client, get_b2_client
from app.users.models import User

router = APIRouter(prefix="/v1/i", tags=["invitation"])


@router.get(
    "/by-subdomain/{subdomain}",
    response_model=InvitationOut,
    summary="Public invitation by wedding subdomain",
)
async def get_invitation_by_subdomain_route(
    subdomain: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
    b2: B2Client | None = Depends(get_b2_client),
) -> InvitationOut:
    """Resolve `https://{subdomain}.theinvitely.in` to the same payload as `/v1/i/{slug}`.

    Returns 404 for unknown labels, reserved hostnames, draft/archived events, or
    unpublished invitations (public guests only see PUBLISHED).
    """
    event = await get_event_by_public_subdomain(db, subdomain)
    if event is None:
        raise NotFoundError("EVENT_NOT_FOUND", "Invitation not found.")

    if event.status != EventStatus.PUBLISHED:
        raise NotFoundError("EVENT_NOT_FOUND", "Invitation not found.")

    return await build_invitation_out(db, event, current_user, b2)


@router.get("/{slug}", response_model=InvitationOut)
async def get_invitation_route(
    slug: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
    b2: B2Client | None = Depends(get_b2_client),
) -> InvitationOut:
    """Public viewer endpoint for an invitation page.

    - PUBLISHED events are visible to everyone (no auth required).
    - DRAFT events are visible only to the owner (auth required).
    - ARCHIVED events are never visible here.

    Uploaded media in `draftData` is returned as signed URLs valid for 15 minutes.
    """
    event = await get_event_by_slug(db, slug)
    if event is None:
        raise NotFoundError("EVENT_NOT_FOUND", "Invitation not found.")

    return await build_invitation_out(db, event, current_user, b2)