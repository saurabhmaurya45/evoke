import uuid
from datetime import datetime

from app.events.models import EventStatus, EventType
from app.shared.schema import CamelModel
from app.users.models import UserRole


class CurrentUserOut(CamelModel):
    """Response for GET /v1/auth/me — identity + roles projection."""

    id: uuid.UUID
    email: str
    display_name: str | None
    roles: list[UserRole]
    profile_completed: bool


class UserProfileOut(CamelModel):
    """Response for GET/PATCH /v1/users/me — application profile fields."""

    id: uuid.UUID
    email: str
    first_name: str | None
    last_name: str | None
    display_name: str | None
    profile_completed: bool
    created_at: datetime
    updated_at: datetime


class UserProfileUpdate(CamelModel):
    first_name: str | None = None
    last_name: str | None = None
    display_name: str | None = None


class UserSiteOut(CamelModel):
    """One event belonging to the current user, projected as a dashboard site card.

    `views` and `rsvps` are not yet tracked by the backend — they are returned as 0
    until the analytics/publishing module is added. The shape matches the frontend's
    `InvitationSite` model so the component can swap from the seeded service with no
    further changes.
    """

    id: uuid.UUID
    type: EventType
    title: str
    slug: str
    status: EventStatus
    template_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    views: int = 0
    rsvps: int = 0
