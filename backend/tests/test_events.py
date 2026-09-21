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


async def test_only_one_active_event_per_template(client, auth_headers):
    """`title` is the template slot id for events created from the editor — reopening
    the editor, a second tab, or a cleared localStorage cache must resume the same
    draft, not fork a new one."""
    headers = auth_headers()

    first = await client.post(
        "/v1/events", headers=headers, json={"type": "WEDDING", "title": "tpl-eternal-bond"}
    )
    assert first.status_code == 201
    first_event = first.json()["data"]

    second = await client.post(
        "/v1/events", headers=headers, json={"type": "WEDDING", "title": "tpl-eternal-bond"}
    )
    assert second.status_code == 201
    assert second.json()["data"]["id"] == first_event["id"]

    list_resp = await client.get("/v1/events", headers=headers)
    matching = [e for e in list_resp.json()["data"] if e["title"] == "tpl-eternal-bond"]
    assert len(matching) == 1


async def test_new_template_event_allowed_after_archiving_the_old_one(client, auth_headers):
    headers = auth_headers()

    first = await client.post("/v1/events", headers=headers, json={"title": "tpl-golden-promise"})
    first_id = first.json()["data"]["id"]
    await client.delete(f"/v1/events/{first_id}", headers=headers)

    second = await client.post("/v1/events", headers=headers, json={"title": "tpl-golden-promise"})
    assert second.status_code == 201
    second_event = second.json()["data"]
    assert second_event["id"] != first_id
    assert second_event["status"] == "DRAFT"


async def test_template_event_dedup_is_per_owner(client, auth_headers):
    owner_a = auth_headers()
    owner_b = auth_headers()

    a = await client.post("/v1/events", headers=owner_a, json={"title": "tpl-beloved-nikkah"})
    b = await client.post("/v1/events", headers=owner_b, json={"title": "tpl-beloved-nikkah"})
    assert a.json()["data"]["id"] != b.json()["data"]["id"]


async def test_non_template_titles_are_not_deduped(client, auth_headers):
    """Only 'tpl-*' titles (the editor's convention) are deduped — a freeform title
    like a custom event name can legitimately repeat."""
    headers = auth_headers()

    a = await client.post("/v1/events", headers=headers, json={"title": "Birthday Bash"})
    b = await client.post("/v1/events", headers=headers, json={"title": "Birthday Bash"})
    assert a.json()["data"]["id"] != b.json()["data"]["id"]
