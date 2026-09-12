async def test_create_event_appears_in_list(client, auth_headers):
    headers = auth_headers()

    create_resp = await client.post(
        "/v1/events", headers=headers, json={"type": "WEDDING", "title": "Diya & Arjun"}
    )
    assert create_resp.status_code == 201
    event = create_resp.json()["data"]
    assert event["title"] == "Diya & Arjun"
    assert event["type"] == "WEDDING"
    assert event["status"] == "DRAFT"
    assert event["slug"]

    list_resp = await client.get("/v1/events", headers=headers)
    assert list_resp.status_code == 200
    body = list_resp.json()
    ids = [e["id"] for e in body["data"]]
    assert event["id"] in ids
    assert body["pagination"]["total"] >= 1


async def test_get_event_by_id(client, auth_headers):
    headers = auth_headers()
    create_resp = await client.post("/v1/events", headers=headers, json={"title": "Birthday Bash"})
    event_id = create_resp.json()["data"]["id"]

    get_resp = await client.get(f"/v1/events/{event_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["id"] == event_id


async def test_update_event_title(client, auth_headers):
    headers = auth_headers()
    create_resp = await client.post("/v1/events", headers=headers, json={"title": "Old Title"})
    event_id = create_resp.json()["data"]["id"]

    update_resp = await client.patch(
        f"/v1/events/{event_id}", headers=headers, json={"title": "New Title"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["data"]["title"] == "New Title"


async def test_other_user_cannot_access_someone_elses_event(client, auth_headers):
    owner_headers = auth_headers()
    create_resp = await client.post("/v1/events", headers=owner_headers, json={"title": "Private"})
    event_id = create_resp.json()["data"]["id"]

    other_headers = auth_headers()

    get_resp = await client.get(f"/v1/events/{event_id}", headers=other_headers)
    assert get_resp.status_code == 403

    patch_resp = await client.patch(
        f"/v1/events/{event_id}", headers=other_headers, json={"title": "Hacked"}
    )
    assert patch_resp.status_code == 403

    delete_resp = await client.delete(f"/v1/events/{event_id}", headers=other_headers)
    assert delete_resp.status_code == 403


async def test_archive_event_via_delete(client, auth_headers):
    headers = auth_headers()
    create_resp = await client.post("/v1/events", headers=headers, json={"title": "To Archive"})
    event_id = create_resp.json()["data"]["id"]

    delete_resp = await client.delete(f"/v1/events/{event_id}", headers=headers)
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/v1/events/{event_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["status"] == "ARCHIVED"
