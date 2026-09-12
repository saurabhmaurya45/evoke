async def test_me_requires_authentication(client):
    response = await client.get("/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_REQUIRED"


async def test_me_lazily_provisions_a_user(client, auth_headers):
    headers = auth_headers()

    response = await client.get("/v1/auth/me", headers=headers)

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["roles"] == ["USER"]
    assert body["profileCompleted"] is False
    assert "@example.test" in body["email"]


async def test_me_is_idempotent_for_the_same_identity(client, auth_headers):
    headers = auth_headers("11111111-1111-1111-1111-111111111111")

    first = await client.get("/v1/auth/me", headers=headers)
    second = await client.get("/v1/auth/me", headers=headers)

    assert first.json()["data"]["id"] == second.json()["data"]["id"]


async def test_update_profile_marks_profile_completed(client, auth_headers):
    headers = auth_headers()
    await client.get("/v1/auth/me", headers=headers)  # provision first

    response = await client.patch(
        "/v1/users/me",
        headers=headers,
        json={"firstName": "Diya", "lastName": "Sharma"},
    )

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["firstName"] == "Diya"
    assert body["lastName"] == "Sharma"
    assert body["profileCompleted"] is True


async def test_different_identities_get_different_users(client, auth_headers):
    a = await client.get("/v1/auth/me", headers=auth_headers())
    b = await client.get("/v1/auth/me", headers=auth_headers())

    assert a.json()["data"]["id"] != b.json()["data"]["id"]
