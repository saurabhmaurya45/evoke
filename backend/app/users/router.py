from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.auth.dependencies import get_current_user
from app.shared.database import get_db
from app.shared.envelope import Envelope
from app.shared.pagination import Page, PageParams, page_params
from app.users.models import User
from app.users.schemas import UserProfileOut, UserProfileUpdate, UserSiteOut
from app.users.service import list_my_sites, update_profile

router = APIRouter(prefix="/v1/users", tags=["users"])


@router.get("/me", response_model=Envelope[UserProfileOut])
async def get_my_profile(current_user: User = Depends(get_current_user)) -> Envelope[UserProfileOut]:
    return Envelope(data=UserProfileOut.model_validate(current_user))


@router.get("/me/sites", response_model=Page[UserSiteOut])
async def list_my_sites_route(
    params: PageParams = Depends(page_params),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Page[UserSiteOut]:
    return await list_my_sites(db, current_user, params)


@router.patch("/me", response_model=Envelope[UserProfileOut])
async def update_my_profile(
    update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Envelope[UserProfileOut]:
    updated = await update_profile(db, current_user, update)
    return Envelope(data=UserProfileOut.model_validate(updated))
