from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.drafts.models import Draft
from app.events.models import EventStatus
from app.events.schemas import InvitationOut
from app.events.service import get_event_by_slug
from app.shared.auth.dependencies import get_current_user_optional
from app.shared.database import get_db
from app.shared.errors import AuthForbiddenError, AuthRequiredError, NotFoundError
from app.templates.models import Template
from app.users.models import User

router = APIRouter(prefix="/v1/i", tags=["invitation"])


@router.get("/{slug}", response_model=InvitationOut)
async def get_invitation_route(
    slug: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> InvitationOut:
    """Public viewer endpoint for an invitation page.

    - PUBLISHED events are visible to everyone (no auth required).
    - DRAFT events are visible only to the owner (auth required).
    - ARCHIVED events are never visible here.
    """
    event = await get_event_by_slug(db, slug)
    if event is None:
        raise NotFoundError("EVENT_NOT_FOUND", "Invitation not found.")

    if event.status == EventStatus.ARCHIVED:
        raise NotFoundError("EVENT_NOT_FOUND", "Invitation not found.")

    if event.status == EventStatus.DRAFT:
        if current_user is None:
            raise AuthRequiredError("Sign in to preview your draft invitation.")
        if current_user.id != event.owner_id and current_user.role.value != "ADMIN":
            raise AuthForbiddenError("You do not have access to this draft.")

    # Load the 1:1 draft for this event.
    draft_result = await db.execute(select(Draft).where(Draft.event_id == event.id))
    draft = draft_result.scalar_one_or_none()

    # Resolve the template slot id the Angular frontend uses to look up the
    # template's previewUrl in templates.index.json.
    #
    # Priority:
    #   1. draft.template_id FK → look up the template slug from the DB (reliable,
    #      works for any event regardless of how it was created).
    #   2. event.title fallback — HttpTemplateRepository stores the slot id as the
    #      event title when it creates the event, so this works for all FE-created
    #      events. Any event whose title is NOT a slot id (admin-created events with
    #      real titles) will fall through to None and the viewer will show an error.
    template_slot_id: str | None = None
    if draft and draft.template_id:
        template = await db.get(Template, draft.template_id)
        if template:
            template_slot_id = template.slug

    if template_slot_id is None and event.title and event.title.startswith("tpl-"):
        template_slot_id = event.title

    return InvitationOut(
        event_id=event.id,
        slug=event.slug,
        title=event.title,
        status=event.status,
        owner_id=event.owner_id,
        template_slot_id=template_slot_id,
        draft_data=draft.data if draft else {},
        schema_version=draft.schema_version if draft else None,
    )
