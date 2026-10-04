import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.media.models import MediaOwnerKind, MediaStatus, MediaType
from app.shared.schema import CamelModel

# Per-mediaType allow-lists and size caps — confirmed values (see
# aidlc-docs/inception/application-design/media-upload-architecture.md §3, ADR-4).
# SVG is deliberately excluded from IMAGE: it can embed <script>, which would be
# served back with Content-Type: image/* and defeat the usual browser XSS guard
# against serving untrusted HTML.
#
# Not underscore-prefixed: app.media.service re-enforces SIZE_CAP_BYTES at
# ack time against the *actual* uploaded size (the real enforcement point — a
# presigned PUT cannot constrain upload size, only the declared value checked
# here at request time).
CONTENT_TYPE_ALLOW_LIST: dict[MediaType, set[str]] = {
    MediaType.IMAGE: {"image/png", "image/jpeg", "image/webp"},
    MediaType.VIDEO: {"video/mp4"},
    MediaType.MUSIC: {"audio/mpeg", "audio/mp4"},
}

SIZE_CAP_BYTES: dict[MediaType, int] = {
    MediaType.IMAGE: 5 * 1024 * 1024,
    MediaType.VIDEO: 10 * 1024 * 1024,
    MediaType.MUSIC: 5 * 1024 * 1024,
}


class MediaUploadRequest(CamelModel):
    """Request to presign a direct-to-bucket upload. The presign itself carries no
    authorization — all ownership/role checks happen here, before a URL is issued."""

    owner_kind: MediaOwnerKind = Field(
        description="BASE (ownerId is a template id, ADMIN only) or USER (ownerId is an "
        "event id owned by the caller)."
    )
    owner_id: uuid.UUID = Field(description="templates.id if ownerKind=BASE, events.id if USER.")
    media_type: MediaType
    content_type: str = Field(description="Declared MIME type. Must match mediaType's allow-list.")
    file_name: str = Field(description="Original file name — used only to preserve the extension.")
    file_size_bytes: int = Field(gt=0, description="Declared size. Must be within mediaType's cap.")

    @model_validator(mode="after")
    def _validate_content_type_and_size(self) -> "MediaUploadRequest":
        allowed = CONTENT_TYPE_ALLOW_LIST[self.media_type]
        if self.content_type not in allowed:
            raise ValueError(
                f"contentType {self.content_type!r} is not allowed for mediaType "
                f"{self.media_type.value} (allowed: {sorted(allowed)})."
            )
        cap = SIZE_CAP_BYTES[self.media_type]
        if self.file_size_bytes > cap:
            raise ValueError(
                f"fileSizeBytes exceeds the {cap // (1024 * 1024)}MB limit for mediaType "
                f"{self.media_type.value}."
            )
        return self


class MediaUploadOut(CamelModel):
    upload_id: uuid.UUID
    upload_url: str = Field(description="Presigned PUT URL. PUT the file here directly.")
    storage_path: str
    expires_at: datetime = Field(description="When uploadUrl stops being valid.")
    required_headers: dict[str, str] = Field(
        description="Headers the PUT request must send exactly — the presign signature is "
        "conditioned on them."
    )


class MediaAckRequest(CamelModel):
    upload_id: uuid.UUID
    status: Literal["SUCCESS", "FAILURE"]
    failure_reason: str | None = Field(
        default=None,
        description="Informational only (e.g. 'network timeout') — never trusted for state "
        "transitions.",
    )
    target_field: Literal["thumbnail", "preview"] | None = Field(
        default=None,
        description="For a BASE-owner upload only: which Template column to write the "
        "storagePath onto once verified (thumbnail_url or preview_url) — mediaType alone "
        "can't disambiguate the two. Ignored for USER-owner uploads; the frontend is "
        "responsible for saving the storagePath into the relevant draft field via the "
        "existing PUT /v1/events/{id}/draft.",
    )


class MediaAckOut(CamelModel):
    upload_id: uuid.UUID
    status: MediaStatus = Field(
        description="Server-confirmed final status — may differ from the request's declared "
        "status if verification failed."
    )
    storage_path: str
