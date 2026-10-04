---
stepsCompleted: [design]
inputDocuments:
  - backend/app/templates/models.py
  - backend/app/templates/schemas.py
  - backend/app/templates/service.py
  - backend/app/templates/router.py
  - backend/app/events/models.py
  - backend/app/drafts/models.py
  - backend/app/shared/errors.py
  - backend/app/shared/authorization.py
  - backend/app/shared/schema.py
  - backend/app/payments/razorpay_client.py
workflowType: 'architecture'
project_name: 'evoke'
date: '2026-10-03'
---

# Media Upload & Retrieval Architecture

**Scope:** Templates — Base (admin-authored) + User-Created (event drafts)
**Status:** ✅ Design confirmed, ready for story breakdown

## Contents

1. [Context & Scope](#1-context--scope)
2. [Requirements Recap](#2-requirements-recap)
3. [Architectural Decisions](#3-architectural-decisions)
4. [Data Model](#4-data-model)
5. [API Contracts](#5-api-contracts)
6. [Base ↔ User-Created Linkage](#6-linking-base--user-created-templates)
7. [Security Considerations](#7-security-considerations)
8. [Confirmed Decisions Log](#8-confirmed-decisions-log)
9. [Future Scope](#9-future-scope-explicitly-deferred)
10. [File Change Summary](#10-file-change-summary)

---

## 1. Context & Scope

Evoke has two template-authoring flows, and neither has a media pipeline today:

| Flow | Actor | How it works today | Gap |
|---|---|---|---|
| **Base template creation** | ADMIN | Creates a `Template` catalog row + immutable `TemplateVersion` (schema + defaults) | `Template.thumbnail_url` / `preview_url` are plain string columns — no upload path backs them |
| **User-created template** | End user | Picks a base template → app creates an `Event` + 1:1 `Draft` storing field data (`Draft.data`, validated against the base schema) | No media model at all — `Draft.data` just holds whatever URL strings the editor puts there |

This document designs the **missing piece only**: a shared storage/upload/retrieval layer on Backblaze B2 (S3-compatible), layered on top of the existing `templates` / `events` / `drafts` modules — not a replacement for them.

> **Out of scope:** Migrating the existing 114 MB of hand-authored static template bundles (`frontend/public/invitation-templates/`) to B2. That's a separate, already-scoped, binaries-only CDN offload with no DB involvement. This document covers *new* media uploaded through the product going forward.

---

## 2. Requirements Recap

**Path conventions** (as specified):

```
Base template media:          asset/{template_id}/{media_type}/{file_name}
User-created template media:  public/{user_id}/{template_id}/{media_type}/{file_name}
```

- `{media_type}` ∈ `{image, video, music, …}`
- A user-created template has its own id, linked to **(a)** its owner and **(b)** the base template it came from.

**Upload flow:**

```
POST /upload       →  server presigns a PUT URL
client PUTs file   →  direct to bucket
POST /upload/ack   →  client reports success/failure
server resolves    →  stored paths → signed URLs, on every template/draft read
```

**Deliverables:** data model · request/response contracts · base/derived linkage · ownership & validation rules · signed-URL generation & expiry · failure handling (abandoned uploads, bad acks, retries, expired presigns) · assumptions, tradeoffs, security notes.

---

## 3. Architectural Decisions

| # | Decision | One-line rationale |
|---|---|---|
| [ADR-1](#adr-1-user-created-template--existing-eventdraft-pair) | "User-created template" = existing `Event` + `Draft` pair | Reuses what already models "this user's instance of a template" |
| [ADR-2](#adr-2-new-mediaasset-table-owns-the-upload-lifecycle) | New `media_assets` table owns upload lifecycle + path | One table, many media slots per template/draft; state machine needs a durable home |
| [ADR-3](#adr-3-b2-via-boto3-two-credentials-split-by-pipeline-stage) | `boto3` against B2's S3-compatible API; two scoped credentials | Boring tech + least privilege, enforced by B2 itself |
| [ADR-4](#adr-4-upload-validates-everything-before-presigning) | `/upload` validates everything *before* presigning | The presigned URL carries zero authorization — auth happens once, up front |
| [ADR-5](#adr-5-signed-get-urls-are-computed-at-read-time-never-stored) | Signed GET URLs computed at read time, never stored | No staleness window; single private bucket, always signed |
| [ADR-6](#adr-6-uploadack-never-trusts-the-client) | `/upload/ack` never trusts the client's claimed status | A B2 `HEAD` check is the actual source of truth |
| [ADR-7](#adr-7-abandoned-uploads-are-swept-not-handled-inline) | Abandoned uploads handled by a sweep, not request-time logic | One mechanism covers both "never acked" and "presign expired" |

### ADR-1: User-created template = existing `Event`+`Draft` pair

**Decision.** No new "user template" entity. `Event.id` **is** the user-created-template id; `Event.owner_id` is the owner; `Event.template_id` is the base-template link. Media for the user flow is scoped by `{user_id}/{event_id}` — the user's *own* template id, never the shared base template's id, so two users building from the same base template can never collide in storage.

**Why not a new table.** `templates` means "the ADMIN-authored catalog" everywhere in this codebase (storefront status, pricing, category — all catalog-only concepts). Overloading it with user rows would force every public-gallery query to defend against user data leaking in. `Event` already *is* "this user's instance of a template."

<details>
<summary>Alternatives considered</summary>

- **New `UserTemplate` table mirroring `Template`** — rejected: duplicates `Event`'s purpose; two tables answering "what template is this user editing" invites drift.
- **Store media directly in `Draft.data` as base64** — rejected: JSON blob bloat, no CDN caching, defeats the purpose of object storage.
</details>

### ADR-2: New `MediaAsset` table owns the upload lifecycle

**Decision.** One new table, `media_assets`, owns the upload state machine (`PENDING → UPLOADED / FAILED / ABANDONED`) and the storage path. `Template.thumbnail_url` / `preview_url` and any `image`/`audio` field in `Draft.data` stay as **plain path strings**, resolved to signed URLs only at read time (ADR-5) — never stored as URLs.

**Why a separate table, not columns on `Template`/`Draft`.** A template can have several media items (thumbnail, preview, per-field images in `defaults`); a draft can have arbitrarily many image/video/audio fields per its schema. A single `*_url` column per slot doesn't scale to "however many media fields this schema declares." A dedicated table also gives the upload state machine a home that doesn't pollute unrelated domain tables.

<details>
<summary>Alternatives considered</summary>

- **Upload state in Redis/a queue instead of Postgres** — rejected: no Redis in this stack; `PENDING` rows must survive a restart since cleanup is a recurring batch job (ADR-7), not an in-memory timer.
</details>

### ADR-3: B2 via `boto3`, two credentials split by pipeline stage

**Decision.** Backblaze B2's S3-compatible API, accessed via `boto3` (not Backblaze's native SDK), wrapped in `app/shared/storage/b2_client.py` — same shape as `app/payments/razorpay_client.py`: explicit constructor credentials, a `get_b2_client() -> B2Client | None` factory, a `require_client()` guard raising `MEDIA_STORAGE_NOT_CONFIGURED` (503) when unset.

**Two B2 application keys** — confirmed, split along the *ingest vs. serve* boundary:

| Key | Capabilities | Used for |
|---|---|---|
| `TheInvitelyProducer` | read **+** write | The full upload pipeline: presigning `/upload` PUT **and** the `/upload/ack` `HEAD` verification (ADR-6) |
| `TheInvitelyConsumer` | read-only | The serving path only: presigning GET URLs whenever a template/draft read resolves a `storage_path` (ADR-5) |

`B2Client` wraps **two** `boto3` S3 client instances, not one: `presign_put()` / `head_object()` run on the Producer-keyed client (the full ingest pipeline — issue the URL, then verify what arrived); `presign_get()` runs on the Consumer-keyed client. The split is "which side of the pipeline," not "which HTTP verb" — `HEAD` sits with Producer because it's verifying an upload Producer initiated, not serving content. Consumer — the key embedded in every public read path — can never write or delete, even if it were compromised.

**Why `boto3` over Backblaze's native SDK.** Keeps the dependency a generic, widely-maintained S3 client; swapping B2 for another S3-compatible provider later only touches config, not code. "Boring technology."

<details>
<summary>Alternatives considered</summary>

- **Backblaze's native `b2sdk`** — rejected: no benefit over S3-compatible mode for pure presign/HEAD use, locks the codebase to a vendor SDK lifecycle.
- **Proxy uploads through the FastAPI backend (no presign)** — rejected: the brief specifies direct-to-bucket upload, and it's the right call regardless — Vercel's serverless Python functions have body-size and execution-time limits poorly suited to streaming large video through the function.
- **Single read+write key for everything** — rejected now that two scoped keys exist: would discard a least-privilege boundary B2 gives for free.
</details>

### ADR-4: `/upload` validates everything before presigning

**Decision.** All authorization happens once, server-side, at `/upload` time — never re-checked at PUT time (impossible; B2 doesn't know Evoke's users) and never re-checked at `/upload/ack` beyond "does this upload id belong to this caller" (ADR-6). The presigned URL's *only* security property is "can write to this exact key, for this short window."

**Validation order in `/upload`:**

| Step | Check | Layer | On failure |
|---|---|---|---|
| 1 | Caller is authenticated | `get_current_user` | 401 |
| 2 | Request declares `ownerKind: BASE \| USER` explicitly | schema | — *(forces the caller to disambiguate `Template.id` vs. `Event.id` — avoids guessing and a possible IDOR if the two id spaces ever collided)* |
| 3 | `BASE` → caller is ADMIN; `ownerId` resolves to a `Template` | service | 403 / `TEMPLATE_NOT_FOUND` |
| 4 | `USER` → `ownerId` resolves to an `Event` owned by caller | service, via `ensure_owner_or_admin` | **404** always — never 403, never leaks existence of another user's event (see ADR-4a) |
| 5 | `mediaType ∈ {IMAGE, VIDEO, MUSIC}`; `contentType` matches that type's allow-list | schema (`model_validator`) | 422 |
| 6 | `fileSizeBytes` within the per-type cap — **5 MB image · 10 MB video · 5 MB audio** | schema | 422 |

**Correction (caught during implementation planning):** A presigned **PUT** URL (unlike a presigned **POST** policy document) can only constrain `Content-Type` — S3-compatible presigned PUT has no `Content-Length-Range` condition; that constraint is a POST-policy-only feature. So:
- **`contentType` enforcement is real** — generated with `ContentType` bound into the signature; the client's PUT must send the exact matching header or B2 rejects it with a signature mismatch. This closes the "lie about `contentType`" gap at the protocol level, not just in application validation.
- **`fileSizeBytes` enforcement is NOT real at PUT time** — a dishonest client can PUT more or less data than declared; B2 will accept it. The actual size enforcement point is the **`HEAD` check in `/upload/ack`** (ADR-6, step 4): the server compares `actual_size_bytes` (from B2's object metadata) against `declared_size_bytes`/the type's cap, and rejects the ack (`422`) if they don't match or the real object exceeds the cap. This is why ADR-6's verification step is load-bearing, not a nice-to-have — it's the only real backstop on upload size.

> #### ADR-4a — `ensure_owner_or_admin` now always 404s, never 403, for non-owners
> Matches the existing `get_template_version` precedent of not leaking resource existence to a non-owner. This is a **confirmed, in-scope behavior change** to the shared helper in `app/shared/authorization.py` — not just a media-feature local rule. See [§8](#8-confirmed-decisions-log) and [§7](#7-security-considerations) for blast radius.

### ADR-5: Signed GET URLs are computed at read time, never stored

**Decision.** `MediaAsset.storage_path` is the only thing persisted. Every read (`GET /templates/{id}`, `GET /templates/{id}/versions/{version}`, `GET /events/{id}/draft`) resolves each referenced path to a **presigned GET URL** on the fly, 15-minute TTL.

**Why not store the signed URL itself.** It's a bearer credential with a baked-in expiry — stored, it either goes stale (broken images past the TTL) or needs a background refresher. Computed at read time, every response is valid *now*, with no staleness window at all.

**Bucket topology — confirmed: single private bucket, always signed.** No public bucket, no publish-time copy step, regardless of `owner_kind` or the owning resource's publish status. This trades away CDN-cacheability for published content in exchange for one uniform access-control story — nothing is ever silently public. `MediaAsset.bucket` stays modeled in the schema for forward-compatibility with a future multi-bucket split, but today it's always the same bucket name. Revisit only if presign-compute-per-read or lost CDN caching becomes a *measured* cost/latency problem, not a hypothetical one.

### ADR-6: `/upload/ack` never trusts the client

**Decision.** `/upload/ack` takes `uploadId` + `status: SUCCESS | FAILURE`:

1. Load `MediaAsset` by id → 404 if missing.
2. Caller must be the same user who requested the upload (or ADMIN) → else 403.
3. **Idempotency guard** — if already `UPLOADED`/`FAILED`, the ack is a no-op returning current state. A retry from a flaky client must never re-flip a finalized row.
4. On `SUCCESS` → issue a **`HEAD` request to B2** (via the Producer key) confirming the object exists, and that its **actual** size is both (a) within the `mediaType`'s cap (5/10/5 MB) and (b) not wildly larger than `declared_size_bytes` (generous tolerance — e.g. within 10% — since a client's pre-upload estimate and the final on-disk size can legitimately differ slightly). Either check failing → `422 UPLOAD_VERIFICATION_FAILED`, row stays `PENDING` (eligible for the sweep, ADR-7). This is the **real** size enforcement point — the presign itself cannot constrain upload size (see the correction in ADR-4). *"The client said it worked" is never the trust signal — B2's own object metadata is.*
5. Only after the `HEAD` check passes does the row flip to `UPLOADED`, and only now is `storage_path` written back onto the owning `Template`/`TemplateVersion`/`Draft` field.
6. On `FAILURE` → row flips to `FAILED` immediately (nothing to verify). A retry creates a **new** `MediaAsset` row — the old `FAILED` row is left alone as a record, never overwritten.

### ADR-7: Abandoned uploads are swept, not handled inline

**Decision.** A `MediaAsset` stuck `PENDING` past a grace window (1 hour) is reconciled by a periodic sweep: `HEAD` the key in B2.

- **Object exists** (client uploaded fine but crashed before acking) → treat as a **recovery**: run the same verify-and-attach logic as a `SUCCESS` ack.
- **Object doesn't exist** → mark `ABANDONED`, nothing to delete from B2.

**Expired presigned URLs** need no special-case code — a client that sat past the URL's own TTL (10 minutes) just has its PUT rejected by B2, the row never leaves `PENDING`, and the same sweep catches it later. One mechanism, two causes.

---

## 4. Data Model

### 4.1 New table — `media_assets`

```python
# app/media/models.py

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class MediaOwnerKind(str, enum.Enum):
    BASE = "BASE"   # owner_id references templates.id
    USER = "USER"   # owner_id references events.id


class MediaType(str, enum.Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    MUSIC = "MUSIC"


class MediaStatus(str, enum.Enum):
    PENDING = "PENDING"
    UPLOADED = "UPLOADED"
    FAILED = "FAILED"
    ABANDONED = "ABANDONED"


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    owner_kind: Mapped[MediaOwnerKind] = mapped_column(
        Enum(MediaOwnerKind, name="media_owner_kind"), nullable=False
    )
    # BASE -> templates.id ; USER -> events.id. Polymorphic association,
    # enforced in the service layer rather than a DB-level FK (see ADR-4).
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    media_type: Mapped[MediaType] = mapped_column(Enum(MediaType, name="media_type"), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    bucket: Mapped[str] = mapped_column(String(100), nullable=False)

    original_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    declared_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    actual_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    status: Mapped[MediaStatus] = mapped_column(
        Enum(MediaStatus, name="media_status"), nullable=False, default=MediaStatus.PENDING
    )
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    presign_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC)
    )
```

> **Why `owner_id` isn't a real FK to two tables:** Postgres has no native "FK to one of two tables" short of a full polymorphic-association pattern with extra junction tables — not justified at this scale (a handful of media items per template/event). The `owner_kind` discriminator + service-layer validation mirrors how `AuditLog.resource_type` + `resource_id` already works in this exact codebase — a matching, established precedent.

### 4.2 Existing tables — how they reference `MediaAsset`

No schema change needed — `Template`/`TemplateVersion`/`Draft` already store string paths/URLs:

| Table.Column | Holds | Resolved by |
|---|---|---|
| `Template.thumbnail_url`, `Template.preview_url` | `MediaAsset.storage_path` (relative path, not a URL) | Read-time signing (ADR-5) |
| `TemplateVersion.defaults` (JSON) | `storage_path` strings in any `image`/`audio` field | Recursive resolver, schema-aware |
| `Draft.data` (JSON) | Same, for the user's own draft | Same resolver |

> Despite the `_url` suffix, these columns store a relative storage path going forward, not a literal URL. Renaming is possible but out of scope — no data exists yet (empty catalog), so it's a documentation note, not a migration risk.

### 4.3 Storage path construction

```python
# app/media/paths.py

def base_template_media_path(template_id: uuid.UUID, media_type: MediaType, file_name: str) -> str:
    return f"asset/{template_id}/{media_type.value.lower()}/{file_name}"

def user_template_media_path(
    user_id: uuid.UUID, event_id: uuid.UUID, media_type: MediaType, file_name: str
) -> str:
    return f"public/{user_id}/{event_id}/{media_type.value.lower()}/{file_name}"
```

`file_name` is **server-generated** (`f"{uuid.uuid4()}{original_extension}"`) — never the client-supplied name verbatim. Avoids path traversal, collisions, and leaking a possibly-PII original filename into a path.

---

## 5. API Contracts

New `app/media` module (`router.py`, `service.py`, `schemas.py`, `models.py`, `paths.py`), mounted at `/v1/media` — same shape as every other module in this codebase.

### 5.1 `POST /v1/media/upload`

**Auth:** Bearer token required.

<table>
<tr><td width="50%" valign="top">

**Request**
```json
{
  "ownerKind": "BASE",
  "ownerId": "4f8e...-uuid",
  "mediaType": "IMAGE",
  "contentType": "image/jpeg",
  "fileName": "hero-photo.jpg",
  "fileSizeBytes": 2345000
}
```

</td><td width="50%" valign="top">

**Response** `201 Created`
```json
{
  "data": {
    "uploadId": "a1b2...-uuid",
    "uploadUrl": "https://s3.us-east-005.backblazeb2.com/...",
    "storagePath": "asset/4f8e.../image/9c7f....jpg",
    "expiresAt": "2026-10-03T12:10:00Z",
    "requiredHeaders": { "Content-Type": "image/jpeg" }
  }
}
```

</td></tr>
</table>

`requiredHeaders` — the client's PUT **must** send exactly these; the presign signature is conditioned on them (ADR-4). Omitting/changing them → B2 rejects the PUT with a signature mismatch, independent of any application-level check.

**Validation summary:**

| Source | Rule |
|---|---|
| Schema | `contentType` ∈ allow-list for `mediaType`; `fileSizeBytes` ∈ `(0, cap]` |
| Service | `BASE` → ADMIN + template exists; `USER` → event owned by caller (404 for both "doesn't exist" and "not yours") |

### 5.2 `POST /v1/media/upload/ack`

**Auth:** Bearer token required.

<table>
<tr><td width="50%" valign="top">

**Request**
```json
{
  "uploadId": "a1b2...-uuid",
  "status": "SUCCESS",
  "failureReason": null
}
```
*(`failureReason` is informational only — never trusted for state transitions)*

</td><td width="50%" valign="top">

**Response** `200 OK`
```json
{
  "data": {
    "uploadId": "a1b2...-uuid",
    "status": "UPLOADED",
    "storagePath": "asset/4f8e.../image/9c7f....jpg"
  }
}
```
*(`status` is the **server-confirmed** final state — may differ from the request if the B2 `HEAD` check failed)*

</td></tr>
</table>

**Errors:**

| Code | Status | Cause |
|---|---|---|
| `MEDIA_UPLOAD_NOT_FOUND` | 404 | Unknown `uploadId` |
| `AUTH_FORBIDDEN` | 403 | Acking someone else's upload |
| `UPLOAD_VERIFICATION_FAILED` | 422 | Client claimed `SUCCESS`, B2 `HEAD` disagreed |
| — | 200 | Already finalized → idempotent no-op |

### 5.3 Read-side resolution

No new routes — existing routes transparently gain resolved URLs:

| Route | What resolves |
|---|---|
| `GET /v1/templates/{id}` | `thumbnailUrl` / `previewUrl` become resolved signed URLs (field names unchanged — no breaking contract change) |
| `GET /v1/templates/{id}/versions/{version}` | Every `image`/`audio` leaf in `defaults`, walked recursively by a schema-aware helper |
| `GET /v1/events/{id}/draft` | Same recursive resolution over `Draft.data` |

Implemented once — `app/media/service.py::resolve_media_url(storage_path) -> str` (+ a recursive `resolve_media_refs` for JSON blobs) — called from `templates/service.py` / `drafts/service.py` where they already build response models. Not duplicated per route.

---

## 6. Linking Base ↔ User-Created Templates

Already satisfied by the existing schema — no new foreign keys required:

```
Event.id             — the "user-created template"'s own id
Event.owner_id   FK  → users.id      (the owner)
Event.template_id FK → templates.id  (the base template it came from)
Draft.event_id   FK  → events.id, unique   (the user's data + media)
```

A `MediaAsset` for the user flow sets `owner_kind=USER`, `owner_id=Event.id` — traceable to exactly one event → one owner → one base template. Separation from base-template media is automatic: different rows, different `owner_id`s, and `Event.id` can never collide with `Template.id` (independently-generated UUIDv4s), with `owner_kind` making the distinction explicit regardless.

---

## 7. Security Considerations

| Concern | Mitigation |
|---|---|
| **Presign scope** | Every presigned PUT is conditioned on exact `key` and `Content-Type` — can't be reused for a different file or MIME type. Size is **not** constrained by the presign itself (PUT has no length condition, unlike a POST policy); it's enforced after the fact by the `/upload/ack` `HEAD` check (ADR-6) comparing actual vs. declared size |
| **Trust-on-ack** | B2 `HEAD` verification (ADR-6) — a client cannot mark `UPLOADED` without the object genuinely existing at the expected size |
| **Path/filename injection** | Server-generated filenames eliminate path traversal and original-filename (PII) leakage |
| **IDOR on `ownerId`** | Fully guarded pre-presign by ADR-4 (role check for BASE, ownership check for USER) |
| **Content-type smuggling** | `Content-Type` is fixed at upload time — `image/jpeg` is never served as `text/html`. SVG excluded from the `IMAGE` allow-list entirely (can embed `<script>`) — only raster formats accepted |
| **Signed URL leakage** | 15-min GET TTL bounds exposure; never logged. Single private bucket (no public fallback) means a signed URL is the *only* path to any media — raises the stakes on the TTL slightly, acceptable since every page load re-resolves fresh URLs |
| **`/upload` rate limiting** | **Gap, not yet designed** — no rate-limiting infra exists in this repo today. Without it, an authenticated user could spam `/upload` to generate unlimited `PENDING` rows. Deferred as a cross-cutting concern bigger than this feature |

> #### ⚠ Blast radius of the `ensure_owner_or_admin` change (ADR-4a)
> This helper (`app/shared/authorization.py`) is also called by `app/events/service.py` (`get_event`) and `app/payments/service.py` (payment lookup), not just `app/drafts/service.py`. Changing it from `AuthForbiddenError` (403) to a caller-supplied `NotFoundError` (404) for non-owners touches **all three** existing call sites, not only the new media routes. Each site already has its own resource-specific not-found code/message (`EVENT_NOT_FOUND`, `PAYMENT_NOT_FOUND`, `DRAFT_NOT_FOUND`) — so the helper's new signature accepts `(code, message)` rather than hardcoding one message across four resource types. **Call this out explicitly in the implementation story** so a reviewer isn't surprised by diffs in `events`/`payments` tests.

---

## 8. Confirmed Decisions Log

| # | Question | Decision |
|---|---|---|
| 1 | Bucket topology | **Single private bucket** for all media (base + user-created). No public bucket, no publish-time copy step. |
| 2 | `ensure_owner_or_admin` 403 vs 404 | **Confirmed 404** for non-owners, always. In-scope change across `authorization.py`, `drafts/`, `events/`, `payments/service.py` — see [§7](#7-security-considerations). |
| 3 | Media size caps | **5 MB image · 10 MB video · 5 MB audio.** |
| 4 | B2 credentials | **Two keys**, split by pipeline stage: `TheInvitelyProducer` (read+write — upload + ack verification) and `TheInvitelyConsumer` (read-only — serving/display). See [ADR-3](#adr-3-b2-via-boto3-two-credentials-split-by-pipeline-stage). |

---

## 9. Future Scope (explicitly deferred)

**Abandoned-upload sweep scheduler.** The sweep *logic* (ADR-7 — reconcile stale `PENDING` rows) belongs in this feature's service layer (`app/media/service.py::sweep_abandoned_uploads()`), but **the scheduler that invokes it is deferred**. This repo has no existing scheduler — no cron/celery/APScheduler, and the backend is Vercel serverless functions with no persistent background-process concept.

**Planned mechanism:** a GitHub Actions scheduled workflow (cron trigger) calling a protected sweep endpoint — consistent with this repo's existing use of GHA for deploy automation (`deploy-backend.yml`, `deploy-frontend.yml`). To be stood up in a later story.

Until then: stale `PENDING` rows accumulate harmlessly (they block nothing — a retry always creates a fresh row), and orphaned B2 objects from abandoned presigned PUTs are simply not yet garbage-collected.

---

## 10. File Change Summary

**New:**
- `app/media/{__init__.py, models.py, schemas.py, service.py, router.py, paths.py}`
- `app/shared/storage/b2_client.py` — `boto3`-based, mirrors `razorpay_client.py`
- Migration: `media_assets` table + 3 enums (`media_owner_kind`, `media_type`, `media_status`)
- Dependency: `boto3` (`pyproject.toml` + `requirements.txt`)

**Changed:**
- `app/config.py` — add `b2_endpoint_url`, `b2_bucket_name`, `b2_producer_key_id`/`_secret`, `b2_consumer_key_id`/`_secret`. Follows the existing `razorpay_*` optional-settings pattern: all `None` by default, `get_b2_client()` returns `None` unless every key pair + bucket/endpoint is set.
- `app/main.py` — mount new `media_router`
- `app/templates/service.py`, `app/drafts/service.py` — call `resolve_media_url` / `resolve_media_refs` when building response models
- `app/shared/authorization.py` — `ensure_owner_or_admin` raises a caller-supplied `NotFoundError` instead of `AuthForbiddenError` for non-owners
- `app/events/service.py`, `app/payments/service.py`, `app/drafts/service.py` — update call sites accordingly; update existing tests asserting 403-for-non-owner to assert 404

**Deferred:**
- GHA scheduled workflow + sweep endpoint for abandoned uploads ([§9](#9-future-scope-explicitly-deferred))
