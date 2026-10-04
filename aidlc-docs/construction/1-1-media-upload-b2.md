# Story 1.1: Media Upload & Retrieval via Backblaze B2

Status: review

## Story

As an ADMIN authoring a base template, or a user building their own invitation from one,
I want to upload images/video/audio and have them served back via short-lived signed URLs,
so that template and draft media is stored durably in object storage rather than pasted-in external URLs, with uploads validated, verified, and properly scoped to their owner.

## Acceptance Criteria

1. `POST /v1/media/upload` returns a presigned B2 PUT URL for an authenticated caller, after validating: auth, `ownerKind` (`BASE`|`USER`) + `ownerId` existence/ownership, `mediaType` + `contentType` allow-list match, and `fileSizeBytes` within the per-type cap (5 MB image / 10 MB video / 5 MB audio).
2. `ownerKind=BASE` requires ADMIN role and an existing `Template`; `ownerKind=USER` requires `ownerId` to resolve to an `Event` owned by the caller (or caller is ADMIN) — **always 404** (never 403) when the event doesn't exist or isn't owned by the caller.
3. `POST /v1/media/upload/ack` transitions a `MediaAsset` from `PENDING` to `UPLOADED` only after a B2 `HEAD` check confirms the object exists and its actual size is within the type's cap (tolerant comparison against `declared_size_bytes`); a failed check returns `422 UPLOAD_VERIFICATION_FAILED` and leaves the row `PENDING`.
4. Acking an already-finalized (`UPLOADED`/`FAILED`) upload is an idempotent no-op returning current state; acking someone else's upload returns `403`; acking an unknown `uploadId` returns `404`.
5. On `FAILURE` ack, the row flips to `FAILED`; a subsequent `/upload` call for the same logical slot creates a **new** `MediaAsset` row (old row untouched).
6. `GET /v1/templates/{id}`, `GET /v1/templates/{id}/versions/{version}`, and `GET /v1/events/{id}/draft` resolve any `storage_path` reference (in `thumbnailUrl`/`previewUrl`, or any `image`/`audio` leaf inside `defaults`/draft `data`) to a presigned B2 GET URL (15-minute TTL) at read time — never a stored/stale URL.
7. `ensure_owner_or_admin` raises a caller-supplied `NotFoundError` (not `AuthForbiddenError`) for non-owners; `drafts`, `events`, and `payments` services pass their own resource-specific not-found code/message, and existing tests asserting 403-for-non-owner are updated to assert 404.
8. B2 access uses two distinct credentials: `TheInvitelyProducer` (read+write — upload presign + ack verification) and `TheInvitelyConsumer` (read-only — GET presign at read time). When B2 isn't configured (any required setting missing), `/v1/media/upload` and `/upload/ack` return `503 MEDIA_STORAGE_NOT_CONFIGURED`.

## Tasks / Subtasks

- [x] Task 1: Dependencies + config (AC: 8)
  - [x] Add `boto3>=1.34` to `backend/pyproject.toml` `[project.dependencies]` and `backend/requirements.txt` (with a comment matching that file's existing convention)
  - [x] Add to `app/config.py`: `b2_endpoint_url`, `b2_bucket_name`, `b2_producer_key_id`, `b2_producer_key_secret`, `b2_consumer_key_id`, `b2_consumer_key_secret` — all `str | None = None`, following the `razorpay_*` optional-settings pattern exactly
  - [x] Install `boto3` into the backend venv (`.venv`) and verify `import boto3` succeeds

- [x] Task 2: `B2Client` storage wrapper (AC: 1, 3, 6, 8)
  - [x] Create `app/shared/storage/__init__.py` and `app/shared/storage/b2_client.py`
  - [x] `B2Client.__init__` takes explicit endpoint/bucket + both key pairs; builds two internal `boto3` S3 clients (producer-keyed, consumer-keyed) — no global state
  - [x] `B2Client.presign_put(key: str, content_type: str, expires_in: int) -> str` — producer client, `ClientMethod="put_object"`, `Params={"Bucket", "Key", "ContentType"}`
  - [x] `B2Client.presign_get(key: str, expires_in: int) -> str` — consumer client, `ClientMethod="get_object"`
  - [x] `B2Client.head_object(key: str) -> dict | None` — producer client; returns `None` on a 404-style `ClientError` (object doesn't exist), re-raises any other `ClientError`
  - [x] `get_b2_client() -> B2Client | None` — returns `None` unless every required setting is present; `@lru_cache`'d since `boto3.client()` construction has real overhead and this client holds only static credentials (no per-request state) — same justification as `config.get_settings()`'s own `@lru_cache`, not a Razorpay-pattern mirror (Razorpay's client is cheap to construct, so it isn't cached)
  - [x] `require_client(client: B2Client | None) -> B2Client` — raises `AppError("MEDIA_STORAGE_NOT_CONFIGURED", ..., 503)` if `None`
  - [x] Unit tests (`tests/test_b2_client.py`) — mocked `boto3` clients (`unittest.mock.MagicMock`) rather than `botocore.stub.Stubber`, since `generate_presigned_url` is pure local signing (no network call for Stubber to intercept); verifies `B2Client` calls the correct underlying boto3 method/client/params, not signed-URL string internals. Covers: presign_put uses producer client with correct params, presign_get uses consumer client, head_object returns metadata for an existing key, returns `None` for both `404` and `NoSuchKey` error codes, re-raises any other `ClientError`. 6/6 passing.

- [x] Task 3: `MediaAsset` model + migration (AC: 1, 3, 5)
  - [x] Create `app/media/__init__.py`, `app/media/models.py` with `MediaOwnerKind`, `MediaType`, `MediaStatus` enums and the `MediaAsset` model exactly as specified in `aidlc-docs/inception/application-design/media-upload-architecture.md` §4.1
  - [x] Register `MediaAsset` in `app/db_models.py`
  - [x] Generate Alembic migration (`alembic revision --autogenerate`, head `d4e8a2c6f1b7` → `facc2d33a021`) creating `media_assets` + 3 new enum types. **Hand-verification caught two real problems with the raw autogenerate output**, both fixed before finalizing: (1) autogenerate also picked up unrelated pre-existing drift between the live Supabase schema and the migration chain (categories.description type, templates.category column drop, several index differences) — stripped out entirely, not this story's concern; (2) the generated `downgrade()` didn't drop the 3 new Postgres enum types, which breaks a downgrade→upgrade cycle (`DuplicateObjectError: type "media_owner_kind" already exists`) — rewrote the migration to match the established `postgresql.ENUM(...).drop(op.get_bind())` pattern already used in `4fa19b719b6e`/`2bed07d38a23`
  - [x] Test: spun up a disposable local Postgres (Docker), ran the full existing migration chain, then **upgrade → downgrade → upgrade → downgrade → upgrade**, confirming no errors on any step (this is a stronger check than the story originally specified, added because the first autogenerate attempt silently produced a broken downgrade — a plain "does upgrade apply once" check would have missed it). Also confirmed via the normal test suite run: `MediaAsset` registers on `Base.metadata` and `create_all`/`drop_all` works through the existing testcontainers-backed `db_engine` fixture.

- [x] Task 4: `ensure_owner_or_admin` 403→404 change (AC: 2, 7)
  - [x] Changed `app/shared/authorization.py::ensure_owner_or_admin` signature to `ensure_owner_or_admin(current_user, owner_id, *, not_found_code: str, not_found_message: str)`, raising `NotFoundError(not_found_code, not_found_message)` instead of `AuthForbiddenError` for a non-owner, non-admin caller
  - [x] Updated call sites: `app/drafts/service.py` (`get_draft`, `save_draft` — pass `"DRAFT_NOT_FOUND"`), `app/events/service.py` (`get_event` — pass `"EVENT_NOT_FOUND"`), `app/payments/service.py` (`get_payment` — pass `"PAYMENT_NOT_FOUND"`)
  - [x] Updated `tests/test_drafts.py::test_other_user_cannot_access_someone_elses_draft` — both assertions now check `404` + `DRAFT_NOT_FOUND`
  - [x] Updated `tests/test_events.py::test_other_user_cannot_access_someone_elses_event` — all three assertions (`get`/`patch`/`delete`) now check `404` + `EVENT_NOT_FOUND`
  - [x] Updated `tests/test_payments.py::test_other_user_cannot_checkout_someone_elses_event` — confirmed checkout goes through `get_event` (via `_event_and_template`), not `get_payment`; assertion now checks `404` + `EVENT_NOT_FOUND` (not `PAYMENT_NOT_FOUND`)
  - [x] Confirmed `tests/test_templates.py`'s one remaining `403` assertion (`test_non_admin_cannot_create_template`) is an unrelated `require_role(ADMIN)` rejection, not `ensure_owner_or_admin` — correctly untouched
  - [x] Full suite: 65/65 passed, zero regressions

- [x] Task 5: Storage path helpers (AC: 1)
  - [x] Created `app/media/paths.py` with `base_template_media_path` / `user_template_media_path` — server-generated filename (`uuid4()` + original extension), never the client-supplied name
  - [x] Unit tests (`tests/test_media_paths.py`): path shape for both owner kinds, extension preserved, no-extension input handled without a trailing dot (caught and fixed a real bug: `rpartition(".")` treated a dotless filename's entire content as "the extension" — fixed with an explicit `"." in name` check), client-supplied name never appears verbatim (path-traversal attempt included), two calls produce different filenames. 6/6 passing.

- [x] Task 6: `POST /v1/media/upload` (AC: 1, 2, 8)
  - [x] `app/media/schemas.py`: `MediaUploadRequest` (`CamelModel`) with `owner_kind`, `owner_id`, `media_type`, `content_type`, `file_name`, `file_size_bytes`; `model_validator(mode="after")` enforcing the `contentType` allow-list per `mediaType` and the size cap (5/10/5 MB). Allow-lists/caps exposed as non-underscore-prefixed `CONTENT_TYPE_ALLOW_LIST`/`SIZE_CAP_BYTES` module constants (not module-private) since `app/media/service.py` needs `SIZE_CAP_BYTES` again at ack time (AC 3) — a deliberate single source of truth instead of duplicating the cap table
  - [x] `MediaUploadOut`: `upload_id`, `upload_url`, `storage_path`, `expires_at`, `required_headers`
  - [x] `app/media/service.py::request_upload(db, current_user, b2, data) -> tuple[MediaAsset, str]` — resolves `ownerKind`/`ownerId` per AC 2, builds the storage path, creates a `PENDING` `MediaAsset`, calls `B2Client.presign_put`, sets `presign_expires_at` (10 min). `B2Client | None` is an explicit parameter (injected at the router via `Depends(get_b2_client)`), not a hidden global — matches how `app/payments/service.py` already takes `RazorpayClient | None` as a parameter
  - [x] `app/media/router.py` — `APIRouter(prefix="/v1/media", tags=["media"])`, `POST /upload` wired to `get_current_user` + `Depends(get_b2_client)` (service calls `require_client` internally, same as payments), full `summary`/`description` + `responses=merge(...)`. Added a new `service_unavailable(code, message)` helper to `app/shared/openapi_responses.py` (503 was the one status this shared helper module didn't have yet, alongside the existing `not_found`/`conflict`/`validation_failed`)
  - [x] Mounted `media_router` in `app/main.py` + added its OpenAPI tag description
  - [x] Tests (`tests/test_media.py`, `FakeB2Client` — no real boto3/network): ADMIN can request BASE upload; non-ADMIN gets 403 for BASE; unknown template gets 404; owner can request USER upload for their own event (asserted the exact `public/{ownerId}/{eventId}/...` path shape); non-owner gets 404 (not 403); unknown event gets 404; wrong `contentType` gets 422; oversized `fileSizeBytes` gets 422; unconfigured B2 gets 503. 9/9 passing.

- [x] Task 7: `POST /v1/media/upload/ack` (AC: 3, 4, 5)
  - [x] `MediaAckRequest`: `upload_id`, `status: Literal["SUCCESS","FAILURE"]`, `failure_reason`, plus `target_field: Literal["thumbnail","preview"] | None` — added beyond the original plan because `mediaType=IMAGE` alone can't disambiguate which `Template` column (`thumbnail_url` vs `preview_url`) a BASE-owner upload should write onto; this field is the caller's explicit selector, ignored entirely for USER-owner uploads
  - [x] `MediaAckOut`: `upload_id`, `status`, `storage_path`
  - [x] `app/media/service.py::ack_upload` implementing ADR-6: load-or-404, ownership-or-403, idempotent no-op if already finalized (verified via a test that flips `head_response` to `None` *after* the first successful ack — if the no-op branch incorrectly re-verified, the second ack would wrongly fail), `HEAD` verification on `SUCCESS` (object-exists + size-within-cap + 10%-tolerant match to declared, else 422 and stays `PENDING` — per the architecture doc's correction that a presigned PUT cannot itself constrain size), write-back onto `Template.thumbnail_url`/`preview_url` only for `owner_kind=BASE` + `target_field` set, flip to `FAILED` immediately on `FAILURE`
  - [x] `POST /upload/ack` route, same wiring as Task 6
  - [x] Tests: successful ack flips to `UPLOADED`; BASE-owner ack with `targetField=thumbnail` writes the path onto `Template.thumbnail_url` (verified end-to-end through a subsequent `GET /v1/templates/{id}` call, confirming Task 8's resolution too); missing object → 422, stays `PENDING` (confirmed via a successful retry afterward); oversized actual size → 422; re-acking an already-`UPLOADED` row → idempotent no-op with no re-verification; acking someone else's upload → 403; unknown upload id → 404; `FAILURE` ack → `FAILED`, and a subsequent `/upload` call for the same event creates a genuinely new, separate `MediaAsset` row (checked directly against the DB, not just the HTTP response) — 9/9 passing.
  - [x] **Write-back scope confirmed minimal, as planned**: no generic `Draft.data`/`TemplateVersion.defaults` JSON-tree mutation was implemented — out of scope for this story, called out explicitly rather than attempted speculatively.

- [x] Task 8: Read-side signed URL resolution (AC: 6)
  - [x] `app/media/service.py::resolve_media_url(b2, storage_path) -> str | None` — returns the input unchanged if falsy or if `b2 is None` (a template with no B2 configured just shows no media rather than erroring); otherwise calls `B2Client.presign_get`
  - [x] **Deviation from the original plan, discussed and confirmed with the user before implementing:** the story originally said to wire this into `app/templates/service.py`. On inspection, `get_template`/`list_templates` return raw `Template` ORM rows consumed by other internal callers inside `templates/service.py` itself (e.g. `update_template`'s existence check, `create_template_version`'s existence check) that need the actual ORM object, not a response schema — changing those functions' return type would break those call sites. Response-schema construction (`TemplateOut.model_validate(...)`) already happens in `templates/router.py`, not the service layer, for both affected routes. So the resolution step was added as a small private helper `_resolve_template_media()` in `templates/router.py` itself, called from both `get_template_route` and `list_templates_route` after `model_validate` — no signature change to any existing service function, no new cross-module reach from `service.py` into `media`.
  - [x] **Do not** implement recursive `defaults`/draft-data walking in this story (per Task 7's note) — `TemplateVersionOut.defaults` and `DraftOut.data` are returned as-is; any `image`/`audio` field values that happen to be raw storage paths are a known, explicitly deferred gap, not an oversight.
  - [x] Tests: `GET /v1/templates/{id}` after a BASE-owner ack returns a resolved signed URL (not the raw storage path) for `thumbnailUrl`; a template with no thumbnail/preview set returns `null` for both and makes zero presign calls (asserted directly against the fake client's call log, not just the response body). 2/2 passing (plus the write-back test from Task 7, which also exercises this path).

- [x] Task 9: Full regression + documentation pass (AC: all)
  - [x] Full backend suite: **90 passed, 0 failed** (59 pre-existing baseline + 31 new tests across `test_b2_client.py`, `test_media_paths.py`, `test_media.py`)
  - [x] `ruff check .`: all checks passed (fixed 11 line-length violations introduced by this story's new files during cleanup)
  - [x] `mypy app`: confirmed CI does **not** run mypy (`deploy-backend.yml` only runs `ruff check .` and `pytest`) — checked anyway. 13 of 15 total errors are pre-existing on `app/templates/router.py` *before any change in this story* (verified via `git stash`/`mypy`/`git stash pop`) — a known, already-accepted FastAPI `responses=` typing mismatch with no mypy plugin configured for it. Only 2 new errors, both the identical pre-existing pattern repeated in the new `app/media/router.py` — not a new category of problem, consistent with the rest of the codebase's current mypy posture.
  - [x] Confirmed both new routes (`POST /v1/media/upload`, `POST /v1/media/upload/ack`) have `summary` + full docstring `description`
  - [x] Confirmed every raised error is either a Pydantic schema-level `ValueError` or a typed `AppError` subclass. **Caught one real gap during this pass**: `B2Client.head_object`'s `ClientError` re-raise (for anything other than a 404/missing-object) was uncaught in `ack_upload`'s verification step — an unexpected B2-side failure (e.g. a transient 500, auth issue) would have fallen through to the generic unhandled-exception handler as a bare 500, violating CLAUDE.md's "never let an unexpected exception type reach a route handler uncaught if you can anticipate it." Fixed by wrapping the `head_object` call in `_verify_and_mark_uploaded` with a `try/except ClientError`, raising a new typed `AppError("MEDIA_STORAGE_ERROR", ..., 502)` instead — logged via `logger.exception` first, matching `RazorpayClient`'s existing `httpx.HTTPError` → `AppError(..., 502)` wrapping for the equivalent "upstream provider failed unexpectedly" case. Added `test_ack_success_b2_outage_during_verification_is_502_not_a_bare_500` to cover it.

## Dev Notes

- **Architecture source of truth:** `aidlc-docs/inception/application-design/media-upload-architecture.md` — read it in full before starting. All ADRs, the data model, and the API contracts there are confirmed/final; do not re-derive or second-guess them here. Two corrections were made to that doc during implementation planning (both already applied in the doc): (1) a presigned PUT cannot constrain `Content-Length-Range` — only presigned POST can; size enforcement is therefore entirely the `/upload/ack` `HEAD` check, not the presign; (2) ADR-6's size check is a cap-check + tolerant-match, not exact equality.
- **Scope discipline (explicit instruction from the user for this story): do not overengineer.** Two things are deliberately left unimplemented and called out above rather than built speculatively: generic recursive media-reference resolution inside arbitrary JSON blobs (`TemplateVersion.defaults`, `Draft.data`), and the abandoned-upload sweep scheduler (already deferred to "Future Scope" in the architecture doc, §9 — not part of this story at all, not even the sweep logic itself, since the only consumer of that logic would be the not-yet-built scheduler).
- **Dependencies:** `boto3` added per user approval (moto/mock-based testing was explicitly declined by the user — write `B2Client` unit tests using `botocore.stub.Stubber` instead, which ships as part of `botocore` and needs no separate test dependency; tests for routes that call into `B2Client` should inject a fake/stub `B2Client` via `app.dependency_overrides[get_b2_client]`, following the exact pattern `tests/test_payments.py`'s `FakeRazorpayClient` + `app.dependency_overrides[get_razorpay_client]` already establishes).
- **Conventions to match exactly (CLAUDE.md + existing code):**
  - Schema-level self-contained validation → `model_validator(mode="after")` on the Pydantic model, `ValueError` referencing camelCase field names (see `TemplateCreate._validate_pricing` for the pattern).
  - Service-layer validation needing a DB read → typed `AppError` subclass, never relying on a DB constraint.
  - Every mutating/fetching service function takes `db: AsyncSession` first, matches the existing module shapes (`templates/service.py`, `events/service.py`, `drafts/service.py`).
  - `CamelModel` for every request/response schema; `Envelope[...]` for single-resource responses (no pagination needed for media endpoints).
  - Router: `APIRouter(prefix=..., tags=[...])` at router level, never override tags per-route (CLAUDE.md explicit rule) — `app/media/router.py` should look like `app/payments/router.py`'s router declaration (single `tags=["media"]` at the `APIRouter(...)` call).
  - `HTTPBearer`-based auth only — already handled transparently via `get_current_user`, nothing new needed here.
- **Existing patterns to reuse directly:**
  - `RazorpayClient` / `get_razorpay_client` / `require_client` (`app/payments/razorpay_client.py`) — `B2Client` mirrors this file's shape almost line for line.
  - `ensure_owner_or_admin` (`app/shared/authorization.py`) — being modified this story; after the change, every call site must pass its own `not_found_code`/`not_found_message`.
  - `AuditLog.resource_type` + `resource_id` polymorphic pattern (`app/shared/audit.py`) — the precedent cited in the architecture doc for why `MediaAsset.owner_kind` + `owner_id` doesn't need a real FK.
- **Config:** All new B2 settings are optional (`None` default) — the app must still boot clean with no B2 configured (CLAUDE.md: app must boot clean with an empty catalog / no mock data). `get_b2_client()` returning `None` is the expected, tested state when B2 env vars are unset — don't make any of this required at import time.

### Project Structure Notes

- New module `app/media/` sits alongside `app/templates/`, `app/events/`, `app/drafts/`, `app/payments/` — same five-file shape (`__init__.py`, `models.py`, `schemas.py`, `service.py`, `router.py`) plus one extra `paths.py` for the storage-path helpers (small enough not to warrant folding into `service.py`, specified separately in the architecture doc).
- New shared infra `app/shared/storage/b2_client.py` sits alongside `app/payments/razorpay_client.py` conceptually, but under `shared/` (not `payments/` or `media/`) since `app/payments/razorpay_client.py` itself actually lives inside the `payments` module, not `shared` — **deviation flagged for awareness**: the architecture doc places B2 under `app/shared/storage/` rather than `app/media/`, unlike Razorpay's placement inside its own feature module. This is intentional per the architecture doc (not a mistake to "fix") since B2 is lower-level, reusable storage infra rather than a single feature's integration — but it is a structural variance from the Razorpay precedent worth being aware of, not silently matching.
- No frontend changes in this story — purely backend. The frontend wiring (calling `/upload`/`/upload/ack`, displaying resolved signed URLs) is a separate, not-yet-scoped follow-up.

### References

- [Source: aidlc-docs/inception/application-design/media-upload-architecture.md] — full architecture, all ADRs, data model, API contracts, confirmed decisions log, security considerations, future scope.
- [Source: backend/app/payments/razorpay_client.py] — pattern to mirror for `B2Client`.
- [Source: backend/app/shared/authorization.py] — `ensure_owner_or_admin`, being modified.
- [Source: backend/app/shared/errors.py] — `AppError` subclasses, error envelope.
- [Source: backend/app/templates/models.py, backend/app/events/models.py, backend/app/drafts/models.py] — existing tables this story's `MediaAsset` references by id, not FK.
- [Source: backend/tests/conftest.py] — test harness: `client`, `db_session`, `auth_headers` fixtures; `FakeIdentityProvider` pattern.
- [Source: backend/tests/test_payments.py] — `FakeRazorpayClient` + `app.dependency_overrides` pattern to replicate for `B2Client` in tests.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5) — Dash persona, dev-story workflow

### Debug Log References

- Alembic autogenerate (head `d4e8a2c6f1b7`) picked up unrelated pre-existing schema drift between the live Supabase project and the checked-in migration chain (categories.description type, templates.category column, several index differences) — stripped from the final migration, not this story's concern.
- First draft of the `media_assets` migration had a broken `downgrade()` (didn't drop the 3 new Postgres enum types) — caught via an upgrade→downgrade→upgrade→downgrade→upgrade round-trip test against a disposable local Postgres container, not just a single upgrade check. Fixed to match the established `postgresql.ENUM(...).drop(op.get_bind())` pattern already used by `4fa19b719b6e`/`2bed07d38a23`.
- `app/media/paths.py`'s original `_generated_file_name` used `str.rpartition(".")`, which silently treated an entire dotless filename as "the extension" (e.g. `"noext"` → `.noext` suffix). Caught by a dedicated test, fixed with an explicit `"." in name` check.
- `B2Client.head_object`'s `ClientError` re-raise (for any error other than object-not-found) was initially uncaught in the ack verification path — would have surfaced as a bare 500 on a B2-side outage. Fixed to raise a typed `AppError("MEDIA_STORAGE_ERROR", ..., 502)`, matching `RazorpayClient`'s existing pattern for wrapping an unexpected upstream-provider failure.
- `B2Client` unit tests originally used `botocore.stub.Stubber` for all four methods per the story's original plan; corrected to `unittest.mock.MagicMock` after review — `generate_presigned_url` does no network I/O (pure local signing), so `Stubber` doesn't apply to it; `head_object`-only `Stubber` usage was also simplified to mocks for consistency within the same test file.
- Task 8 (read-side signed URL resolution) deviated from the story's original plan to wire into `app/templates/service.py` — discussed with the user mid-implementation and confirmed: `get_template`/`list_templates` return raw ORM `Template` rows consumed by other internal callers in the same service module that need the actual ORM object, not a response schema. Resolution was implemented as a private helper in `app/templates/router.py` instead (where response-schema construction already happens for both affected routes), leaving `templates/service.py`'s function signatures untouched.
- Manual end-to-end verification against the real `TheInvitely` B2 bucket surfaced one environment gap (not a code bug): the live Supabase database was still at `d4e8a2c6f1b7`, one revision behind this story's `facc2d33a021` migration, so the first live `POST /v1/media/upload` failed with `asyncpg.exceptions.UndefinedTableError: relation "media_assets" does not exist`. Resolved by running `alembic upgrade head` against the real database and confirming `media_assets`'s columns via `information_schema.columns` per CLAUDE.md's verify-the-actual-DB rule. Flagged here because any other environment picking up this branch (staging, teammate's local DB) needs the same migration applied before the media routes will work — it does not happen automatically.

### Completion Notes List

- All 9 acceptance criteria implemented and covered by tests.
- New `app/media` module (models, schemas, service, router, paths) added, following the existing `templates`/`events`/`drafts`/`payments` module shape exactly.
- New `app/shared/storage/b2_client.py` wraps B2's S3-compatible API via `boto3`, with two internally-separated boto3 clients per the confirmed Producer (read+write, upload pipeline)/Consumer (read-only, serving path) credential split — never crossed.
- `ensure_owner_or_admin` now always returns 404 (never 403) for a non-owner, non-admin caller — a confirmed, intentional change rippling through `drafts`, `events`, and `payments` services and their existing tests (all updated, all still passing).
- Media size caps confirmed and enforced in two places: declared-size validation at `/upload` request time (schema layer), and actual-size verification at `/upload/ack` time against B2's own object metadata (service layer) — the real enforcement point, since a presigned PUT alone cannot constrain upload size (a correction made to the architecture doc during implementation planning).
- **Deliberately out of scope, per explicit instruction not to overengineer:** generic recursive media-reference resolution inside `TemplateVersion.defaults` / `Draft.data` JSON blobs (only the two concrete `Template.thumbnail_url`/`preview_url` columns get write-back + read-time resolution); the abandoned-upload sweep scheduler (sweep logic specified in the architecture doc's ADR-7 but not built — no scheduler exists in this stack at all today; planned as a future GitHub Actions cron job, per the user's explicit direction to defer it).
- Final state: 90/90 backend tests passing (59 pre-existing + 31 new), `ruff check .` clean, zero regressions introduced to any existing endpoint or test.

### File List

**New:**
- `backend/app/media/__init__.py`
- `backend/app/media/models.py`
- `backend/app/media/paths.py`
- `backend/app/media/schemas.py`
- `backend/app/media/service.py`
- `backend/app/media/router.py`
- `backend/app/shared/storage/__init__.py`
- `backend/app/shared/storage/b2_client.py`
- `backend/alembic/versions/facc2d33a021_add_media_assets_table.py`
- `backend/tests/test_b2_client.py`
- `backend/tests/test_media_paths.py`
- `backend/tests/test_media.py`

**Changed:**
- `backend/pyproject.toml` — added `boto3>=1.34` dependency
- `backend/requirements.txt` — added `boto3>=1.34` (Vercel runtime deps)
- `backend/app/config.py` — added 6 `b2_*` settings (endpoint, bucket, producer/consumer key pairs)
- `backend/app/db_models.py` — registered `MediaAsset` on `Base.metadata`
- `backend/app/main.py` — mounted `media_router`, added `media` OpenAPI tag
- `backend/app/shared/authorization.py` — `ensure_owner_or_admin` now takes `not_found_code`/`not_found_message` kwargs and raises `NotFoundError` instead of `AuthForbiddenError` for non-owners
- `backend/app/shared/openapi_responses.py` — added `service_unavailable(code, message)` helper
- `backend/app/drafts/service.py` — updated `ensure_owner_or_admin` call sites (`get_draft`, `save_draft`)
- `backend/app/events/service.py` — updated `ensure_owner_or_admin` call site (`get_event`)
- `backend/app/payments/service.py` — updated `ensure_owner_or_admin` call site (`get_payment`)
- `backend/app/templates/router.py` — added `_resolve_template_media` helper + wired into `get_template_route`/`list_templates_route`
- `backend/tests/test_drafts.py` — updated non-owner assertions from 403 to 404
- `backend/tests/test_events.py` — updated non-owner assertions from 403 to 404
- `backend/tests/test_payments.py` — updated non-owner checkout assertion from 403 to 404

**Documentation (not code, tracked for completeness):**
- `aidlc-docs/construction/1-1-media-upload-b2.md` — this story file
- `aidlc-docs/inception/application-design/media-upload-architecture.md` — architecture doc, corrected twice during implementation planning (presigned-PUT size-constraint correction; ADR-6 tolerant-match correction)

**Tooling (not application code, added for manual API testing):**
- `backend/postman/evoke-api.postman_collection.json` — full Postman collection generated from the live `app.openapi()` spec (covers every route across every module, not just this story's media endpoints), plus a hand-added "Supabase Auth (login)" request that authenticates directly against Supabase and auto-populates the collection's `bearerToken` variable from the response — since this backend has no `/login` route of its own (auth is Supabase's responsibility client-side).
