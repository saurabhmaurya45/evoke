"""Seed the template catalog (categories, currencies, templates) into an empty database.

An external, idempotent script — never run by the app itself. It mirrors the seven
templates the frontend ships (`frontend/public/invitation-templates/`, names/categories
from `home-content.service.ts`); each template's `slug` is the frontend slot id.

  cd backend
  .venv/Scripts/python scripts/seed_catalog.py            # dry run: shows what it would do
  .venv/Scripts/python scripts/seed_catalog.py --apply    # writes

Only creates what is missing (matched by slug / code). Existing rows — including an
admin's later edits to name, price or visibility — are never overwritten.
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

import app.db_models  # noqa: F401  (registers every model on Base.metadata)
from app.events.models import Event
from app.shared.database import _engine, _session_factory
from app.templates.models import (
    Category,
    Currency,
    PricingModel,
    StorefrontStatus,
    Template,
    TemplateStatus,
)

CURRENCIES = [
    {"code": "INR", "name": "Indian Rupee", "symbol": "₹", "minor_unit": 2},
]

CATEGORIES = [
    {"slug": "wedding", "name": "Wedding", "display_order": 1},
    {"slug": "engagement", "name": "Engagement", "display_order": 2},
]

# Slugs that were named after the sample couples in each template. Rows still using one
# are renamed in place (template slug, and the `events.title` that carries the slot id),
# so an already-seeded database moves over instead of getting a duplicate template.
LEGACY_SLUGS = {
    "tpl-harpreet-ritika": "tpl-rosewood-punjabi",
    "tpl-karan-nisha": "tpl-maroon-gold-royal",
    "tpl-joe-serin": "tpl-doorway-modern",
}

# price_minor is in paise; None means FREE.
TEMPLATES = [
    {
        "slug": "tpl-samarpan-royal",
        "name": "Samarpan — Royal Union",
        "category": "wedding",
        "price_minor": 149900,
    },
    {
        "slug": "tpl-eternal-bond",
        "name": "Eternal Bond — Royal Wedding",
        "category": "wedding",
        "price_minor": None,
    },
    {
        "slug": "tpl-beloved-nikkah",
        "name": "Beloved — Nikkah Invitation",
        "category": "wedding",
        "price_minor": None,
    },
    {
        "slug": "tpl-rosewood-punjabi",
        "name": "Rosewood — Punjabi Wedding",
        "category": "wedding",
        "price_minor": None,
    },
    {
        "slug": "tpl-maroon-gold-royal",
        "name": "Maroon & Gold — Royal Hindu Wedding",
        "category": "wedding",
        "price_minor": None,
    },
    {
        "slug": "tpl-doorway-modern",
        "name": "Doorway — Modern Wedding",
        "category": "wedding",
        "price_minor": None,
    },
    {
        "slug": "tpl-golden-promise",
        "name": "Golden Promise",
        "category": "engagement",
        "price_minor": None,
    },
]
PAID_CURRENCY = "INR"


async def seed(db: AsyncSession, *, apply: bool) -> tuple[list[str], list[str]]:
    """The actual seeding logic, taking `db` explicitly — like every other service in
    this app — instead of opening its own connection, so it can run against a test's
    isolated session too. Returns `(created, kept)` description lines; `main()` below
    is the only thing that prints them or owns the real engine/session lifecycle.
    """
    created: list[str] = []
    kept: list[str] = []

    currencies = {c.code: c for c in (await db.execute(select(Currency))).scalars()}
    for spec in CURRENCIES:
        if spec["code"] in currencies:
            kept.append(f"currency {spec['code']}")
            continue
        row = Currency(**spec)
        db.add(row)
        currencies[spec["code"]] = row
        created.append(f"currency {spec['code']}")

    categories = {c.slug: c for c in (await db.execute(select(Category))).scalars()}
    for spec in CATEGORIES:
        if spec["slug"] in categories:
            kept.append(f"category {spec['slug']}")
            continue
        row = Category(**spec)
        db.add(row)
        categories[spec["slug"]] = row
        created.append(f"category {spec['slug']}")

    await db.flush()  # assigns ids so templates can reference them

    templates = {t.slug: t for t in (await db.execute(select(Template))).scalars()}
    for old, new in LEGACY_SLUGS.items():
        if old in templates and new not in templates:
            templates[old].slug = new
            templates[new] = templates.pop(old)
            moved = (
                await db.execute(update(Event).where(Event.title == old).values(title=new))
            ).rowcount
            created.append(f"rename template {old} -> {new} ({moved} event(s) re-pointed)")
    existing = set(templates)
    for spec in TEMPLATES:
        if spec["slug"] in existing:
            kept.append(f"template {spec['slug']}")
            continue
        paid = spec["price_minor"] is not None
        db.add(
            Template(
                slug=spec["slug"],
                name=spec["name"],
                category_id=categories[spec["category"]].id,
                pricing_model=(PricingModel.PAID if paid else PricingModel.FREE).value,
                price_amount_minor=spec["price_minor"],
                currency_id=currencies[PAID_CURRENCY].id if paid else None,
                storefront_status=StorefrontStatus.LISTED.value,
                status=TemplateStatus.ACTIVE,
            )
        )
        price_label = f"PAID INR {spec['price_minor'] / 100}" if paid else "FREE"
        created.append(f"template {spec['slug']} ({price_label})")

    if apply:
        await db.commit()
    else:
        await db.rollback()

    return created, kept


async def main(apply: bool) -> None:
    async with _session_factory() as db:
        created, kept = await seed(db, apply=apply)

    verb = "APPLIED" if apply else "DRY RUN (nothing written)"
    print(f"{verb}: {len(created)} to create, {len(kept)} already present")
    for line in created:
        print("  + " + line)
    for line in kept:
        print("  = " + line)
    await _engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--apply", action="store_true", help="write the changes (default is a dry run)"
    )
    asyncio.run(main(parser.parse_args().apply))
