from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import AdminCustomerOut, AdminMetricsOut, AdminPaymentOut, AdminSiteOut
from app.admin.service import get_metrics, list_all_sites, list_customers
from app.shared.auth.dependencies import require_role
from app.shared.database import get_db
from app.shared.envelope import Envelope
from app.shared.pagination import Page, PageParams, page_params
from app.users.models import User, UserRole

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.get("/metrics", response_model=Envelope[AdminMetricsOut])
async def get_metrics_route(
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Envelope[AdminMetricsOut]:
    metrics = await get_metrics(db)
    return Envelope(data=metrics)


@router.get("/customers", response_model=Page[AdminCustomerOut])
async def list_customers_route(
    params: PageParams = Depends(page_params),
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Page[AdminCustomerOut]:
    return await list_customers(db, params)


@router.get("/sites", response_model=Page[AdminSiteOut])
async def list_sites_route(
    params: PageParams = Depends(page_params),
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Page[AdminSiteOut]:
    return await list_all_sites(db, params)


@router.get("/payments", response_model=Page[AdminPaymentOut])
async def list_payments_route(
    params: PageParams = Depends(page_params),
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Page[AdminPaymentOut]:
    """Payments are not modelled yet. Returns an empty page so the frontend
    contract is stable and the admin tab renders without crashing."""
    from app.shared.pagination import Pagination

    return Page[AdminPaymentOut](
        data=[],
        pagination=Pagination(page=params.page, page_size=params.page_size, total=0),
    )
