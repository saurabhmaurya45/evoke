from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.drafts.models import Draft
from app.events.models import Event, EventStatus
from app.events.schemas import InvitationOut
from app.events.service import resolve_event_template
from app.media.service import resolve_media_refs
from app.shared.errors import AuthForbiddenError, AuthRequiredError, NotFoundError
from app.shared.storage.b2_client import B2Client
from app.users.models import User


async def build_invitation_out(
    db: AsyncSession,
    event: Event,
    current_user: User | None,
    b2: B2Client | None,
) -> InvitationOut:
    if event.status == EventStatus.ARCHIVED:
        raise NotFoundError("EVENT_NOT_FOUND", "Invitation not found.")

    if event.status == EventStatus.DRAFT:
        if current_user is None:
            raise AuthRequiredError("Sign in to preview your draft invitation.")
        if current_user.id != event.owner_id and current_user.role.value != "ADMIN":
            raise AuthForbiddenError("You do not have access to this draft.")

    draft_result = await db.execute(select(Draft).where(Draft.event_id == event.id))
    draft = draft_result.scalar_one_or_none()

    template = await resolve_event_template(db, event)
    template_slot_id = template.slug if template else None
    if template_slot_id is None and event.title and event.title.startswith("tpl-"):
        template_slot_id = event.title

    return InvitationOut(
        event_id=event.id,
        slug=event.slug,
        public_subdomain=event.public_subdomain,
        title=event.title,
        status=event.status,
        owner_id=event.owner_id,
        template_slot_id=template_slot_id,
        draft_data=resolve_media_refs(b2, draft.data) if draft else {},
        schema_version=draft.schema_version if draft else None,
    )