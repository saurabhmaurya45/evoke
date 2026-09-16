from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import AdminCustomerOut, AdminMetricsOut, AdminPaymentOut, AdminSiteOut
from app.events.models import Event, EventStatus
from app.payments.models import Payment, PaymentStatus
from app.payments.schemas import PaymentOut
from app.shared.pagination import Page, PageParams, make_page
from app.templates.models import Template
from app.users.models import User


async def list_all_payments(db: AsyncSession, params: PageParams) -> Page[AdminPaymentOut]:
    total = (await db.execute(select(func.count()).select_from(Payment))).scalar_one()
    rows = (
        await db.execute(
            select(Payment, Template.name, User.email, Event.slug)
            .join(Template, Template.id == Payment.template_id)
            .join(User, User.id == Payment.user_id)
            .join(Event, Event.id == Payment.event_id)
            .order_by(Payment.created_at.desc())
            .offset((params.page - 1) * params.page_size)
            .limit(params.page_size)
        )
    ).all()
    items = [
        AdminPaymentOut(
            **PaymentOut.model_validate(payment).model_dump(exclude={"template_name"}),
            template_name=template_name,
            customer_email=email,
            event_slug=slug,
        )
        for payment, template_name, email, slug in rows
    ]
    return make_page(items, total, params)


async def list_customers(db: AsyncSession, params: PageParams) -> Page[AdminCustomerOut]:
    event_count_sub = (
        select(Event.owner_id, func.count().label("event_count"))
        .group_by(Event.owner_id)
        .subquery()
    )

    revenue_sub = (
        select(Payment.user_id, func.sum(Payment.amount_minor).label("revenue_minor"))
        .where(Payment.status == PaymentStatus.PAID)
        .group_by(Payment.user_id)
        .subquery()
    )

    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    stmt = (
        select(
            User,
            func.coalesce(event_count_sub.c.event_count, 0).label("event_count"),
            func.coalesce(revenue_sub.c.revenue_minor, 0).label("revenue_minor"),
        )
        .outerjoin(event_count_sub, User.id == event_count_sub.c.owner_id)
        .outerjoin(revenue_sub, User.id == revenue_sub.c.user_id)
        .order_by(User.created_at.desc())
        .offset((params.page - 1) * params.page_size)
        .limit(params.page_size)
    )
    rows = (await db.execute(stmt)).all()

    items = [
        AdminCustomerOut(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            display_name=user.display_name,
            role=user.role,
            joined_at=user.created_at,
            event_count=count,
            revenue_minor=revenue,
        )
        for user, count, revenue in rows
    ]
    return make_page(items, total, params)


async def list_all_sites(db: AsyncSession, params: PageParams) -> Page[AdminSiteOut]:
    total = (await db.execute(select(func.count()).select_from(Event))).scalar_one()

    stmt = (
        select(Event, User.email.label("owner_email"))
        .join(User, Event.owner_id == User.id)
        .order_by(Event.created_at.desc())
        .offset((params.page - 1) * params.page_size)
        .limit(params.page_size)
    )
    rows = (await db.execute(stmt)).all()

    items = [
        AdminSiteOut(
            id=event.id,
            owner_id=event.owner_id,
            owner_email=owner_email,
            type=event.type,
            title=event.title,
            slug=event.slug,
            status=event.status,
            template_id=event.template_id,
            created_at=event.created_at,
            updated_at=event.updated_at,
        )
        for event, owner_email in rows
    ]
    return make_page(items, total, params)


async def get_metrics(db: AsyncSession) -> AdminMetricsOut:
    customer_count = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    site_count = (await db.execute(select(func.count()).select_from(Event))).scalar_one()

    draft_count = (
        await db.execute(
            select(func.count()).select_from(Event).where(Event.status == EventStatus.DRAFT)
        )
    ).scalar_one()

    archived_count = (
        await db.execute(
            select(func.count()).select_from(Event).where(Event.status == EventStatus.ARCHIVED)
        )
    ).scalar_one()

    return AdminMetricsOut(
        customer_count=customer_count,
        site_count=site_count,
        draft_count=draft_count,
        archived_count=archived_count,
    )
