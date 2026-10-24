import uuid

from app.users.models import User, UserRole


async def _make_admin(db_session, auth_user_id: uuid.UUID) -> User:
    user = User(auth_user_id=auth_user_id, email="admin@example.test", role=UserRole.ADMIN)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def test_non_admin_cannot_list_audit_logs(client, auth_headers):
    resp = await client.get("/v1/admin/audit-logs", headers=auth_headers())
    assert resp.status_code == 403


async def test_creating_an_event_is_audited_and_readable_by_an_admin(
    client, db_session, auth_headers
):
    owner_headers = auth_headers()
    create_resp = await client.post(
        "/v1/events", headers=owner_headers, json={"title": "Audited Wedding"}
    )
    assert create_resp.status_code == 201
    event_id = create_resp.json()["data"]["id"]

    admin_auth_id = uuid.uuid4()
    await _make_admin(db_session, admin_auth_id)
    admin_headers = auth_headers(str(admin_auth_id))

    list_resp = await client.get("/v1/admin/audit-logs", headers=admin_headers)
    assert list_resp.status_code == 200
    body = list_resp.json()
    actions = {row["action"] for row in body["data"]}
    assert "EVENT_CREATED" in actions

    matching = [row for row in body["data"] if row["resourceId"] == event_id]
    assert len(matching) == 1
    assert matching[0]["action"] == "EVENT_CREATED"
    assert matching[0]["resourceType"] == "event"


async def test_audit_logs_filter_by_resource_type(client, db_session, auth_headers):
    owner_headers = auth_headers()
    await client.post("/v1/events", headers=owner_headers, json={"title": "Filter Me"})

    admin_auth_id = uuid.uuid4()
    await _make_admin(db_session, admin_auth_id)
    admin_headers = auth_headers(str(admin_auth_id))

    resp = await client.get(
        "/v1/admin/audit-logs", headers=admin_headers, params={"resource_type": "event"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]
    assert all(row["resourceType"] == "event" for row in body["data"])

    empty_resp = await client.get(
        "/v1/admin/audit-logs", headers=admin_headers, params={"resource_type": "nonexistent"}
    )
    assert empty_resp.status_code == 200
    assert empty_resp.json()["data"] == []
