import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import (
    AdminAuditLogOut,
    AdminCustomerOut,
    AdminMetricsOut,
    AdminPaymentOut,
    AdminSiteOut,
)
from app.admin.service import (
    get_metrics,
    list_all_payments,
    list_all_sites,
    list_audit_logs,
    list_customers,
)
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
    """Every payment across the platform, newest first (all statuses)."""
    return await list_all_payments(db, params)


@router.get("/audit-logs", response_model=Page[AdminAuditLogOut])
async def list_audit_logs_route(
    resource_type: str | None = Query(
        None, description="Filter to one resource type, e.g. 'event' or 'payment'."
    ),
    actor_user_id: uuid.UUID | None = Query(None, description="Filter to one actor's actions."),
    params: PageParams = Depends(page_params),
    admin_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Page[AdminAuditLogOut]:
    """The append-only audit trail (every `EVENT_*`, `PAYMENT_*`, `TEMPLATE_*`, etc.
    action recorded by `app.shared.audit.log_action`), newest first. Previously
    write-only — this is the first endpoint that surfaces it through the API."""
    return await list_audit_logs(
        db, params, resource_type=resource_type, actor_user_id=actor_user_id
    )
