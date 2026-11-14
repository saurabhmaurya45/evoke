import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.reels.schemas import ReelOut
from app.reels.service import get_reel, request_preview, request_reel
from app.shared.auth.dependencies import get_current_user
from app.shared.database import get_db
from app.shared.envelope import Envelope
from app.shared.storage.b2_client import B2Client, get_b2_client
from app.users.models import User

router = APIRouter(prefix="/v1/events/{event_id}/reel", tags=["reels"])


@router.get("", response_model=Envelope[ReelOut], summary="Get an invitation's video")
async def get_reel_route(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    b2: B2Client | None = Depends(get_b2_client),
) -> Envelope[ReelOut]:
    """State of the invitation's watermarked preview and, once bought, of its video.

    Requires the owner (or an ADMIN); anyone else gets `404 EVENT_NOT_FOUND`. Returns
    `available: false` rather than an error when the invitation can't have a video (its
    template has no film yet, or videos are switched off). The download fields stay empty
    until the video is paid for. Poll this while a status is QUEUED or RENDERING.
    """
    return Envelope(data=await get_reel(db, b2, event_id, current_user))


@router.post(
    "/preview",
    response_model=Envelope[ReelOut],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a watermarked preview of the video",
)
async def request_preview_route(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    b2: B2Client | None = Depends(get_b2_client),
) -> Envelope[ReelOut]:
    """Queue a preview made from the invitation's saved details, before anything is paid.

    The preview is low resolution with a watermark burned into every frame, so it can be
    shown before payment without giving the video away. Works on drafts. Takes a few
    minutes: poll `GET /v1/events/{event_id}/reel`. Idempotent: while a preview is being
    made, or if the newest one already shows the latest details, nothing new is queued.

    Requires the owner (or an ADMIN). Fails with `409 REEL_NOT_AVAILABLE` (the template has
    no film yet), `409 EVENT_ARCHIVED`, `422 VALIDATION_FAILED` (details the film needs are
    empty), `429 REEL_DAILY_LIMIT` (admins are exempt), or `503 REELS_DISABLED` /
    `503 MEDIA_STORAGE_NOT_CONFIGURED`.
    """
    return Envelope(data=await request_preview(db, b2, event_id, current_user))


@router.post(
    "",
    response_model=Envelope[ReelOut],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Make the bought video again",
)
async def request_reel_route(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    b2: B2Client | None = Depends(get_b2_client),
) -> Envelope[ReelOut]:
    """Queue the bought video from the invitation's latest details.

    The video is made automatically after it is paid for and each time the invitation is
    published; this is for trying again after a failed render. Idempotent: while a render
    is running, or if the video already shows the latest details, nothing new is queued.
    The new video replaces the old one in storage.

    Requires the owner (or an ADMIN). Fails with `409 EVENT_NOT_PUBLISHED`,
    `402 REEL_PAYMENT_REQUIRED` (the video wasn't bought; admins are not exempt),
    `409 REEL_NOT_AVAILABLE`, `422 VALIDATION_FAILED`, `429 REEL_DAILY_LIMIT` (admins are
    exempt), or `503 REELS_DISABLED` / `503 MEDIA_STORAGE_NOT_CONFIGURED`.
    """
    return Envelope(data=await request_reel(db, b2, event_id, current_user))
