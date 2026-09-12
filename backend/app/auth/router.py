from fastapi import APIRouter, Depends, status

from app.shared.auth.dependencies import get_current_user
from app.shared.envelope import Envelope
from app.users.models import User
from app.users.schemas import CurrentUserOut

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.get("/me", response_model=Envelope[CurrentUserOut])
async def get_me(current_user: User = Depends(get_current_user)) -> Envelope[CurrentUserOut]:
    return Envelope(
        data=CurrentUserOut(
            id=current_user.id,
            email=current_user.email,
            display_name=current_user.display_name,
            roles=[current_user.role],
            profile_completed=current_user.profile_completed,
        )
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: User = Depends(get_current_user)) -> None:
    """Session invalidation is owned by Supabase Auth on the client (supabase-js
    `signOut()` clears the local session/cookie). This endpoint exists to keep the
    application-facing auth contract stable and as a hook for future server-side
    revocation (e.g. admin-forced logout) without requiring a frontend contract change.
    """
    return None
