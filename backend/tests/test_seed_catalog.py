"""Tests for `scripts/seed_catalog.py`'s `seed()` — run against the same isolated
`db_session` fixture the app's own tests use (see conftest.py), not a throwaway
engine of its own, so a bad seed can't leak into any other test."""

import uuid

from sqlalchemy import select

from app.events.models import Event, EventStatus, EventType
from app.templates.models import Category, Currency, Template
from app.users.models import User
from scripts.seed_catalog import CATEGORIES, CURRENCIES, TEMPLATES, seed


async def test_seed_creates_everything_on_an_empty_database(db_session):
    created, kept = await seed(db_session, apply=True)

    assert kept == []
    assert len(created) == len(CURRENCIES) + len(CATEGORIES) + len(TEMPLATES)

    currencies = (await db_session.execute(select(Currency))).scalars().all()
    assert {c.code for c in currencies} == {c["code"] for c in CURRENCIES}

    categories = (await db_session.execute(select(Category))).scalars().all()
    assert {c.slug for c in categories} == {c["slug"] for c in CATEGORIES}

    templates = (await db_session.execute(select(Template))).scalars().all()
    assert {t.slug for t in templates} == {t["slug"] for t in TEMPLATES}

    paid = next(t for t in templates if t.slug == "tpl-samarpan-royal")
    assert paid.pricing_model == "PAID"
    assert paid.price_amount_minor == 149900
    assert paid.currency_id is not None
    assert paid.storefront_status == "LISTED"

    free = next(t for t in templates if t.slug == "tpl-eternal-bond")
    assert free.pricing_model == "FREE"
    assert free.price_amount_minor is None


async def test_seed_is_idempotent(db_session):
    await seed(db_session, apply=True)

    created, kept = await seed(db_session, apply=True)

    assert created == []
    assert len(kept) == len(CURRENCIES) + len(CATEGORIES) + len(TEMPLATES)
    # No duplicates — still exactly one row per slug/code.
    templates = (await db_session.execute(select(Template))).scalars().all()
    assert len(templates) == len(TEMPLATES)
    currencies = (await db_session.execute(select(Currency))).scalars().all()
    assert len(currencies) == len(CURRENCIES)


async def test_seed_never_overwrites_an_admin_edit(db_session):
    """An admin's later edits to name/price/visibility are never overwritten —
    `seed()` only creates what's missing, matched by slug."""
    await seed(db_session, apply=True)

    template = (
        await db_session.execute(select(Template).where(Template.slug == "tpl-eternal-bond"))
    ).scalar_one()
    template.name = "Renamed By Admin"
    template.storefront_status = "UNLISTED"
    await db_session.commit()

    created, kept = await seed(db_session, apply=True)

    assert created == []
    assert "template tpl-eternal-bond" in kept

    template = (
        await db_session.execute(select(Template).where(Template.slug == "tpl-eternal-bond"))
    ).scalar_one()
    assert template.name == "Renamed By Admin"
    assert template.storefront_status == "UNLISTED"


async def test_dry_run_writes_nothing(db_session):
    created, kept = await seed(db_session, apply=False)

    assert kept == []
    assert len(created) == len(CURRENCIES) + len(CATEGORIES) + len(TEMPLATES)

    assert (await db_session.execute(select(Template))).first() is None
    assert (await db_session.execute(select(Category))).first() is None
    assert (await db_session.execute(select(Currency))).first() is None


async def test_seed_renames_a_legacy_couple_named_slug_and_repoints_its_event(db_session):
    """`tpl-harpreet-ritika` was renamed to `tpl-rosewood-punjabi`; an already-seeded
    database (and any event a user already created against the old slug) moves over
    in place instead of ending up with two rows for the same template."""
    category = Category(slug="wedding", name="Wedding", display_order=1)
    db_session.add(category)
    await db_session.flush()

    legacy_template = Template(
        slug="tpl-harpreet-ritika",
        name="Rosewood — Punjabi Wedding",
        category_id=category.id,
        pricing_model="FREE",
        storefront_status="LISTED",
    )
    db_session.add(legacy_template)

    owner = User(auth_user_id=uuid.uuid4(), email="owner@example.test")
    db_session.add(owner)
    await db_session.flush()

    event = Event(
        owner_id=owner.id,
        type=EventType.WEDDING,
        title="tpl-harpreet-ritika",
        slug="tpl-harpreet-ritika-abc123",
        status=EventStatus.DRAFT,
    )
    db_session.add(event)
    await db_session.commit()

    created, _kept = await seed(db_session, apply=True)

    renamed_line = "rename template tpl-harpreet-ritika -> tpl-rosewood-punjabi"
    assert any(renamed_line in line for line in created)
    # The renamed row satisfied the target slug — seed() must not also create a
    # fresh tpl-rosewood-punjabi alongside it.
    assert not any(line == "template tpl-rosewood-punjabi" for line in created)

    templates = (await db_session.execute(select(Template))).scalars().all()
    slugs = [t.slug for t in templates]
    assert "tpl-rosewood-punjabi" in slugs
    assert "tpl-harpreet-ritika" not in slugs
    assert slugs.count("tpl-rosewood-punjabi") == 1
    # The renamed row is the same one that already existed (id unchanged), not a
    # freshly-created one, so anything else referencing its id still resolves.
    renamed = next(t for t in templates if t.slug == "tpl-rosewood-punjabi")
    assert renamed.id == legacy_template.id

    await db_session.refresh(event)
    assert event.title == "tpl-rosewood-punjabi"


async def test_seed_skips_rename_if_the_new_slug_already_exists(db_session):
    """Both the legacy and the new-name row already present (e.g. a previous partial
    run) — seed() must not touch either rather than risk merging or duplicating them."""
    category = Category(slug="wedding", name="Wedding", display_order=1)
    db_session.add(category)
    await db_session.flush()

    db_session.add(
        Template(
            slug="tpl-karan-nisha",
            name="Old",
            category_id=category.id,
            pricing_model="FREE",
            storefront_status="LISTED",
        )
    )
    db_session.add(
        Template(
            slug="tpl-maroon-gold-royal",
            name="New",
            category_id=category.id,
            pricing_model="FREE",
            storefront_status="LISTED",
        )
    )
    await db_session.commit()

    created, _kept = await seed(db_session, apply=True)

    assert not any("rename template tpl-karan-nisha" in line for line in created)
    templates = (await db_session.execute(select(Template))).scalars().all()
    slugs = [t.slug for t in templates]
    assert slugs.count("tpl-karan-nisha") == 1
    assert slugs.count("tpl-maroon-gold-royal") == 1
