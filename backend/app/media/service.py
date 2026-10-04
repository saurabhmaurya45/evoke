import logging
import uuid
from datetime import UTC, datetime, timedelta

from botocore.exceptions import ClientError
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.models import Event
from app.media.models import MediaAsset, MediaOwnerKind, MediaStatus
from app.media.paths import base_template_media_path, user_template_media_path
from app.media.schemas import SIZE_CAP_BYTES, MediaAckRequest, MediaUploadRequest
from app.shared.authorization import ensure_owner_or_admin
from app.shared.errors import AppError, AuthForbiddenError, NotFoundError
from app.shared.storage.b2_client import B2Client, require_client
from app.templates.models import Template
from app.users.models import User, UserRole

logger = logging.getLogger("evoke.media")

# A size tolerance, not an exact-match requirement: a client's pre-upload size
# estimate and the final on-disk size can legitimately differ slightly (encoder
# padding, etc.) — see architecture doc ADR-6's correction. 10% is generous enough
# to absorb that while still catching a materially different/falsified upload.
_SIZE_TOLERANCE = 0.10

_UPLOAD_PRESIGN_TTL_SECONDS = 10 * 60
_GET_PRESIGN_TTL_SECONDS = 15 * 60


async def _resolve_storage_path(
    db: AsyncSession, current_user: User, data: MediaUploadRequest
) -> str:
    """Validates ownership/role per owner_kind and returns the storage path to
    upload to. Raises before any B2 call if the caller isn't allowed."""
    if data.owner_kind == MediaOwnerKind.BASE:
        if current_user.role != UserRole.ADMIN:
            raise AuthForbiddenError("This action requires a different role.")
        template = await db.get(Template, data.owner_id)
        if template is None:
            raise NotFoundError("TEMPLATE_NOT_FOUND", "Template not found.")
        return base_template_media_path(template.id, data.media_type, data.file_name)

    event = await db.get(Event, data.owner_id)
    if event is None:
        raise NotFoundError("EVENT_NOT_FOUND", "Event not found.")
    ensure_owner_or_admin(
        current_user,
        event.owner_id,
        not_found_code="EVENT_NOT_FOUND",
        not_found_message="Event not found.",
    )
    return user_template_media_path(event.owner_id, event.id, data.media_type, data.file_name)


async def request_upload(
    db: AsyncSession, current_user: User, b2: B2Client | None, data: MediaUploadRequest
) -> tuple[MediaAsset, str]:
    """Validates the request, creates a PENDING MediaAsset, and presigns the PUT
    URL. Returns the asset plus the presigned URL (never persisted — see ADR-5)."""
    client = require_client(b2)
    storage_path = await _resolve_storage_path(db, current_user, data)

    now = datetime.now(UTC)
    asset = MediaAsset(
        owner_kind=data.owner_kind,
        owner_id=data.owner_id,
        media_type=data.media_type,
        storage_path=storage_path,
        bucket=client.bucket,
        original_file_name=data.file_name,
        content_type=data.content_type,
        declared_size_bytes=data.file_size_bytes,
        status=MediaStatus.PENDING,
        requested_by_user_id=current_user.id,
        presign_expires_at=now + timedelta(seconds=_UPLOAD_PRESIGN_TTL_SECONDS),
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    upload_url = client.presign_put(storage_path, data.content_type, _UPLOAD_PRESIGN_TTL_SECONDS)
    return asset, upload_url


def _verification_failed(reason: str, details: dict | None = None) -> AppError:
    """422 with its own code, so a client can tell "the upload didn't land — start
    again" apart from an ordinary invalid request (which is VALIDATION_FAILED)."""
    return AppError(
        "UPLOAD_VERIFICATION_FAILED",
        f"Upload verification failed: {reason}",
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        details,
    )


async def _get_asset_or_404(db: AsyncSession, upload_id: uuid.UUID) -> MediaAsset:
    asset = await db.get(MediaAsset, upload_id)
    if asset is None:
        raise NotFoundError("MEDIA_UPLOAD_NOT_FOUND", "Media upload not found.")
    return asset


async def _verify_and_mark_uploaded(
    db: AsyncSession, client: B2Client, asset: MediaAsset, target_field: str | None
) -> None:
    """HEAD-verifies the object B2-side before trusting the ack (see ADR-6) —
    the client's claimed status is never the trust signal on its own."""
    try:
        metadata = client.head_object(asset.storage_path)
    except ClientError as exc:
        logger.exception("B2 head_object failed during ack verification")
        raise AppError(
            "MEDIA_STORAGE_ERROR",
            "Could not verify the upload with storage. Please try again.",
            status.HTTP_502_BAD_GATEWAY,
        ) from exc
    if metadata is None:
        raise _verification_failed("the object was not found in storage.")

    actual_size = metadata["ContentLength"]
    cap = SIZE_CAP_BYTES[asset.media_type]
    within_declared_tolerance = actual_size <= asset.declared_size_bytes * (1 + _SIZE_TOLERANCE)
    if actual_size > cap or not within_declared_tolerance:
        raise _verification_failed(
            "the uploaded object's size does not match what was declared, or exceeds the "
            "allowed limit.",
            details={
                "actualSizeBytes": actual_size,
                "declaredSizeBytes": asset.declared_size_bytes,
            },
        )

    asset.actual_size_bytes = actual_size
    asset.status = MediaStatus.UPLOADED

    # Write-back is intentionally scoped to BASE-owner Template columns only —
    # see Dev Notes for why USER-owner (draft) media write-back is out of scope
    # for this story.
    if asset.owner_kind == MediaOwnerKind.BASE and target_field:
        template = await db.get(Template, asset.owner_id)
        if template is not None:
            if target_field == "thumbnail":
                template.thumbnail_url = asset.storage_path
            elif target_field == "preview":
                template.preview_url = asset.storage_path


async def ack_upload(
    db: AsyncSession, current_user: User, b2: B2Client | None, data: MediaAckRequest
) -> MediaAsset:
    asset = await _get_asset_or_404(db, data.upload_id)

    if current_user.role != UserRole.ADMIN and current_user.id != asset.requested_by_user_id:
        raise AuthForbiddenError("You do not own this upload.")

    if asset.status != MediaStatus.PENDING:
        # Idempotent no-op — a retry from a flaky client must never re-flip an
        # already-finalized row.
        return asset

    if data.status == "FAILURE":
        asset.status = MediaStatus.FAILED
        asset.failure_reason = data.failure_reason
        await db.commit()
        await db.refresh(asset)
        return asset

    client = require_client(b2)
    await _verify_and_mark_uploaded(db, client, asset, data.target_field)

    await db.commit()
    await db.refresh(asset)
    return asset


def _is_storage_path(value: str) -> bool:
    """True for an object key this pipeline wrote — see app.media.paths."""
    return value.startswith(("asset/", "public/"))


async def resolve_media_url(b2: B2Client | None, storage_path: str | None) -> str | None:
    """Resolves a stored storage_path to a presigned GET URL. Returns the input
    unchanged if there's no media set, or if B2 isn't configured (a template
    without B2 configured simply shows no media, rather than erroring).

    Also unchanged: a value that isn't a storage path at all — an absolute URL
    (`https://…`) or site-relative path (`/invitation-templates/…`) set before
    uploads existed. Presigning one of those as an object key would turn a
    working link into a signed URL for an object that doesn't exist."""
    if not storage_path or b2 is None or not _is_storage_path(storage_path):
        return storage_path
    return b2.presign_get(storage_path, _GET_PRESIGN_TTL_SECONDS)
