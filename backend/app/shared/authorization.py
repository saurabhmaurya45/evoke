import uuid

from app.shared.errors import AuthForbiddenError
from app.users.models import User, UserRole


def ensure_owner_or_admin(current_user: User, owner_id: uuid.UUID) -> None:
    """Enforce RBAC + resource ownership: ADMIN may act on any resource; anyone else
    only on resources they own. Callers must load the resource first — this cannot
    check ownership without knowing the resource's owner_id."""
    if current_user.role == UserRole.ADMIN:
        return
    if current_user.id != owner_id:
        raise AuthForbiddenError("You do not own this resource.")
