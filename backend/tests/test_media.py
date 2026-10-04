import uuid

import pytest

from app.media.models import MediaStatus
from app.shared.storage.b2_client import B2Client, get_b2_client
from app.templates.models import Template, TemplateStatus
from app.users.models import User, UserRole


async def _make_admin(db_session, auth_user_id: uuid.UUID) -> User:
    user = User(auth_user_id=auth_user_id, email="admin@example.test", role=UserRole.ADMIN)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _make_template(db_session) -> Template:
    template = Template(
        slug=f"tpl-media-test-{uuid.uuid4().hex[:8]}",
        name="Media Test Template",
        status=TemplateStatus.ACTIVE,
        storefront_status="LISTED",
    )
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)
    return template


async def _make_event(client, headers) -> dict:
    resp = await client.post("/v1/events", headers=headers, json={"title": "Media Test Event"})
    assert resp.status_code == 201
    return resp.json()["data"]


class FakeB2Client(B2Client):
    """A B2Client that never calls boto3 — presigns deterministically and lets
    tests control head_object's return value per upload id."""

    def __init__(self) -> None:
        # Deliberately skip B2Client.__init__ (no real boto3 clients needed).
        self.bucket = "test-bucket"
        self.put_calls: list[tuple[str, str, int]] = []
        self.get_calls: list[tuple[str, int]] = []
        self.head_response: dict | None = {"ContentLength": 0}
        self.head_object_error: Exception | None = None

    def presign_put(self, key: str, content_type: str, expires_in: int) -> str:
        self.put_calls.append((key, content_type, expires_in))
        return f"https://fake-b2.invalid/{key}?put-signed"

    def presign_get(self, key: str, expires_in: int) -> str:
        self.get_calls.append((key, expires_in))
        return f"https://fake-b2.invalid/{key}?get-signed"

    def head_object(self, key: str) -> dict | None:
        if self.head_object_error is not None:
            raise self.head_object_error
        return self.head_response


@pytest.fixture
def b2(client):
    from app.main import app

    fake = FakeB2Client()
    app.dependency_overrides[get_b2_client] = lambda: fake
    return fake


async def test_admin_can_request_base_upload_for_existing_template(
    client, db_session, auth_headers, b2
):
    admin_auth_id = uuid.uuid4()
    await _make_admin(db_session, admin_auth_id)
    template = await _make_template(db_session)

    resp = await client.post(
        "/v1/media/upload",
        headers=auth_headers(str(admin_auth_id)),
        json={
            "ownerKind": "BASE",
            "ownerId": str(template.id),
            "mediaType": "IMAGE",
            "contentType": "image/jpeg",
            "fileName": "hero.jpg",
            "fileSizeBytes": 1000,
        },
    )
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["uploadUrl"].startswith("https://fake-b2.invalid/")
    assert body["storagePath"].startswith(f"asset/{template.id}/image/")
    assert body["requiredHeaders"] == {"Content-Type": "image/jpeg"}
    assert len(b2.put_calls) == 1


async def test_non_admin_cannot_request_base_upload(client, db_session, auth_headers, b2):
    template = await _make_template(db_session)

    resp = await client.post(
        "/v1/media/upload",
        headers=auth_headers(),
        json={
            "ownerKind": "BASE",
            "ownerId": str(template.id),
            "mediaType": "IMAGE",
            "contentType": "image/jpeg",
            "fileName": "hero.jpg",
            "fileSizeBytes": 1000,
        },
    )
    assert resp.status_code == 403
    assert b2.put_calls == []


async def test_base_upload_for_unknown_template_is_404(client, db_session, auth_headers, b2):
    admin_auth_id = uuid.uuid4()
    await _make_admin(db_session, admin_auth_id)

    resp = await client.post(
        "/v1/media/upload",
        headers=auth_headers(str(admin_auth_id)),
        json={
            "ownerKind": "BASE",
            "ownerId": str(uuid.uuid4()),
            "mediaType": "IMAGE",
            "contentType": "image/jpeg",
            "fileName": "hero.jpg",
            "fileSizeBytes": 1000,
        },
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TEMPLATE_NOT_FOUND"


async def test_owner_can_request_user_upload_for_own_event(client, auth_headers, b2):
    headers = auth_headers()
    event = await _make_event(client, headers)

    resp = await client.post(
        "/v1/media/upload",
        headers=headers,
        json={
            "ownerKind": "USER",
            "ownerId": event["id"],
            "mediaType": "VIDEO",
            "contentType": "video/mp4",
            "fileName": "clip.mp4",
            "fileSizeBytes": 2000,
        },
    )
    assert resp.status_code == 201
    body = resp.json()["data"]
    assert body["storagePath"].startswith(f"public/{event['ownerId']}/{event['id']}/video/")


async def test_non_owner_cannot_request_user_upload_404_not_403(client, auth_headers, b2):
    owner_headers = auth_headers()
    event = await _make_event(client, owner_headers)

    other_headers = auth_headers()
    resp = await client.post(
        "/v1/media/upload",
        headers=other_headers,
        json={
            "ownerKind": "USER",
            "ownerId": event["id"],
            "mediaType": "IMAGE",
            "contentType": "image/png",
            "fileName": "photo.png",
            "fileSizeBytes": 1000,
        },
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "EVENT_NOT_FOUND"
    assert b2.put_calls == []


async def test_user_upload_for_unknown_event_is_404(client, auth_headers, b2):
    resp = await client.post(
        "/v1/media/upload",
        headers=auth_headers(),
        json={
            "ownerKind": "USER",
            "ownerId": str(uuid.uuid4()),
            "mediaType": "IMAGE",
            "contentType": "image/png",
            "fileName": "photo.png",
            "fileSizeBytes": 1000,
        },
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "EVENT_NOT_FOUND"


async def test_wrong_content_type_for_media_type_is_422(client, auth_headers, b2):
    headers = auth_headers()
    event = await _make_event(client, headers)

    resp = await client.post(
        "/v1/media/upload",
        headers=headers,
        json={
            "ownerKind": "USER",
            "ownerId": event["id"],
            "mediaType": "IMAGE",
            "contentType": "video/mp4",
            "fileName": "photo.png",
            "fileSizeBytes": 1000,
        },
    )
    assert resp.status_code == 422


async def test_oversized_file_is_422(client, auth_headers, b2):
    headers = auth_headers()
    event = await _make_event(client, headers)

    resp = await client.post(
        "/v1/media/upload",
        headers=headers,
        json={
            "ownerKind": "USER",
            "ownerId": event["id"],
            "mediaType": "IMAGE",
            "contentType": "image/png",
            "fileName": "photo.png",
            "fileSizeBytes": 6 * 1024 * 1024,  # cap is 5MB for IMAGE
        },
    )
    assert resp.status_code == 422


async def test_upload_returns_503_when_b2_not_configured(client, auth_headers):
    from app.main import app

    app.dependency_overrides[get_b2_client] = lambda: None

    headers = auth_headers()
    event = await _make_event(client, headers)

    resp = await client.post(
        "/v1/media/upload",
        headers=headers,
        json={
            "ownerKind": "USER",
            "ownerId": event["id"],
            "mediaType": "IMAGE",
            "contentType": "image/png",
            "fileName": "photo.png",
            "fileSizeBytes": 1000,
        },
    )
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "MEDIA_STORAGE_NOT_CONFIGURED"


# --- /upload/ack -------------------------------------------------------------


async def _request_upload(
    client, headers, event_id, *, media_type="IMAGE", content_type="image/png", size=1000
):
    resp = await client.post(
        "/v1/media/upload",
        headers=headers,
        json={
            "ownerKind": "USER",
            "ownerId": event_id,
            "mediaType": media_type,
            "contentType": content_type,
            "fileName": "photo.png",
            "fileSizeBytes": size,
        },
    )
    assert resp.status_code == 201
    return resp.json()["data"]


async def test_successful_ack_flips_to_uploaded(client, auth_headers, b2):
    headers = auth_headers()
    event = await _make_event(client, headers)
    upload = await _request_upload(client, headers, event["id"])
    b2.head_response = {"ContentLength": 1000}

    resp = await client.post(
        "/v1/media/upload/ack",
        headers=headers,
        json={"uploadId": upload["uploadId"], "status": "SUCCESS"},
    )
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["status"] == "UPLOADED"
    assert body["storagePath"] == upload["storagePath"]


async def test_template_with_no_thumbnail_returns_null_not_a_presign_call(client, db_session, b2):
    template = await _make_template(db_session)

    resp = await client.get(f"/v1/templates/{template.id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["thumbnailUrl"] is None
    assert resp.json()["data"]["previewUrl"] is None
    assert b2.get_calls == []


async def test_ack_success_writes_back_onto_template_for_base_owner(
    client, db_session, auth_headers, b2
):
    admin_auth_id = uuid.uuid4()
    await _make_admin(db_session, admin_auth_id)
    template = await _make_template(db_session)
    headers = auth_headers(str(admin_auth_id))

    upload_resp = await client.post(
        "/v1/media/upload",
        headers=headers,
        json={
            "ownerKind": "BASE",
            "ownerId": str(template.id),
            "mediaType": "IMAGE",
            "contentType": "image/jpeg",
            "fileName": "thumb.jpg",
            "fileSizeBytes": 1000,
        },
    )
    upload = upload_resp.json()["data"]
    b2.head_response = {"ContentLength": 1000}

    ack_resp = await client.post(
        "/v1/media/upload/ack",
        headers=headers,
        json={"uploadId": upload["uploadId"], "status": "SUCCESS", "targetField": "thumbnail"},
    )
    assert ack_resp.status_code == 200

    get_resp = await client.get(f"/v1/templates/{template.id}")
    assert get_resp.json()["data"]["thumbnailUrl"] is not None
    assert "get-signed" in get_resp.json()["data"]["thumbnailUrl"]


async def test_ack_success_object_missing_in_storage_is_422_and_stays_pending(
    client, auth_headers, b2
):
    headers = auth_headers()
    event = await _make_event(client, headers)
    upload = await _request_upload(client, headers, event["id"])
    b2.head_response = None  # object not found

    resp = await client.post(
        "/v1/media/upload/ack",
        headers=headers,
        json={"uploadId": upload["uploadId"], "status": "SUCCESS"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UPLOAD_VERIFICATION_FAILED" or resp.json()["error"][
        "code"
    ] == "VALIDATION_FAILED"

    # Re-ack after "uploading" succeeds, proving the row genuinely stayed PENDING.
    b2.head_response = {"ContentLength": 1000}
    retry_resp = await client.post(
        "/v1/media/upload/ack",
        headers=headers,
        json={"uploadId": upload["uploadId"], "status": "SUCCESS"},
    )
    assert retry_resp.status_code == 200
    assert retry_resp.json()["data"]["status"] == "UPLOADED"


async def test_ack_success_oversized_actual_is_422(client, auth_headers, b2):
    headers = auth_headers()
    event = await _make_event(client, headers)
    upload = await _request_upload(client, headers, event["id"])
    b2.head_response = {"ContentLength": 6 * 1024 * 1024}  # exceeds IMAGE cap

    resp = await client.post(
        "/v1/media/upload/ack",
        headers=headers,
        json={"uploadId": upload["uploadId"], "status": "SUCCESS"},
    )
    assert resp.status_code == 422


async def test_reacking_already_uploaded_is_idempotent_noop(client, auth_headers, b2):
    headers = auth_headers()
    event = await _make_event(client, headers)
    upload = await _request_upload(client, headers, event["id"])
    b2.head_response = {"ContentLength": 1000}

    first = await client.post(
        "/v1/media/upload/ack",
        headers=headers,
        json={"uploadId": upload["uploadId"], "status": "SUCCESS"},
    )
    assert first.status_code == 200

    b2.head_response = None  # if the ack re-ran verification, this would now fail
    second = await client.post(
        "/v1/media/upload/ack",
        headers=headers,
        json={"uploadId": upload["uploadId"], "status": "SUCCESS"},
    )
    assert second.status_code == 200
    assert second.json()["data"]["status"] == "UPLOADED"


async def test_acking_someone_elses_upload_is_403(client, auth_headers, b2):
    owner_headers = auth_headers()
    event = await _make_event(client, owner_headers)
    upload = await _request_upload(client, owner_headers, event["id"])

    other_headers = auth_headers()
    resp = await client.post(
        "/v1/media/upload/ack",
        headers=other_headers,
        json={"uploadId": upload["uploadId"], "status": "SUCCESS"},
    )
    assert resp.status_code == 403


async def test_acking_unknown_upload_id_is_404(client, auth_headers, b2):
    resp = await client.post(
        "/v1/media/upload/ack",
        headers=auth_headers(),
        json={"uploadId": str(uuid.uuid4()), "status": "SUCCESS"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "MEDIA_UPLOAD_NOT_FOUND"


async def test_failure_ack_flips_to_failed_and_retry_creates_new_row(
    client, auth_headers, db_session, b2
):
    from sqlalchemy import select

    from app.media.models import MediaAsset

    headers = auth_headers()
    event = await _make_event(client, headers)
    upload = await _request_upload(client, headers, event["id"])

    fail_resp = await client.post(
        "/v1/media/upload/ack",
        headers=headers,
        json={
            "uploadId": upload["uploadId"],
            "status": "FAILURE",
            "failureReason": "network timeout",
        },
    )
    assert fail_resp.status_code == 200
    assert fail_resp.json()["data"]["status"] == "FAILED"

    retry_upload = await _request_upload(client, headers, event["id"])
    assert retry_upload["uploadId"] != upload["uploadId"]

    rows = (
        await db_session.execute(
            select(MediaAsset).where(MediaAsset.owner_id == uuid.UUID(event["id"]))
        )
    ).scalars().all()
    assert len(rows) == 2
    statuses = {row.status for row in rows}
    assert MediaStatus.FAILED in statuses
    assert MediaStatus.PENDING in statuses


async def test_ack_success_b2_outage_during_verification_is_502_not_a_bare_500(
    client, auth_headers, b2
):
    from botocore.exceptions import ClientError

    headers = auth_headers()
    event = await _make_event(client, headers)
    upload = await _request_upload(client, headers, event["id"])
    b2.head_object_error = ClientError(
        {"Error": {"Code": "500", "Message": "internal error"}}, "HeadObject"
    )

    resp = await client.post(
        "/v1/media/upload/ack",
        headers=headers,
        json={"uploadId": upload["uploadId"], "status": "SUCCESS"},
    )
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "MEDIA_STORAGE_ERROR"
