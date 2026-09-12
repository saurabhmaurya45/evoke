async def test_get_draft_right_after_creating_event(client, auth_headers):
    headers = auth_headers()
    create_resp = await client.post("/v1/events", headers=headers, json={"title": "Draft Event"})
    event_id = create_resp.json()["data"]["id"]

    draft_resp = await client.get(f"/v1/events/{event_id}/draft", headers=headers)
    assert draft_resp.status_code == 200
    draft = draft_resp.json()["data"]
    assert draft["eventId"] == event_id
    assert draft["data"] == {}
    assert draft["revision"] == 0


async def test_save_draft_with_correct_revision_increments(client, auth_headers):
    headers = auth_headers()
    create_resp = await client.post("/v1/events", headers=headers, json={"title": "Draft Event"})
    event_id = create_resp.json()["data"]["id"]

    save_resp = await client.put(
        f"/v1/events/{event_id}/draft",
        headers=headers,
        json={"data": {"hero": {"title": "Hi"}}, "revision": 0},
    )
    assert save_resp.status_code == 200
    body = save_resp.json()["data"]
    assert body["revision"] == 1
    assert body["data"] == {"hero": {"title": "Hi"}}

    second_save = await client.put(
        f"/v1/events/{event_id}/draft",
        headers=headers,
        json={"data": {"hero": {"title": "Hi again"}}, "revision": 1},
    )
    assert second_save.status_code == 200
    assert second_save.json()["data"]["revision"] == 2


async def test_save_draft_with_stale_revision_conflicts(client, auth_headers):
    headers = auth_headers()
    create_resp = await client.post("/v1/events", headers=headers, json={"title": "Draft Event"})
    event_id = create_resp.json()["data"]["id"]

    await client.put(
        f"/v1/events/{event_id}/draft", headers=headers, json={"data": {"a": 1}, "revision": 0}
    )

    stale_resp = await client.put(
        f"/v1/events/{event_id}/draft", headers=headers, json={"data": {"a": 2}, "revision": 0}
    )
    assert stale_resp.status_code == 409
    assert stale_resp.json()["error"]["code"] == "DRAFT_CONFLICT"


async def test_other_user_cannot_access_someone_elses_draft(client, auth_headers):
    owner_headers = auth_headers()
    create_resp = await client.post(
        "/v1/events", headers=owner_headers, json={"title": "Private Draft"}
    )
    event_id = create_resp.json()["data"]["id"]

    other_headers = auth_headers()

    get_resp = await client.get(f"/v1/events/{event_id}/draft", headers=other_headers)
    assert get_resp.status_code == 403

    put_resp = await client.put(
        f"/v1/events/{event_id}/draft",
        headers=other_headers,
        json={"data": {}, "revision": 0},
    )
    assert put_resp.status_code == 403
