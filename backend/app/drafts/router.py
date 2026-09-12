import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.drafts.schemas import DraftOut, DraftUpdate
from app.drafts.service import get_draft, save_draft
from app.shared.auth.dependencies import get_current_user
from app.shared.database import get_db
from app.shared.envelope import Envelope
from app.users.models import User

router = APIRouter(prefix="/v1/events", tags=["drafts"])


@router.get("/{event_id}/draft", response_model=Envelope[DraftOut])
async def get_draft_route(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Envelope[DraftOut]:
    draft = await get_draft(db, event_id, current_user)
    return Envelope(data=DraftOut.model_validate(draft))


@router.put("/{event_id}/draft", response_model=Envelope[DraftOut])
async def save_draft_route(
    event_id: uuid.UUID,
    update: DraftUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Envelope[DraftOut]:
    draft = await save_draft(db, event_id, current_user, update)
    return Envelope(data=DraftOut.model_validate(draft))
