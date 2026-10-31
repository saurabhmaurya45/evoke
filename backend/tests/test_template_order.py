import uuid

from sqlalchemy import select

from app.shared.audit import AuditLog
from app.templates.models import Template, TemplateStatus
from app.users.models import User, UserRole


async def _admin_headers(db_session, auth_headers) -> dict[str, str]:
    auth_user_id = uuid.uuid4()
    db_session.add(User(auth_user_id=auth_user_id, email="admin@example.test", role=UserRole.ADMIN))
    await db_session.commit()
    return auth_headers(str(auth_user_id))


async def _make_templates(db_session, *slugs: str) -> dict[str, str]:
    templates = [
        Template(slug=slug, name=slug, status=TemplateStatus.ACTIVE, storefront_status="LISTED")
        for slug in slugs
    ]
    db_session.add_all(templates)
    await db_session.commit()
    return {t.slug: str(t.id) for t in templates}


async def test_reorder_sets_the_public_listing_order(client, db_session, auth_headers):
    headers = await _admin_headers(db_session, auth_headers)
    ids = await _make_templates(db_session, "a", "b", "c")

    resp = await client.put(
        "/v1/templates/order",
        headers=headers,
        json={"templateIds": [ids["c"], ids["a"], ids["b"]]},
    )
    assert resp.status_code == 200
    assert [t["slug"] for t in resp.json()["data"]] == ["c", "a", "b"]
    assert [t["displayOrder"] for t in resp.json()["data"]] == [1, 2, 3]

    listed = (await client.get("/v1/templates")).json()["data"]
    assert [t["slug"] for t in listed] == ["c", "a", "b"]
    assert [t["displayOrder"] for t in listed] == [1, 2, 3]

    logged = (
        await db_session.execute(select(AuditLog).where(AuditLog.action == "TEMPLATES_REORDERED"))
    ).scalars().all()
    assert len(logged) == 1


async def test_reorder_covers_unlisted_templates_too(client, db_session, auth_headers):
    headers = await _admin_headers(db_session, auth_headers)
    ids = await _make_templates(db_session, "a", "b")
    db_session.add(Template(slug="hidden", name="hidden"))
    await db_session.commit()
    hidden = (
        await db_session.execute(select(Template).where(Template.slug == "hidden"))
    ).scalar_one()

    resp = await client.put(
        "/v1/templates/order",
        headers=headers,
        json={"templateIds": [str(hidden.id), ids["b"], ids["a"]]},
    )
    assert resp.status_code == 200

    listed = (await client.get("/v1/templates")).json()["data"]
    assert [t["slug"] for t in listed] == ["b", "a"]


async def test_new_template_comes_first_until_placed(client, db_session, auth_headers):
    headers = await _admin_headers(db_session, auth_headers)
    ids = await _make_templates(db_session, "a", "b")
    await client.put(
        "/v1/templates/order", headers=headers, json={"templateIds": [ids["a"], ids["b"]]}
    )

    await _make_templates(db_session, "new")

    listed = (await client.get("/v1/templates")).json()["data"]
    assert [t["slug"] for t in listed] == ["new", "a", "b"]


async def test_reorder_rejects_a_list_missing_a_template(client, db_session, auth_headers):
    headers = await _admin_headers(db_session, auth_headers)
    ids = await _make_templates(db_session, "a", "b")

    resp = await client.put(
        "/v1/templates/order", headers=headers, json={"templateIds": [ids["a"]]}
    )
    assert resp.status_code == 422
    body = resp.json()["error"]
    assert "templateIds" in body["message"]
    assert body["details"]["missing"] == [ids["b"]]


async def test_reorder_rejects_an_unknown_template(client, db_session, auth_headers):
    headers = await _admin_headers(db_session, auth_headers)
    ids = await _make_templates(db_session, "a")
    unknown = str(uuid.uuid4())

    resp = await client.put(
        "/v1/templates/order", headers=headers, json={"templateIds": [ids["a"], unknown]}
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["details"]["unknown"] == [unknown]


async def test_reorder_rejects_duplicates_and_an_empty_list(client, db_session, auth_headers):
    headers = await _admin_headers(db_session, auth_headers)
    ids = await _make_templates(db_session, "a")

    duplicate = await client.put(
        "/v1/templates/order", headers=headers, json={"templateIds": [ids["a"], ids["a"]]}
    )
    assert duplicate.status_code == 422
    assert "templateIds" in str(duplicate.json()["error"])

    empty = await client.put("/v1/templates/order", headers=headers, json={"templateIds": []})
    assert empty.status_code == 422


async def test_reorder_needs_an_admin(client, db_session, auth_headers):
    ids = await _make_templates(db_session, "a")
    body = {"templateIds": [ids["a"]]}

    assert (await client.put("/v1/templates/order", json=body)).status_code == 401
    assert (
        await client.put("/v1/templates/order", headers=auth_headers(), json=body)
    ).status_code == 403
