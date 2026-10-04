import uuid

from app.shared.errors import NotFoundError
from app.users.models import User, UserRole


def ensure_owner_or_admin(
    current_user: User, owner_id: uuid.UUID, *, not_found_code: str, not_found_message: str
) -> None:
    """Enforce RBAC + resource ownership: ADMIN may act on any resource; anyone else
    only on resources they own. Callers must load the resource first — this cannot
    check ownership without knowing the resource's owner_id.

    Raises the caller-supplied `NotFoundError` (never `AuthForbiddenError`) for a
    non-owner, non-admin caller — existence of another user's resource must not be
    leaked via a 403 (matches `get_template_version`'s draft-version precedent).
    Each call site passes its own resource-specific not-found code/message, since
    this helper is shared across unrelated resource types (drafts, events,
    payments)."""
    if current_user.role == UserRole.ADMIN:
        return
    if current_user.id != owner_id:
        raise NotFoundError(not_found_code, not_found_message)
