from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.media.models import MediaStatus
from app.media.schemas import MediaAckOut, MediaAckRequest, MediaUploadOut, MediaUploadRequest
from app.media.service import ack_upload, presigned_get_url, request_upload
from app.shared.auth.dependencies import get_current_user
from app.shared.database import get_db
from app.shared.envelope import Envelope
from app.shared.openapi_responses import (
    FORBIDDEN,
    UNAUTHORIZED,
    merge,
    not_found,
    service_unavailable,
    validation_failed,
)
from app.shared.storage.b2_client import B2Client, get_b2_client
from app.users.models import User

router = APIRouter(prefix="/v1/media", tags=["media"])

_NOT_CONFIGURED = service_unavailable(
    "MEDIA_STORAGE_NOT_CONFIGURED", "Media storage is not configured on this server."
)


@router.post(
    "/upload",
    response_model=Envelope[MediaUploadOut],
    status_code=status.HTTP_201_CREATED,
    summary="Request a presigned media upload URL",
    responses=merge(
        UNAUTHORIZED,
        FORBIDDEN,
        not_found(
            "TEMPLATE_NOT_FOUND / EVENT_NOT_FOUND",
            "The referenced template or event doesn't exist (or, for an event you don't "
            "own, is reported as not found rather than forbidden — see ownerKind=USER).",
        ),
        validation_failed(
            "contentType is not in the allow-list for mediaType, or fileSizeBytes exceeds "
            "the per-mediaType cap."
        ),
        _NOT_CONFIGURED,
    ),
)
async def request_upload_route(
    data: MediaUploadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    b2: B2Client | None = Depends(get_b2_client),
) -> Envelope[MediaUploadOut]:
    """Validates the caller's authorization for the given `ownerKind`/`ownerId`
    (ADMIN for a template, or ownership for an event), then returns a presigned
    PUT URL for the client to upload directly to object storage.

    `ownerKind=BASE` requires ADMIN and an existing template. `ownerKind=USER`
    requires `ownerId` to resolve to an event owned by the caller — a
    non-existent or not-owned event both return `404`, never `403`, so
    existence isn't leaked to a non-owner.

    The returned `uploadUrl` expires in 10 minutes. After uploading, call
    `POST /v1/media/upload/ack` to report success or failure — the upload is
    not considered complete, and nothing references it, until that ack is
    verified server-side.
    """
    asset, upload_url = await request_upload(db, current_user, b2, data)
    return Envelope(
        data=MediaUploadOut(
            upload_id=asset.id,
            upload_url=upload_url,
            storage_path=asset.storage_path,
            expires_at=asset.presign_expires_at,
            required_headers={"Content-Type": asset.content_type},
        )
    )


@router.post(
    "/upload/ack",
    response_model=Envelope[MediaAckOut],
    summary="Report the outcome of a presigned upload",
    responses=merge(
        UNAUTHORIZED,
        FORBIDDEN,
        not_found("MEDIA_UPLOAD_NOT_FOUND", "No upload exists with this id."),
        validation_failed(
            "status=SUCCESS was reported, but the object could not be verified in storage "
            "(missing, or its actual size doesn't match what was declared / exceeds the cap)."
        ),
        _NOT_CONFIGURED,
    ),
)
async def ack_upload_route(
    data: MediaAckRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    b2: B2Client | None = Depends(get_b2_client),
) -> Envelope[MediaAckOut]:
    """Finalizes a presigned upload after the client has PUT the file to storage.

    On `status=SUCCESS`, the server independently verifies the object exists in
    storage (and its size is within limits) before marking it `UPLOADED` — the
    client's reported status is never trusted on its own. On `status=FAILURE`,
    the upload is marked `FAILED` immediately.

    Idempotent: acking an already-finalized upload (`UPLOADED` or `FAILED`)
    returns its current state unchanged rather than re-processing. Only the
    user who requested the upload (or an ADMIN) may ack it.
    """
    asset = await ack_upload(db, current_user, b2, data)
    uploaded = asset.status == MediaStatus.UPLOADED
    return Envelope(
        data=MediaAckOut(
            upload_id=asset.id,
            status=asset.status,
            storage_path=asset.storage_path,
            url=presigned_get_url(b2, asset.storage_path) if uploaded else None,
        )
    )
