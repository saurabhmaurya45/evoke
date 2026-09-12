import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.models import EventStatus, EventType
from app.events.schemas import EventCreate, EventOut, EventUpdate
from app.events.service import archive_event, create_event, get_event, list_events, update_event
from app.shared.auth.dependencies import get_current_user
from app.shared.database import get_db
from app.shared.envelope import Envelope
from app.shared.pagination import Page, PageParams, page_params
from app.users.models import User

router = APIRouter(prefix="/v1/events", tags=["events"])


@router.post("", response_model=Envelope[EventOut], status_code=status.HTTP_201_CREATED)
async def create_event_route(
    data: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Envelope[EventOut]:
    event = await create_event(db, current_user, data)
    return Envelope(data=EventOut.model_validate(event))


@router.get("", response_model=Page[EventOut])
async def list_events_route(
    params: PageParams = Depends(page_params),
    status_filter: EventStatus | None = Query(None, alias="status"),
    type_filter: EventType | None = Query(None, alias="type"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[EventOut]:
    page = await list_events(db, current_user, params, status=status_filter, type=type_filter)
    return Page[EventOut](
        data=[EventOut.model_validate(event) for event in page.data],
        pagination=page.pagination,
    )


@router.get("/{event_id}", response_model=Envelope[EventOut])
async def get_event_route(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Envelope[EventOut]:
    event = await get_event(db, event_id, current_user)
    return Envelope(data=EventOut.model_validate(event))


@router.patch("/{event_id}", response_model=Envelope[EventOut])
async def update_event_route(
    event_id: uuid.UUID,
    data: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Envelope[EventOut]:
    event = await update_event(db, event_id, current_user, data)
    return Envelope(data=EventOut.model_validate(event))


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_event_route(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await archive_event(db, event_id, current_user)
    return None
