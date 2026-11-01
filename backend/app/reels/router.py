import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.reels.schemas import ReelOut
from app.reels.service import get_reel, request_reel
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
    """State of the invitation's video and, once finished, its download URL.

    Requires the owner (or an ADMIN); anyone else gets `404 EVENT_NOT_FOUND`. Returns
    `available: false` rather than an error when the invitation can't have a video:
    it isn't published, it has no completed payment (including invitations on free
    templates), or its template has no film yet. Poll this while `status` is
    QUEUED or RENDERING.
    """
    return Envelope(data=await get_reel(db, b2, event_id, current_user))


@router.post(
    "",
    response_model=Envelope[ReelOut],
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create an invitation's video",
)
async def request_reel_route(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    b2: B2Client | None = Depends(get_b2_client),
) -> Envelope[ReelOut]:
    """Queue a video made from the invitation's saved details, photos and song.

    Rendering happens in the background and takes a few minutes: poll
    `GET /v1/events/{event_id}/reel`. Idempotent: while a render is running, or if the
    finished video already shows the latest details, nothing new is queued.

    Requires the owner (or an ADMIN). Fails with `409 EVENT_NOT_PUBLISHED`,
    `402 REEL_PAYMENT_REQUIRED` (no completed payment; admins are not exempt),
    `409 REEL_NOT_AVAILABLE` (the template has no film yet), `422 VALIDATION_FAILED`
    (details the film needs are empty), `429 REEL_DAILY_LIMIT` (admins are exempt), or
    `503 REELS_DISABLED` / `503 MEDIA_STORAGE_NOT_CONFIGURED`.
    """
    return Envelope(data=await request_reel(db, b2, event_id, current_user))
