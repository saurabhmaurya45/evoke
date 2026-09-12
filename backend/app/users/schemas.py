import uuid
from datetime import datetime

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
