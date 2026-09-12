import uuid

from app.users.models import User, UserRole


async def _make_admin(db_session, auth_user_id: uuid.UUID) -> User:
    """Provision an ADMIN user directly, keyed the same way `get_or_provision_user`
    keys real logins (by auth_user_id) — there is no admin-assignment endpoint yet."""
    user = User(auth_user_id=auth_user_id, email="admin@example.test", role=UserRole.ADMIN)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def test_public_list_only_shows_active_templates(client, db_session, auth_headers):
    admin_auth_id = uuid.uuid4()
    await _make_admin(db_session, admin_auth_id)
    admin_headers = auth_headers(str(admin_auth_id))

    create_resp = await client.post(
        "/v1/templates",
        headers=admin_headers,
        json={"slug": "classic-invite", "name": "Classic Invite", "category": "wedding"},
    )
    assert create_resp.status_code == 201
    template_id = create_resp.json()["data"]["id"]
    assert create_resp.json()["data"]["status"] == "DRAFT"

    # Not active yet (no published version) -> hidden from the public list.
    before_resp = await client.get("/v1/templates")
    assert before_resp.status_code == 200
    assert all(t["id"] != template_id for t in before_resp.json()["data"])

    version_resp = await client.post(
        f"/v1/templates/{template_id}/versions",
        headers=admin_headers,
        json={"schemaVersion": 1, "protocolVersion": 1, "schema": {"fields": []}},
    )
    assert version_resp.status_code == 201
    version_number = version_resp.json()["data"]["version"]
    assert version_number == 1
    assert version_resp.json()["data"]["status"] == "DRAFT"

    publish_resp = await client.post(
        f"/v1/templates/{template_id}/versions/{version_number}/publish", headers=admin_headers
    )
    assert publish_resp.status_code == 200
    assert publish_resp.json()["data"]["status"] == "PUBLISHED"

    # Publishing is idempotent.
    republish_resp = await client.post(
        f"/v1/templates/{template_id}/versions/{version_number}/publish", headers=admin_headers
    )
    assert republish_resp.status_code == 200
    assert republish_resp.json()["data"]["status"] == "PUBLISHED"

    after_resp = await client.get("/v1/templates")
    ids = [t["id"] for t in after_resp.json()["data"]]
    assert template_id in ids

    get_resp = await client.get(f"/v1/templates/{template_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["status"] == "ACTIVE"


async def test_non_admin_cannot_create_template(client, auth_headers):
    resp = await client.post(
        "/v1/templates", headers=auth_headers(), json={"slug": "nope", "name": "Nope"}
    )
    assert resp.status_code == 403


async def test_draft_version_hidden_from_non_admin(client, db_session, auth_headers):
    admin_auth_id = uuid.uuid4()
    await _make_admin(db_session, admin_auth_id)
    admin_headers = auth_headers(str(admin_auth_id))

    create_resp = await client.post(
        "/v1/templates", headers=admin_headers, json={"slug": "hidden-tpl", "name": "Hidden"}
    )
    template_id = create_resp.json()["data"]["id"]

    version_resp = await client.post(
        f"/v1/templates/{template_id}/versions",
        headers=admin_headers,
        json={"schemaVersion": 1, "protocolVersion": 1, "schema": {}},
    )
    version_number = version_resp.json()["data"]["version"]

    anon_resp = await client.get(f"/v1/templates/{template_id}/versions/{version_number}")
    assert anon_resp.status_code == 404

    non_admin_resp = await client.get(
        f"/v1/templates/{template_id}/versions/{version_number}", headers=auth_headers()
    )
    assert non_admin_resp.status_code == 404

    admin_resp = await client.get(
        f"/v1/templates/{template_id}/versions/{version_number}", headers=admin_headers
    )
    assert admin_resp.status_code == 200
    assert admin_resp.json()["data"]["status"] == "DRAFT"
