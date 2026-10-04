# Frontend Integration Guide: Media Upload via Backblaze B2

> Companion to [Story 1.1](./1-1-media-upload-b2.md) and the [architecture doc](../inception/application-design/media-upload-architecture.md).
> Backend branch: `feat/media-upload-b2` · Status: Backend complete, frontend integration not started

## Summary

The backend now exposes a two-step presigned upload flow for template/event
media (images, video, audio) stored in a private Backblaze B2 bucket:

```
POST /v1/media/upload       → get a presigned PUT URL
PUT  <uploadUrl>             → upload the file directly to B2 (not our backend)
POST /v1/media/upload/ack   → tell the backend the upload finished (or failed)
```

Nothing is "live" on a template/draft until the ack is verified server-side —
the backend never trusts the client's claim that an upload succeeded; it
independently checks the object's existence and size in B2 before accepting it.

Reads are unaffected by any of this: `GET /v1/templates/{id}` already returns
`thumbnailUrl`/`previewUrl` as resolved, ready-to-use URLs (signed, 15-minute
TTL) — nothing on the read side changes for existing consumers.

This doc covers **what the frontend needs to build** to let an admin upload a
template thumbnail/preview, or a user upload their own draft media. No
frontend code exists for this yet.

## Why we're building it

Today `Template.thumbnailUrl`/`previewUrl` and any `image`/`audio` field in a
draft's schema only ever held an externally-hosted URL someone pasted in by
hand. There was no way to actually *upload* media through the product. This
closes that gap for the two places media gets attached:

- **Base templates** (ADMIN): thumbnail/preview images on the template catalog.
- **User drafts**: any `image`/`audio`-typed field an event's template schema
  declares (e.g. a couple's photo, a venue map image, background music).

## Where this fits in the existing app

| Area | Relevant existing code | What changes |
| --- | --- | --- |
| Admin template editing | `src/app/features/dashboard/pages/admin-dashboard/` (`TemplateDraft.photo` is currently a free-text URL input — see `admin-dashboard.component.html`'s "Card image URL" field) | Replace/augment the free-text URL field with an upload control that drives this flow |
| User draft editing | `src/app/features/editor/` — `TemplateEditorStore`, `TemplateRendererComponent`, any `image`/`audio` field type in a template's schema (see `template-schema.model.ts`'s `FieldSchema`) | Wherever the editor renders an `image`/`audio` field today (presumably a URL text input, matching the admin pattern), add an upload control using this flow |
| HTTP plumbing | `api-base-url.interceptor.ts`, `auth-token.interceptor.ts` | **Do not** reuse the default `HttpClient` call pattern for the `PUT` to B2 — see [Critical gotcha](#critical-gotcha-the-b2-put-is-not-a-backend-call) below |

No existing frontend service currently touches this — there is no
`MediaService`/`UploadService` yet. This doc assumes one will be created.

## Prerequisite: B2 bucket CORS (ops/infra) — ✅ done

There are **two separate CORS configs** involved in this feature — don't
confuse them:

1. **Our backend's `CORS_ORIGINS`** (`backend/.env.example` / Vercel env var)
   — already exists, governs who can call `/v1/media/upload` and every other
   API route. No change needed for this feature as long as the frontend
   origin is already allowed there (it is, for existing endpoints).
2. **The B2 bucket's own CORS policy** — governs the browser's direct `PUT`
   to `uploadUrl` in step 2 below. **Configured** on the `TheInvitely` bucket
   via the `b2` CLI (`b2 bucket update --cors-rules '...' TheInvitely`) on
   2026-10-04. If step 2 ever fails with a browser CORS error (not an API
   error from `/upload` or `/upload/ack`, which go through our own CORS
   config above), check this rule first — it may need a new origin added
   (e.g. a staging domain) via the same command.

The rule in place allows the frontend's origins to `PUT` with a
`Content-Type` header:

```json
[
  {
    "corsRuleName": "evoke-media-upload",
    "allowedOrigins": ["http://localhost:4200", "https://theinvitely.in"],
    "allowedOperations": ["s3_put"],
    "allowedHeaders": ["content-type"],
    "exposeHeaders": [],
    "maxAgeSeconds": 3600
  }
]
```

Note `s3_head`/`s3_get` are **not** needed here — ack verification (`HEAD`)
and signed-URL generation (`GET`) both happen server-side via `boto3` in
Python, never from the browser, so they're outside the scope of the bucket's
*browser*-facing CORS policy entirely. Only the direct-from-browser `PUT`
needs a rule. This is an ops/infra task (B2 bucket console), not something
either the frontend or backend code change.

## The flow, step by step

### 1. Request a presigned upload URL

```http
POST /v1/media/upload
Authorization: Bearer <token>
Content-Type: application/json

{
  "ownerKind": "BASE",            // or "USER"
  "ownerId": "4f8e...-uuid",      // templates.id if BASE, events.id if USER
  "mediaType": "IMAGE",           // "IMAGE" | "VIDEO" | "MUSIC"
  "contentType": "image/jpeg",
  "fileName": "hero-photo.jpg",   // original name — only used to preserve the extension
  "fileSizeBytes": 2345000
}
```

**Response** `201 Created`:

```json
{
  "data": {
    "uploadId": "a1b2...-uuid",
    "uploadUrl": "https://s3.us-east-005.backblazeb2.com/...(long signed query string)",
    "storagePath": "asset/4f8e.../image/9c7f....jpg",
    "expiresAt": "2026-10-04T12:10:00Z",
    "requiredHeaders": { "Content-Type": "image/jpeg" }
  }
}
```

- `ownerKind=BASE` → caller must be ADMIN, `ownerId` must be an existing template id.
- `ownerKind=USER` → `ownerId` must be an event id **owned by the caller** (or caller is ADMIN). A non-existent event and someone else's event both return `404` — never `403` — so don't special-case 403 here.
- Validation errors (wrong `contentType` for the `mediaType`, oversized `fileSizeBytes`) come back as `422`, same error envelope as everywhere else in the API.
- If B2 isn't configured on the backend at all, this returns `503 MEDIA_STORAGE_NOT_CONFIGURED` — worth a distinct UI state ("uploads are temporarily unavailable") rather than a generic error toast.

**Content type / size limits** (enforced both client-declared and — independently — against the real uploaded bytes at ack time, so don't rely on client-side validation alone, but do add it for fast feedback):

| mediaType | Allowed contentType | Max size |
| --- | --- | --- |
| `IMAGE` | `image/png`, `image/jpeg`, `image/webp` | 5 MB |
| `VIDEO` | `video/mp4` | 10 MB |
| `MUSIC` | `audio/mpeg`, `audio/mp4` | 5 MB |

Note `image/svg+xml` is **not** allowed (SVGs can embed `<script>` — this is a
deliberate exclusion, not an oversight; don't offer SVG in a file picker for
this flow).

### 2. Upload the file directly to B2

```http
PUT <uploadUrl>
Content-Type: image/jpeg   <-- must exactly match requiredHeaders

<raw file bytes>
```

This is a **direct browser-to-B2** request — it does not go through our
backend at all. Use the raw `fetch()` API (or a non-intercepted `HttpClient`
call), sending exactly the headers in `requiredHeaders`. The presign signature
is conditioned on `Content-Type` matching exactly — sending a different value
(or omitting it) makes B2 reject the PUT with a signature-mismatch error, not
a friendly validation message.

### 3. Report the outcome

```http
POST /v1/media/upload/ack
Authorization: Bearer <token>
Content-Type: application/json

{
  "uploadId": "a1b2...-uuid",
  "status": "SUCCESS",              // or "FAILURE"
  "failureReason": null,            // optional, informational only (e.g. "network timeout")
  "targetField": "thumbnail"        // "thumbnail" | "preview" | omit — see below
}
```

**Response** `200 OK`:

```json
{
  "data": {
    "uploadId": "a1b2...-uuid",
    "status": "UPLOADED",           // server-confirmed — may differ from what you reported
    "storagePath": "asset/4f8e.../image/9c7f....jpg"
  }
}
```

- `targetField` **only matters for `ownerKind=BASE` uploads** — it tells the
  backend which `Template` column (`thumbnailUrl` or `previewUrl`) to write
  the uploaded media onto once verified. Omit it, or it's ignored, for a
  `ownerKind=USER` (draft) upload — see the next section for why.
- The returned `status` is the **server-verified** result, not an echo of
  what you sent. If you reported `SUCCESS` but the backend couldn't confirm
  the object actually exists in B2 (or its real size doesn't match what was
  declared), you get `422 UPLOAD_VERIFICATION_FAILED` instead of a `200` —
  treat this as "the upload didn't actually work," and let the user retry
  from step 1 (a fresh `/upload` call — the failed `MediaAsset` row is left
  as-is, a new one is created for the retry).
- Acking an already-finalized upload (one you already successfully acked, or
  one that already failed) is a harmless no-op — it just returns the current
  state. Safe to retry the ack call itself if a network blip drops the
  response.

### 4. Display the result

For a **BASE** (template) upload with `targetField` set, nothing else is
needed — the next time anything calls `GET /v1/templates/{id}` (or the
gallery `GET /v1/templates`), `thumbnailUrl`/`previewUrl` will already be the
new, resolved, signed URL.

For a **USER** (draft) upload, the backend does **not** write anything onto
the draft automatically. After a successful ack, call the **existing**
`PUT /v1/events/{eventId}/draft` with `storagePath` placed into whatever
schema field the upload was for — exactly the same way any other field value
is saved today. (See [Known gap](#known-gap-draft-media-fields-are-manual) below.)

## Known gap: draft media fields are manual

This is intentional, not a bug to report: the backend's write-back on ack is
scoped to only the two `Template` columns (`thumbnailUrl`/`previewUrl`). It
does **not** walk into a draft's `data` JSON to find and set an `image`/`audio`
field automatically. The frontend is responsible for taking the `storagePath`
from a successful `USER`-owner ack and saving it into the relevant field via
the existing draft-save endpoint.

Similarly, on the **read side**, `GET /v1/events/{id}/draft` and
`GET /v1/templates/{id}/versions/{version}` return `data`/`defaults` **as-is**
— any `image`/`audio` field value is returned as a literal storage path
string (e.g. `public/{userId}/{eventId}/image/....jpg`), **not** resolved to
a signed URL. If the frontend renders that value directly as an `<img src>`,
it will break (B2 object paths are not publicly fetchable — the bucket is
private).

**What this means for the frontend today:** a draft's `image`/`audio` field
needs its own resolution step before it's displayable — the editor/invitation
renderer must call `GET /v1/media/resolve?path=...` — **except that endpoint
does not exist yet either**. Until a resolve-on-read endpoint is added for
draft media, uploaded draft images/audio cannot be displayed back through a
normal `<img>`/`<audio>` tag from the stored path alone. Flag this explicitly
to the backend team before building the draft-media upload UI — the write
path works end-to-end, but the read/display path for draft media specifically
is not yet complete (only template thumbnail/preview has a working read path
today).

## Critical gotcha: the B2 PUT is not a backend call

`uploadUrl` is an absolute URL pointing at `s3.<region>.backblazeb2.com`, not
our API. Two things to get right:

1. **Don't use the app's default `HttpClient` the way every other service
   does.** `authTokenInterceptor` only attaches the bearer token when
   `req.url.startsWith(environment.apiBaseUrl)` — so it correctly won't leak
   the Supabase token to B2, but that also means you can't rely on the usual
   "inject `HttpClient`, call `.put()`" pattern assuming auth happens for
   free. It doesn't need to — B2 auth is entirely in the presigned query
   string — but be aware this call looks different from every other
   `this.http.*` call in the codebase.
2. **`apiBaseUrlInterceptor` passes absolute URLs through untouched** (it only
   rewrites relative paths), so the `uploadUrl` itself won't get mangled if
   you do use `HttpClient` — but prefer the raw `fetch(uploadUrl, { method:
   'PUT', headers: requiredHeaders, body: file })` for this one call, since
   it's conceptually not an API call to our backend at all, and keeps the
   interceptor chain's assumptions (every request is ours, every request may
   get a bearer token) from applying somewhere they don't belong.

## Error handling checklist

| Scenario | Status | What the UI should do |
| --- | --- | --- |
| Not authenticated | `401` | Standard auth-required handling (already exists app-wide) |
| Non-admin tries a BASE upload | `403` | Shouldn't be reachable from the UI at all — hide the control for non-admins |
| Unknown/not-owned template or event | `404` | Generic "couldn't find that template/event" — note: a *not-owned* event also surfaces as 404, by design (see backend story notes) — don't build any 403-specific messaging for this path |
| Bad `contentType`/oversized file (request time) | `422` | Validate client-side first for fast feedback, but handle the 422 too in case client-side validation is bypassed or stale |
| B2 verification failed after upload | `422` (`UPLOAD_VERIFICATION_FAILED`, from the **ack** call) | "Upload didn't complete — please try again." Restart from step 1 |
| B2 is down/erroring during verification | `502` (`MEDIA_STORAGE_ERROR`) | Transient — safe to retry the ack, or restart from step 1 |
| B2 not configured on this environment | `503` (`MEDIA_STORAGE_NOT_CONFIGURED`) | "Uploads aren't available right now" — distinct from a user-facing error, this is an environment/ops issue |
| The raw `PUT` to `uploadUrl` itself fails (network, expired presign) | Whatever `fetch` reports — B2 doesn't use our error envelope here | Treat as "failed" — call `/upload/ack` with `status: "FAILURE"` so the backend's bookkeeping is accurate, then let the user retry from step 1 |

## Suggested frontend shape (not yet built)

A single `MediaUploadService` (new, under `src/app/core/services/` or a new
`src/app/features/media/` if it grows) with roughly:

```ts
requestUpload(req: MediaUploadRequest): Promise<MediaUploadOut>   // POST /v1/media/upload
uploadToStorage(url: string, headers: Record<string,string>, file: File): Promise<void>  // raw fetch PUT
ackUpload(req: MediaAckRequest): Promise<MediaAckOut>             // POST /v1/media/upload/ack
```

And one composed helper most call sites will actually use:

```ts
uploadMedia(file: File, opts: { ownerKind, ownerId, mediaType, targetField? }): Promise<MediaAckOut>
```

— wrapping all three steps, converting a thrown `fetch` error from step 2
into a `FAILURE` ack automatically, matching the error-handling checklist
above.

## Out of scope (for both this doc and the current backend implementation)

- No draft-media **read/resolve** endpoint yet (see [Known gap](#known-gap-draft-media-fields-are-manual)) — needs a backend follow-up before draft image/audio upload is fully usable end-to-end.
- No upload progress reporting from the backend — a large-file progress bar, if wanted, has to come from the raw `fetch`/`XMLHttpRequest` upload-progress event on the step-2 PUT, not from any API response.
- No bulk/multi-file upload endpoint — one `/upload` + one `/ack` per file.
- No client-side image resizing/compression — whatever the user picks must already satisfy the size caps above.
