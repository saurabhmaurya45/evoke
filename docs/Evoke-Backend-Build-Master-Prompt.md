# Evoke Backend Implementation — Independent Backend Architecture & Build Prompt

## Role

You are the **Principal Software Architect and Senior Backend Engineering Lead** responsible for designing and implementing the backend for **Evoke**, an event-management SaaS platform initially focused on premium wedding and engagement invitation websites.

You are NOT implementing "a backend for the current Angular code."

You are designing a **correct, secure, scalable, maintainable backend product** and then integrating the frontend with it.

The existing Angular application is an important consumer and source of product context, but it is **not the authority that constrains backend architecture**.

Your priorities are:

1. Correct domain modeling.
2. Security and authorization.
3. Clean backend architecture.
4. Strong persistence and data integrity.
5. Stable and well-designed APIs.
6. Supabase Auth as the identity authority, behind a swappable `IdentityProvider` abstraction.
7. Thin Auth Service as the application identity boundary.
8. Correct draft/version/publishing semantics.
9. Scalable public invitation delivery.
10. Production-quality testing and observability.
11. Frontend adaptation where required.
12. Avoiding premature infrastructure and microservices.

---

# 1. Backend Architecture Is Independent of the Frontend — CRITICAL

The backend MUST be designed independently.

Do **not** compromise backend architecture because the current frontend:

- does not have authentication UI yet;
- currently uses localStorage;
- has a particular route structure;
- has a particular TypeScript interface;
- has a temporary repository;
- lacks an API integration;
- has incomplete features;
- has frontend-specific abstractions;
- currently models a concept differently.

If the correct backend architecture requires frontend changes, **make the frontend changes**.

The priority is:

```text
Product Requirements
        ↓
Security
        ↓
Domain Model
        ↓
Backend Architecture
        ↓
Persistence Model
        ↓
API Contract
        ↓
Frontend Adaptation
```

NOT:

```text
Existing Frontend
        ↓
Force Backend To Match It
```

The backend must never be weakened merely to preserve an existing frontend implementation.

## Frontend Is an Integration Consumer

Inspect the frontend deeply, but use it for:

- understanding the current product;
- identifying existing template concepts;
- understanding editor behavior;
- identifying reusable contracts;
- determining integration requirements;
- identifying migration work;
- estimating frontend changes.

Do NOT use it as a reason to accept a poor backend design.

The correct relationship is:

```text
                    Backend Architecture
                            |
                            v
                     Stable API Contract
                            |
                 ┌──────────┴──────────┐
                 ↓                     ↓
           Backend Tests          Frontend Adapter
                                       |
                                       ↓
                              Angular Application
```

If the frontend and backend disagree, determine which model is correct based on product requirements and engineering principles.

The result may be:

```text
Backend unchanged + frontend changed
```

or:

```text
Backend changed + frontend changed
```

or:

```text
Backend unchanged + compatibility layer
```

The result must NOT automatically be:

```text
Backend compromised to match frontend
```

---

## 1.1 Supabase Portability Boundary — CRITICAL

Supabase is the initial identity, database, and object storage provider. It is an implementation detail, not the architecture.

The backend MUST be built so that Supabase can be replaced without rewriting domain or business logic:

- Business logic — draft concurrency/409 handling, immutable publish snapshots, template schema validation, billing/entitlement rules — MUST live in the backend's own service code. Do NOT implement this logic only in Supabase Edge Functions, and do NOT rely solely on database triggers/RLS to enforce it.
- Use plain SQL migrations or a standard framework-native migration tool (e.g. the ORM's migration system). Do NOT depend on a Supabase-CLI-only migration format.
- Backend domain modules must talk to PostgreSQL via a normal connection string/ORM, not the Supabase client SDK, for business logic. The Supabase client SDK may be used inside the `SupabaseIdentityProvider`/`SupabaseStorageProvider` adapters only.
- Row Level Security (RLS) policies may be added as defense-in-depth, mirroring the same RBAC + ownership rules already enforced in the application layer. The application layer remains the authoritative enforcement point — RLS is a backstop, not a substitute.
- A future migration away from Supabase should only require: swapping the `SupabaseIdentityProvider`/`SupabaseStorageProvider` adapters for alternatives, repointing the PostgreSQL connection string, and re-running the same plain-SQL migrations against the new database — NOT rewriting domain/business logic or the public API contract.

---

# 2. Architecture Documents Are Inputs, Not Restrictions

The workspace may contain:

```text
Evoke-Frontend-Backend-Contract-Architecture-Specification.md
```

and other architecture documents.

Read them carefully.

However, treat them as:

```text
Architecture Proposal
+
Product Context
+
Current Design Decisions
```

not as an immutable backend specification.

If your independent backend analysis identifies a better approach:

1. Explain the difference.
2. Compare alternatives.
3. Document the trade-off.
4. Update the architecture decision.
5. Update the API contract.
6. Identify frontend changes required.
7. Implement the better design.

Do not preserve an inferior backend design simply because it appeared in an earlier markdown file.

---

# 3. Mission

Build a production-quality backend for this product:

```text
User
  |
  v
Authentication
  |
  v
Dashboard
  |
  v
Create Event / Wedding
  |
  v
Select Template
  |
  v
Editor
  |
  v
Draft / Autosave
  |
  v
Media
  |
  v
Preview
  |
  v
Publish
  |
  v
Published Invitation
  |
  v
Public URL
  |
  +---- Guests
  |
  +---- RSVP
```

The platform must eventually support:

```text
Wedding
Engagement
Birthday
Baby Shower
Corporate Event
Conference
Party
Other Event
```

Phase 1 may expose only Wedding and Engagement.

The backend must model the product so these future event types do not require a fundamental rewrite.

---

# 4. Independent Backend Design Process

Before writing implementation code, the Architect Agent MUST independently evaluate:

### Domain

- What are the true business entities?
- What are their lifecycle states?
- What relationships exist?
- Which data should be relational?
- Which data should be JSON/document-oriented?
- What must be immutable?
- What requires versioning?

### Authentication

- What should Supabase Auth own?
- What should the Auth Service own (via an `IdentityProvider` interface)?
- How should application identity be represented?
- How should roles and resource authorization work?

### API

- REST or another API style?
- Resource boundaries?
- Versioning?
- Pagination?
- Filtering?
- Error model?
- Idempotency?
- Concurrency?

### Persistence

- PostgreSQL schema.
- Constraints.
- Indexes.
- Transactions.
- JSONB boundaries.
- Versioning.
- Auditability.

### Templates

- Template lifecycle.
- Template versions.
- Schema versions.
- Runtime/protocol versions.
- Template storage.
- Template validation.

### Editor/Drafts

- Draft model.
- Autosave.
- Revision control.
- Conflict handling.
- Schema migrations.

### Media

- Object storage.
- Upload architecture.
- Asset lifecycle.
- Processing.
- CDN.

### Publishing

- Immutable published snapshots.
- Versioning.
- Slugs.
- Rollback.
- Cache invalidation.
- Public rendering.

### Public Traffic

- CDN strategy.
- Public API.
- Caching.
- Rate limiting.
- Guest traffic isolation.

### Operations

- Logging.
- Metrics.
- Tracing.
- Health checks.
- Deployment.
- Backups.
- Secrets.

For every major decision produce:

```text
Problem
Options
Chosen approach
Why
Trade-offs
Risks
Migration impact
Frontend impact
```

Frontend impact is an OUTPUT of the backend design.

It is not an input that overrides the backend design.

---

# 4. Architectural Style

Start as a **modular monolith**.

Do NOT create eight independently deployed microservices.

The backend should have clear internal modules:

``` text
backend/
├── auth/
├── users/
├── events/
├── templates/
├── drafts/
├── media/
├── publishing/
├── guests/
├── rsvps/
├── public/
└── shared/
```

These are domain boundaries, not necessarily deployment boundaries.

Later, modules may be extracted into separate services only if justified
by:

-   independent scaling;
-   independent deployment;
-   security isolation;
-   operational ownership;
-   measured performance requirements;
-   organizational boundaries.

------------------------------------------------------------------------

# 5. Agent Strategy

Use specialized agents where supported.

Do not have every agent modify the same files simultaneously.

Use this workflow:

``` text
                    ARCHITECT AGENT
                          |
             Architecture + task breakdown
                          |
        ┌─────────────────┼─────────────────┐
        |                 |                 |
   DATA AGENT         AUTH AGENT       API AGENT
        |                 |                 |
        └─────────────────┼─────────────────┘
                          |
                    DOMAIN AGENTS
                          |
        ┌─────────┬───────┼────────┬─────────┐
        |         |       |        |         |
      EVENT    TEMPLATE  DRAFT    MEDIA   PUBLISH
        |         |       |        |         |
        └─────────┴───────┼────────┴─────────┘
                          |
                     TEST AGENT
                          |
                   SECURITY AGENT
                          |
                 INTEGRATION AGENT
                          |
                   REVIEW AGENT
```

## Agent rules

Each agent must:

1.  Read the architecture specification first.
2.  Inspect existing code before changing anything.
3.  Respect existing conventions.
4.  Avoid modifying unrelated files.
5.  Report assumptions.
6.  Report architectural conflicts.
7.  Add tests for its changes.
8.  Never weaken security to make a test pass.
9.  Never silently change an API contract.
10. Provide a concise implementation report.

The final integration agent is responsible for reconciling changes.

------------------------------------------------------------------------

# 6. Recommended Agent Responsibilities

## Agent 0 --- Principal Architect

Responsibilities:

-   Inspect entire repository.
-   Inspect frontend contracts.
-   Build backend dependency graph.
-   Identify missing decisions.
-   Create implementation plan.
-   Identify risks.
-   Define module ownership.
-   Define implementation order.

Do not start feature coding until this agent has produced the
implementation plan.

------------------------------------------------------------------------

## Agent 1 --- Database Architect

Responsibilities:

-   Design PostgreSQL schema.
-   Define migrations.
-   Define indexes.
-   Define foreign keys.
-   Define unique constraints.
-   Define enum/status strategy.
-   Define JSONB boundaries.
-   Define optimistic concurrency.
-   Define audit fields.

Core entities:

``` text
users
events
event_versions
templates
template_versions
drafts
media_assets
published_events
guests
rsvps
payments
entitlements
audit_logs
```

Do not introduce unnecessary future tables.

------------------------------------------------------------------------

## Agent 2 --- Supabase Auth Specialist

Responsibilities:

-   Supabase project configuration (enabled auth providers, redirect URLs, JWT signing key/JWKS rotation).
-   Auth Service integration via an `IdentityProvider` interface, with an initial `SupabaseIdentityProvider` implementation. Document `KeycloakIdentityProvider`, `Auth0IdentityProvider`, and `CognitoIdentityProvider` as future alternative adapters — do not implement them now, just keep the interface honest to that possibility.
-   JWT validation against Supabase's JWKS endpoint.
-   JWKS handling and caching.
-   Audience validation.
-   Issuer validation.
-   Role mapping.
-   User provisioning, keyed on `auth_user_id` — never on email.
-   Login flows.
-   Google/OIDC integration via Supabase's built-in providers.
-   Logout.
-   `/me`.
-   Error handling.

Security requirements (apply identically regardless of which `IdentityProvider` is active — currently Supabase's JWKS):

-   Never log tokens.
-   Never log passwords.
-   Never store passwords.
-   Validate token issuer.
-   Validate audience.
-   Validate expiration.
-   Validate signature.
-   Validate algorithm.
-   Validate required claims.
-   Cache the identity provider's public keys (Supabase JWKS) safely.

------------------------------------------------------------------------

## Agent 3 --- API Contract Specialist

Responsibilities:

-   OpenAPI specification.
-   URL structure.
-   HTTP verbs.
-   Request models.
-   Response models.
-   Error models.
-   Pagination.
-   Filtering.
-   Sorting.
-   API versioning.
-   Validation behavior.

All APIs begin with:

``` text
/v1
```

------------------------------------------------------------------------

## Agent 4 --- Event/Wedding Domain Specialist

Responsibilities:

-   Event model.
-   Event CRUD.
-   Ownership.
-   Event types.
-   Slugs.
-   Event status.
-   Event metadata.
-   Dashboard queries.
-   Event lifecycle.

Primary principle:

``` text
Event/Wedding is the business entity.
Template is selected by the Event.
```

------------------------------------------------------------------------

## Agent 5 --- Template Platform Specialist

Responsibilities:

-   Template catalog.
-   Template metadata.
-   Template versions.
-   Schema versions.
-   Protocol versions.
-   Capabilities.
-   Template publication.
-   Template validation.
-   Template runtime metadata.

Must support:

``` text
templateVersion
schemaVersion
protocolVersion
```

as independent versions.

New templates must use:

``` text
bindingMode = explicit
```

Do not introduce new legacy template mapping.

------------------------------------------------------------------------

## Agent 6 --- Draft/Editor Integration Specialist

Responsibilities:

-   Draft persistence.
-   Draft loading.
-   Autosave.
-   Revision handling.
-   Optimistic concurrency.
-   Schema migration.
-   Template compatibility.
-   Editor API contract.

Draft document:

``` json
{
  "templateId": "tpl_royal",
  "templateVersion": 4,
  "schemaVersion": 2,
  "data": {},
  "revision": 17
}
```

A stale revision should produce:

``` text
409 CONFLICT
```

Do not silently overwrite another revision.

------------------------------------------------------------------------

## Agent 7 --- Media Specialist

Responsibilities:

-   Asset model.
-   Upload initiation.
-   Presigned URLs.
-   Upload confirmation.
-   Object storage integration.
-   Asset ownership.
-   MIME validation.
-   Size validation.
-   Image metadata.
-   Asset lifecycle.
-   CDN URLs.

Object storage must be accessed through a `StorageProvider` interface, with `SupabaseStorageProvider` as the initial implementation. Supabase Storage is S3-compatible, so switching cost to a raw S3/GCS-backed provider later is low — do not hard-code Supabase-specific storage calls into domain/application code.

Preferred flow:

``` text
Browser
  |
  v
Backend → presigned upload URL
  |
  v
Object Storage
  |
  v
Browser confirms
  |
  v
Backend marks asset READY
```

Never require large media files to pass through the main application
server unless explicitly justified.

------------------------------------------------------------------------

## Agent 8 --- Publishing Specialist

Responsibilities:

-   Publish validation.
-   Immutable published snapshots.
-   Published versions.
-   Public URLs.
-   Slugs.
-   Cache invalidation.
-   Rollback.
-   Unpublish if supported.
-   Publish audit trail.

Publishing must never mutate the draft into an irreversible state.

------------------------------------------------------------------------

## Agent 9 --- Public Invitation Specialist

Responsibilities:

-   Public wedding endpoint.
-   Published snapshot retrieval.
-   Public caching.
-   CDN compatibility.
-   SEO payload.
-   Public performance.
-   No authentication requirement.

Public invitation traffic must not require Supabase Auth (or any `IdentityProvider`).

------------------------------------------------------------------------

## Agent 10 --- Guest/RSVP Specialist

Responsibilities:

-   Guest management.
-   Public RSVP.
-   RSVP validation.
-   Rate limiting.
-   Abuse prevention.
-   Owner-only RSVP management.
-   Guest privacy.

------------------------------------------------------------------------

## Agent 10.5 --- Billing/Entitlements Specialist

Responsibilities:

-   Payment and entitlement domain model (`payments`, `entitlements`).
-   `PaymentProvider` interface plus an initial adapter. Either Razorpay or Stripe is an acceptable initial choice — pick one, document the choice, and keep the interface provider-agnostic.
-   Checkout endpoint and webhook handling.
-   Entitlement grants after successful payment.
-   Publish-time entitlement enforcement (see Publishing APIs).
-   Admin metrics and admin customer aggregate queries.

Rule this agent must follow: admin metrics/customer aggregates (revenue, customer counts, RSVP totals, per-customer plan/revenue) MUST be computed on demand from `users`, `events`, and `payments` — NOT stored in separate hand-maintained aggregate tables. If a materialized view or cache is later needed for performance, it must be derivable/rebuildable from these source tables at any time.

Webhook handling must be idempotent: replayed provider webhooks must never double-grant entitlements or double-record payments.

------------------------------------------------------------------------

## Agent 11 --- Security Specialist

Perform an independent security review after implementation.

Check:

-   Authentication.
-   Authorization.
-   IDOR.
-   Ownership checks.
-   JWT validation.
-   CORS.
-   CSRF where applicable.
-   SSRF.
-   SQL injection.
-   Mass assignment.
-   File upload vulnerabilities.
-   MIME spoofing.
-   Path traversal.
-   XSS.
-   Template injection.
-   Open redirects.
-   Rate limiting.
-   Sensitive logging.
-   Secrets management.
-   Security headers.

------------------------------------------------------------------------

## Agent 12 --- Test/QA Specialist

Build:

-   Unit tests.
-   Integration tests.
-   API contract tests.
-   Database tests.
-   Auth tests.
-   Authorization tests.
-   Template contract tests.
-   Publishing tests.
-   Public API tests.
-   Media tests.

Prioritize tests around security and state transitions.

------------------------------------------------------------------------

## Agent 13 --- Observability Specialist

Implement:

-   Structured logging.
-   Request ID.
-   Trace ID.
-   Metrics.
-   Health checks.
-   Readiness checks.
-   Liveness checks.
-   Database health.
-   Identity provider (Supabase Auth) dependency health.
-   Object storage health.

Never expose credentials or tokens in telemetry.

------------------------------------------------------------------------

## Agent 14 --- Final Architecture Reviewer

After all implementation agents finish:

-   Read the complete backend.
-   Read the frontend contract.
-   Review API compatibility.
-   Review database model.
-   Review security.
-   Review performance.
-   Review module boundaries.
-   Review tests.
-   Review deployment.
-   Identify over-engineering.
-   Identify missing requirements.
-   Produce final architecture report.

This agent must be allowed to reject implementation decisions that
violate the architecture.

------------------------------------------------------------------------

# 7. Backend Project Structure

Use a structure appropriate to the selected backend framework, but
preserve domain boundaries.

Preferred conceptual structure:

``` text
src/
├── app/
│   ├── auth/
│   │   ├── api/
│   │   ├── application/
│   │   ├── domain/
│   │   └── infrastructure/
│   │
│   ├── users/
│   ├── events/
│   ├── templates/
│   ├── drafts/
│   ├── media/
│   ├── publishing/
│   ├── guests/
│   ├── rsvps/
│   ├── public/
│   │
│   └── shared/
│       ├── auth/
│       ├── database/
│       ├── errors/
│       ├── logging/
│       ├── pagination/
│       ├── storage/
│       └── validation/
│
├── migrations/
└── tests/
```

Do not create artificial abstractions just to make the folder tree look
enterprise-grade.

------------------------------------------------------------------------

# 8. Layering

Each domain should follow a clean boundary where appropriate:

``` text
API
 ↓
Application
 ↓
Domain
 ↓
Infrastructure
```

### API

Handles:

-   HTTP.
-   Serialization.
-   Request validation.
-   Authentication context.
-   HTTP response mapping.

### Application

Handles:

-   Use cases.
-   Transactions.
-   Orchestration.

### Domain

Handles:

-   Business rules.
-   State transitions.
-   Domain invariants.

### Infrastructure

Handles:

-   PostgreSQL.
-   Identity provider integration (`IdentityProvider`, initially `SupabaseIdentityProvider`).
-   Object storage (`StorageProvider`, initially `SupabaseStorageProvider`).
-   Redis.
-   External providers.

Do not force every trivial CRUD operation into ten classes.

Use judgment.

------------------------------------------------------------------------

# 9. Authentication Contract

Implement:

``` text
GET  /v1/auth/login
GET  /v1/auth/callback
POST /v1/auth/signup
POST /v1/auth/logout
GET  /v1/auth/me
```

Potential future endpoints:

``` text
POST /v1/auth/refresh
POST /v1/auth/verify-email
POST /v1/auth/forgot-password
POST /v1/auth/reset-password
```

But if Supabase Auth handles a flow directly (e.g. password reset, email verification, OAuth redirect), do not duplicate it
unnecessarily in the Auth Service.

------------------------------------------------------------------------

# 10. User Provisioning

After successful Supabase Auth authentication (via the `IdentityProvider` abstraction):

``` text
Identity provider (Supabase Auth) identity
      |
      v
Find application user by authUserId
      |
      ├── exists → return
      |
      └── missing → provision user
```

Never use email as the primary identity mapping key.

Use:

``` text
authUserId
```

as the stable identity relationship. This key must remain provider-agnostic in naming so a future `IdentityProvider` swap does not require a column rename.

------------------------------------------------------------------------

# 11. Roles

Initial roles:

``` text
USER
EDITOR
ADMIN
```

Note: EDITOR is reserved for a later phase. The current frontend only implements USER and ADMIN. Keep EDITOR fully documented and modeled in the backend's role system so it can be enabled without a redesign, but do not build frontend UI or gate current features behind it yet.

Do not encode all business permissions directly into role names.

Use:

``` text
Role
+
Resource ownership
+
Operation
+
State
```

Example:

``` text
USER
+
event.ownerId == authenticatedUser.id
+
event.status == DRAFT
+
PATCH
=
allowed
```

------------------------------------------------------------------------

# 12. Event APIs

Implement:

``` http
POST   /v1/events
GET    /v1/events
GET    /v1/events/{eventId}
PATCH  /v1/events/{eventId}
DELETE /v1/events/{eventId}
```

Create:

``` json
{
  "type": "WEDDING",
  "title": "Aarav & Diya"
}
```

Response:

``` json
{
  "data": {
    "id": "evt_123",
    "type": "WEDDING",
    "title": "Aarav & Diya",
    "status": "DRAFT"
  }
}
```

------------------------------------------------------------------------

# 13. Event Status

Define an explicit state machine.

Possible initial states:

``` text
DRAFT
PUBLISHED
ARCHIVED
```

Do not allow arbitrary status strings.

Define legal transitions.

Example:

``` text
DRAFT → PUBLISHED
PUBLISHED → DRAFT
PUBLISHED → ARCHIVED
DRAFT → ARCHIVED
```

Whether `PUBLISHED → DRAFT` means "unpublish" or "create a new draft
while preserving published state" must be explicitly modeled.

Prefer:

``` text
Event status = lifecycle
Published pointer = live version
Draft = editable state
```

rather than overloading one status field.

------------------------------------------------------------------------

# 14. Template APIs

Implement:

``` http
GET  /v1/templates
GET  /v1/templates/{templateId}
GET  /v1/templates/{templateId}/versions/{version}

POST /v1/templates
POST /v1/templates/{templateId}/versions
POST /v1/templates/{templateId}/versions/{version}/publish
PATCH /v1/templates/{templateId}
```

EDITOR and ADMIN can manage template content.

USER can consume published templates.

`PATCH /v1/templates/{templateId}` is ADMIN-only and, in addition to content fields, can set commerce/storefront fields:

``` text
pricingModel        FREE | PAID
priceAmountMinor
currency
storefrontStatus    LISTED | UNLISTED
```

`storefrontStatus` is distinct from the existing template `status` (content/version readiness) — it controls whether the template is shown in the customer-facing catalog, independent of whether it is technically publishable.

------------------------------------------------------------------------

# 15. Template Schema Validation

Backend must validate:

-   Template ID.
-   Version.
-   Sections.
-   Duplicate keys.
-   Field types.
-   Bindings.
-   List schemas.
-   Capabilities.
-   Defaults.
-   Protocol compatibility.

The backend should not blindly trust frontend validation.

Frontend validation is UX.

Backend validation is authoritative.

------------------------------------------------------------------------

# 16. Draft APIs

Implement:

``` http
GET /v1/events/{eventId}/draft
PUT /v1/events/{eventId}/draft
```

Request:

``` json
{
  "templateId": "tpl_royal",
  "templateVersion": 4,
  "schemaVersion": 2,
  "data": {},
  "revision": 17
}
```

Backend must:

1.  Authenticate.
2.  Authorize ownership.
3.  Validate template.
4.  Validate schema.
5.  Validate data.
6.  Validate revision.
7.  Persist.
8.  Increment revision.
9.  Return new revision.

------------------------------------------------------------------------

# 17. Media APIs

Implement approximately:

``` http
POST /v1/media/uploads
POST /v1/media/uploads/{assetId}/complete
GET  /v1/media/{assetId}
DELETE /v1/media/{assetId}
```

Upload request:

``` json
{
  "eventId": "evt_123",
  "fileName": "couple.webp",
  "contentType": "image/webp",
  "size": 1234567
}
```

Response:

``` json
{
  "data": {
    "assetId": "asset_123",
    "uploadUrl": "https://...",
    "expiresAt": "..."
  }
}
```

------------------------------------------------------------------------

# 18. Media Security

Validate:

-   Authenticated owner.
-   File size.
-   Allowed MIME types.
-   Extension/content consistency.
-   Object key ownership.
-   Upload expiration.
-   Asset status.
-   Virus/malware scanning strategy where required.

Never trust the browser-provided MIME type alone.

------------------------------------------------------------------------

# 19. Publishing APIs

Implement:

``` http
POST /v1/events/{eventId}/publish
GET  /v1/events/{eventId}/published
```

Publishing must create:

``` text
immutable published version
```

Example:

``` json
{
  "data": {
    "eventId": "evt_123",
    "publishedVersion": 18,
    "slug": "aarav-and-diya",
    "url": "https://evoke.example.com/w/aarav-and-diya"
  }
}
```

Publishing must also enforce entitlement: if the event's template has `pricingModel == PAID`, the requesting user must hold a matching, active `entitlement` for that template. If not, reject the publish request with `TEMPLATE_NOT_ENTITLED` rather than allowing the publish to proceed.

------------------------------------------------------------------------

# 19.5 Billing APIs

Implement:

``` http
POST /v1/payments/checkout
POST /v1/payments/webhook
GET  /v1/users/me/entitlements
GET  /v1/admin/metrics
GET  /v1/admin/customers
```

`POST /v1/payments/checkout` creates a checkout session with the active `PaymentProvider` for a given template/plan and returns a redirect/session reference.

`POST /v1/payments/webhook` receives asynchronous payment provider events (e.g. payment succeeded, payment failed) and must be idempotent — replays of the same provider event must not double-grant entitlements or double-record a payment.

`GET /v1/users/me/entitlements` returns the authenticated user's active entitlements.

`GET /v1/admin/metrics` and `GET /v1/admin/customers` are ADMIN-only and return aggregate revenue/customer/RSVP metrics and per-customer plan/revenue data, computed on demand from `users`, `events`, and `payments` — never from a separately maintained aggregate table.

------------------------------------------------------------------------

# 20. Public APIs

Implement:

``` http
GET /v1/public/weddings/{slug}
POST /v1/public/weddings/{slug}/rsvp
```

No Supabase Auth (or any `IdentityProvider`) authentication required.

Public API must be:

-   Read optimized.
-   Cache friendly.
-   Rate limited.
-   Safe from data leakage.
-   Based only on published data.

Never return private draft fields.

------------------------------------------------------------------------

# 21. Database Requirements

Use PostgreSQL.

Core tables:

``` text
users
events
drafts
event_versions
templates
template_versions
media_assets
published_events
guests
rsvps
payments
entitlements
audit_logs
```

Every table should have appropriate:

``` text
id
created_at
updated_at
```

where applicable.

Use foreign keys.

Use indexes based on actual access patterns.

Important indexes likely include:

``` text
users.auth_user_id
users.email
events.owner_id
events.slug
drafts.event_id
media_assets.event_id
published_events.public_slug
guests.event_id
rsvps.guest_id
payments.user_id
payments.template_id
entitlements.user_id
entitlements.template_id
```

Do not blindly add indexes to every column.

------------------------------------------------------------------------

# 22. Data Integrity

Enforce at database level wherever possible:

-   Unique public slug.
-   Unique identity provider (`auth_user_id`) user mapping.
-   Foreign key relationships.
-   Valid revision relationships where possible.
-   Unique template version per template.
-   Unique published version per event.

Application validation is not a replacement for database constraints.

------------------------------------------------------------------------

# 23. Transactions

Use transactions for operations such as:

``` text
Create event + initial draft
Publish event + published pointer
Create user + initial application profile
Complete media upload + asset state transition
```

Avoid distributed transactions unless genuinely required.

------------------------------------------------------------------------

# 24. Error Model

All errors should map to:

``` json
{
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "The requested event was not found.",
    "requestId": "req_123",
    "details": {}
  }
}
```

Define stable error codes.

Examples:

``` text
AUTH_REQUIRED
AUTH_FORBIDDEN
USER_NOT_FOUND
EVENT_NOT_FOUND
EVENT_ACCESS_DENIED
TEMPLATE_NOT_FOUND
TEMPLATE_VERSION_NOT_FOUND
INVALID_TEMPLATE_SCHEMA
INVALID_TEMPLATE_DATA
DRAFT_CONFLICT
MEDIA_NOT_FOUND
MEDIA_UPLOAD_EXPIRED
PUBLISH_VALIDATION_FAILED
SLUG_ALREADY_EXISTS
RSVP_RATE_LIMITED
TEMPLATE_NOT_ENTITLED
```

Do not expose stack traces.

------------------------------------------------------------------------

# 25. Pagination

Collections must support pagination.

Preferred:

``` text
?page=1&pageSize=20
```

or cursor pagination if the implementation benefits from it.

The response must include enough information for Angular to build:

``` text
pagination controls
infinite scrolling
load more
```

Do not return thousands of records by default.

------------------------------------------------------------------------

# 26. Filtering

Templates should support:

``` text
category
search
sort
page
pageSize
```

Events should support:

``` text
status
type
search
sort
page
pageSize
```

Keep filtering explicit.

Do not expose arbitrary database query parameters.

------------------------------------------------------------------------

# 27. OpenAPI

Generate and maintain OpenAPI documentation.

The OpenAPI specification must cover:

-   Authentication.
-   Events.
-   Templates.
-   Drafts.
-   Media.
-   Publishing.
-   Public APIs.
-   RSVP.
-   Error responses.

The OpenAPI document is a major frontend/backend contract artifact.

------------------------------------------------------------------------

# 28. Frontend Integration Requirements

Ensure the backend supports these frontend repositories:

``` text
AuthRepository
UserRepository
EventRepository
TemplateRepository
DraftRepository
MediaRepository
PublishingRepository
PublicWeddingRepository
RSVPRepository
PaymentRepository
EntitlementRepository
```

The frontend should not need to know database structures.

------------------------------------------------------------------------

# 29. Editor Integration

The existing frontend has:

``` text
TemplateEditorStore
TemplateSchemaLoader
Template contract validator
TemplateRenderer
Preview protocol
TemplateRepository
```

Do not replace these.

Add the backend behind the repository boundaries.

The migration should look like:

``` text
CURRENT

TemplateEditorStore
       |
       v
LocalStorageTemplateRepository


TARGET

TemplateEditorStore
       |
       v
ApiDraftRepository
       |
       v
/v1/events/{eventId}/draft
```

------------------------------------------------------------------------

# 30. Local Storage Transition

The current local storage repository can remain temporarily.

Do not make production persistence dependent on localStorage.

Production source of truth:

``` text
PostgreSQL
```

Local storage may be used as:

``` text
temporary cache
offline recovery
development fallback
```

only if clearly controlled.

------------------------------------------------------------------------

# 31. Public Invitation Runtime Contract

The runtime needs:

``` json
{
  "slug": "aarav-and-diya",
  "template": {
    "id": "tpl_royal",
    "templateVersion": 4,
    "schemaVersion": 2,
    "protocolVersion": 1,
    "runtimeUrl": "..."
  },
  "data": {},
  "seo": {
    "title": "Aarav & Diya",
    "description": "...",
    "imageUrl": "...",
    "canonicalUrl": "..."
  }
}
```

Do not expose:

``` text
ownerId
internal notes
draft revisions
private guest data
administrative metadata
```

unless explicitly needed.

------------------------------------------------------------------------

# 32. Public Performance

Public invitation pages should be designed around:

``` text
CDN
+
published snapshot
+
optimized media
+
minimal API calls
```

Do not require:

``` text
Guest
 → Auth
 → Dashboard API
 → Event API
 → Template API
 → Media API
```

A guest should ideally require:

``` text
Guest
 → CDN/Public API
 → Published Snapshot
```

------------------------------------------------------------------------

# 33. Observability

Implement structured logs.

Minimum context:

``` text
timestamp
level
service/module
requestId
traceId
userId
eventId
templateId
operation
duration
status
```

Implement metrics for:

``` text
HTTP latency
HTTP errors
auth failures
draft saves
draft conflicts
publish success/failure
media upload failures
public API latency
RSVP submissions
rate-limit events
database latency
```

------------------------------------------------------------------------

# 34. Health Endpoints

Implement:

``` http
GET /health
GET /ready
```

`/health` should indicate process health.

`/ready` should verify required dependencies needed for serving traffic.

Do not make liveness depend on every external system.

------------------------------------------------------------------------

# 35. Security Headers

Production API and web deployment should consider:

``` text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Strict-Transport-Security
Permissions-Policy
```

Do not blindly copy a CSP that breaks legitimate frontend/template
behavior.

Test it.

------------------------------------------------------------------------

# 36. CORS

CORS must be explicit.

Do not use:

``` text
*
```

for authenticated production APIs.

Configure trusted origins per environment:

``` text
development
staging
production
```

------------------------------------------------------------------------

# 37. Secrets

All secrets must come from environment/secret management.

Never commit:

``` text
Supabase service role key / JWT signing secret
database password
storage credentials
JWT secrets
API keys
OAuth secrets
PaymentProvider API keys/webhook signing secrets
```

Use `.env.example` with placeholders only.

------------------------------------------------------------------------

# 38. Configuration

Create typed configuration.

Separate:

``` text
application
database
identity provider (Supabase Auth)
storage
payments
redis
observability
CORS
rate limits
```

Do not scatter environment variable reads throughout business logic.

------------------------------------------------------------------------

# 39. Environment Strategy

Support:

``` text
development
test
staging
production
```

Configuration must be explicit.

Do not make production behavior depend on development defaults.

------------------------------------------------------------------------

# 40. Testing Requirements

Minimum test layers:

``` text
Unit
Integration
API/contract
Security
End-to-end
```

Important tests:

### Authentication

-   Invalid token.
-   Expired token.
-   Wrong issuer.
-   Wrong audience.
-   Missing required claim.
-   Valid token.
-   User provisioning.
-   Existing user login.
-   Role mapping.

### Authorization

-   User can access own event.
-   User cannot access another event.
-   Editor can manage templates.
-   User cannot manage templates.
-   Admin can manage users.
-   Public user cannot access private APIs.

### Draft

-   Load draft.
-   Save draft.
-   Revision increment.
-   Stale revision returns 409.
-   Invalid schema rejected.
-   Invalid data rejected.
-   Older draft migration.
-   Newer draft rejected.

### Publishing

-   Invalid draft cannot publish.
-   Unauthorized user cannot publish.
-   Published version is immutable.
-   Public endpoint only sees published data.
-   Slug collision handled.

### Media

-   Unauthorized upload denied.
-   Invalid content type denied.
-   Oversized file denied.
-   Expired upload denied.
-   Wrong event ownership denied.

### RSVP

-   Valid RSVP accepted.
-   Invalid RSVP rejected.
-   Rate limit works.
-   Private guest data is not exposed.

------------------------------------------------------------------------

# 41. Contract Testing

Build contract tests between:

``` text
Angular API expectations
        ↕
OpenAPI
        ↕
Backend implementation
```

Where possible, generate frontend API types from OpenAPI.

The contract should catch:

-   Renamed fields.
-   Removed fields.
-   Type mismatches.
-   Incorrect status codes.
-   Missing required properties.
-   Broken error structures.

------------------------------------------------------------------------

# 42. Template CI

Create a backend/CI validation command if templates are accessible to
the backend build:

``` bash
npm run validate:templates
```

or equivalent.

It should verify:

``` text
registry
schema
defaults
bindings
version
protocol
capabilities
```

No invalid template should be deployable.

------------------------------------------------------------------------

# 43. Do Not Over-Engineer

This is a zero-to-one product.

Do NOT add without a real requirement:

``` text
Kafka
Kubernetes
Service Mesh
GraphQL
CQRS everywhere
Event Sourcing
Saga orchestration
Multiple databases
Ten microservices
Complex workflow engine
Distributed locks everywhere
```

Start with:

``` text
Modular Monolith
PostgreSQL
Supabase Auth (behind IdentityProvider abstraction)
Object Storage (behind StorageProvider abstraction)
Redis only where useful
Queue only where async work requires it
```

Keep the portability requirement in mind here too: the reason for the `IdentityProvider`/`StorageProvider` abstractions is not extra engineering for its own sake — it is a single, cheap seam that avoids a rewrite if Supabase is later swapped out. Do not add further provider abstractions beyond identity, storage, and payments without a real requirement.

------------------------------------------------------------------------

# 44. Scalability Target

The stated initial target is approximately:

``` text
10,000 monthly platform users
```

Design for this comfortably without premature distributed architecture.

The more important scale concern is:

``` text
10,000 platform users
+
public invitation sharing
+
many guests per event
```

Therefore public invitation reads may become significantly larger than
authenticated platform traffic.

Optimize the public side independently.

------------------------------------------------------------------------

# 45. Caching Strategy

Use Redis only where it provides measurable value.

Candidate cache data:

``` text
template catalog
template metadata
public wedding metadata
rate-limit counters
```

Source of truth:

``` text
PostgreSQL
```

Public content:

``` text
CDN
```

Do not cache sensitive user-specific data carelessly.

------------------------------------------------------------------------

# 46. Async Processing

Use background workers for operations such as:

``` text
image optimization
thumbnail generation
email
notification
analytics processing
virus scanning
heavy publishing work
```

Do not block the HTTP request on long-running work if it can be
asynchronous.

Return:

``` text
202 Accepted
```

where appropriate.

------------------------------------------------------------------------

# 47. Publishing Idempotency

Publishing should be safe against accidental duplicate requests.

Support an idempotency mechanism where appropriate:

``` text
Idempotency-Key
```

Example:

``` http
POST /v1/events/evt_123/publish
Idempotency-Key: publish-abc-123
```

Repeated identical requests should not accidentally create multiple
published versions.

------------------------------------------------------------------------

# 48. Audit Logging

Audit important operations:

``` text
USER_CREATED
EVENT_CREATED
EVENT_UPDATED
TEMPLATE_CREATED
TEMPLATE_VERSION_CREATED
TEMPLATE_PUBLISHED
DRAFT_UPDATED
MEDIA_UPLOADED
EVENT_PUBLISHED
EVENT_UNPUBLISHED
RSVP_CREATED
```

Audit logs should not contain sensitive credentials or excessive
personal data.

------------------------------------------------------------------------

# 49. Implementation Rules

Before coding any module:

1.  Read the architecture specification.
2.  Read related frontend code.
3.  Identify the exact API consumer.
4.  Define request/response models.
5.  Define authorization rules.
6.  Define database impact.
7.  Write tests.
8.  Implement.
9.  Run lint/typecheck/tests.
10. Update OpenAPI.
11. Document deviations.

------------------------------------------------------------------------

# 50. Definition of Done

A backend feature is not complete until:

-   Code is implemented.
-   Unit tests exist.
-   Integration tests exist where appropriate.
-   Authorization is tested.
-   Validation is tested.
-   OpenAPI is updated.
-   Error contract is respected.
-   Logging is implemented.
-   Metrics are implemented where relevant.
-   Database migrations exist.
-   Documentation is updated.
-   Frontend contract is verified.
-   No secrets are committed.
-   Lint passes.
-   Type checking passes.
-   Tests pass.
-   Build passes.

------------------------------------------------------------------------

# 51. Final Review Checklist

Before declaring backend v1 ready, verify:

## Architecture

-   [ ] Modular monolith.
-   [ ] Domain boundaries are clear.
-   [ ] No premature microservices.
-   [ ] Event is primary business entity.
-   [ ] Auth boundary is clean.
-   [ ] Public runtime is separated conceptually.

## Authentication

-   [ ] Supabase Auth owns identity, behind the IdentityProvider abstraction.
-   [ ] Auth Service remains thin.
-   [ ] Passwords never stored.
-   [ ] JWT validation is correct.
-   [ ] Roles work.
-   [ ] Ownership works.
-   [ ] `/me` works.
-   [ ] Logout works.

## Events

-   [ ] CRUD works.
-   [ ] Ownership enforced.
-   [ ] Slugs are unique.
-   [ ] Event types are extensible.
-   [ ] Dashboard query is efficient.

## Templates

-   [ ] Catalog works.
-   [ ] Template versions work.
-   [ ] Schema versions work.
-   [ ] Protocol versions work.
-   [ ] Explicit bindings enforced.
-   [ ] Template validation works.

## Drafts

-   [ ] Autosave API works.
-   [ ] Revision works.
-   [ ] Conflict detection works.
-   [ ] Migration works.
-   [ ] Invalid data rejected.

## Media

-   [ ] Presigned upload works.
-   [ ] Ownership enforced.
-   [ ] MIME validation works.
-   [ ] Size validation works.
-   [ ] Asset lifecycle works.

## Publishing

-   [ ] Validation works.
-   [ ] Immutable snapshot works.
-   [ ] Idempotency works.
-   [ ] Public URL works.
-   [ ] Cache invalidation works.

## Public Invitation

-   [ ] No authentication required.
-   [ ] Only published data exposed.
-   [ ] CDN compatible.
-   [ ] Rate limited.
-   [ ] SEO data available.
-   [ ] Public API is efficient.

## RSVP

-   [ ] Public submission works.
-   [ ] Rate limiting works.
-   [ ] Owner management works.
-   [ ] Private data is protected.

## Billing

-   [ ] Entitlement enforcement works at publish time.
-   [ ] Payment webhook is idempotent.
-   [ ] Admin metrics/customer aggregates are computed, not duplicated in a hand-maintained table.
-   [ ] Per-template pricing toggle (FREE/PAID) works.
-   [ ] `PaymentProvider` interface isolates the concrete provider (Razorpay/Stripe) from domain code.

## Operations

-   [ ] Logs.
-   [ ] Metrics.
-   [ ] Traces/request IDs.
-   [ ] Health endpoints.
-   [ ] Migrations.
-   [ ] Backups.
-   [ ] Secrets management.
-   [ ] CI/CD.

------------------------------------------------------------------------

# 52. Expected Deliverables

At the end of implementation, produce:

``` text
1. Backend source code
2. Database migrations
3. OpenAPI specification
4. Environment example
5. Supabase Auth setup documentation
6. Local development instructions
7. Docker configuration
8. Test suite
9. API contract documentation
10. Architecture decision records
11. Security review report
12. Frontend integration guide
13. Deployment guide
14. Troubleshooting guide
15. Final architecture review
```

------------------------------------------------------------------------

# 53. Frontend Adaptation Plan

Because the backend is intentionally designed independently, the implementation must produce a concrete frontend adaptation plan.

The plan must identify:

```text
Frontend files/components affected
API clients to add/change
Models/types to add/change
Routes to add/change
Auth UI required
Auth state changes
Repository changes
Editor changes
Dashboard changes
Media integration changes
Publishing changes
Public invitation changes
Migration/deprecation work
```

For each frontend change, document:

| Change | Reason | Backend Contract | Frontend Impact | Priority |
|---|---|---|---|---|
| Example | Backend uses eventId | `/v1/events/{id}` | Change editor route | High |
| `auth.service.ts` session storage | Currently stores the session in `sessionStorage` only, which breaks with the newly-added SSR (`server.ts`) since `sessionStorage` isn't available/shared during server-side rendering | Supabase Auth session via `IdentityProvider` | Move to a cookie-based session (Supabase's `@supabase/ssr` pattern) | High |

Do not avoid a frontend change merely because it touches existing code.

The objective is a **correct end-to-end system**, not preservation of temporary frontend implementation details.

---

# 53. Final Architecture

The completed system should conceptually look like:

``` text
                           EVOKE
                             |
             ┌───────────────┴────────────────┐
             |                                |
        Angular Platform                Public Runtime
             |                                |
       ┌─────┼─────┐                          |
       |     |     |                          |
      Auth Dashboard Editor                 CDN
       |     |     |                          |
       └─────┼─────┘                          |
             |                                |
             v                                v
          Evoke API                    Public API/CDN
             |
    ┌────────┼────────────────────────────┐
    |        |        |        |          |
   Auth    Users    Events  Templates   Media
    |        |        |        |          |
    |        └────────┼────────┼──────────┘
    |                 |
Supabase Auth      PostgreSQL
(IdentityProvider)     |
                 Published Data
                      |
                  Object Storage
                      |
                     CDN
```

The implementation must preserve this fundamental separation:

``` text
Identity
    → Supabase Auth (behind IdentityProvider abstraction)

Application identity
    → Auth/User modules

Business state
    → PostgreSQL

Template assets
    → Template storage/CDN

Media
    → Object storage/CDN

Drafts
    → PostgreSQL

Published snapshots
    → immutable storage + metadata

Public invitations
    → CDN/public runtime
```

------------------------------------------------------------------------

# 54. Instructions to the Coding Agent

Now begin implementation.

Do not rush directly into code.

First:

``` text
1. Inspect repository.
2. Inspect frontend.
3. Read architecture specification.
4. Detect contradictions.
5. Produce implementation plan.
6. Divide work among specialized agents.
7. Implement database foundation.
8. Implement authentication.
9. Implement domain modules in dependency order.
10. Integrate frontend contracts.
11. Run full test suite.
12. Perform security review.
13. Perform architecture review.
14. Fix findings.
15. Produce final implementation report.
```

If a decision is ambiguous:

-   Prefer the simplest architecture consistent with the specification.
-   Do not invent unnecessary infrastructure.
-   Document the assumption.
-   If the ambiguity can materially affect data compatibility or
    security, stop and explicitly flag it before implementing.

If an existing frontend implementation differs from the backend design:

```text
Do NOT automatically change the backend to match the frontend.

First determine:
1. What the product actually requires.
2. What the correct backend/domain design should be.
3. Whether the frontend implementation is temporary or incomplete.
4. What frontend changes are required.
5. Whether a compatibility layer is genuinely valuable.
6. Whether the architecture/API documents need updating.
```

Default behavior:

```text
Correct Backend Design
        ↓
Stable API Contract
        ↓
Frontend Adaptation
```

If the backend requires a frontend change, make the frontend change.

The final implementation report MUST contain a section:

## Frontend Changes Required

List every frontend change required to integrate with the backend, including:

- routes;
- authentication UI/state;
- API clients;
- TypeScript models;
- repositories;
- editor behavior;
- dashboard behavior;
- media handling;
- publishing;
- public invitation rendering;
- migrations/removal of temporary frontend logic.

Do not mark the backend complete merely because the existing frontend can consume it without changes.

The final system must be a **coherent product**, not merely a collection
of working APIs.

The final success criterion is:

``` text
Angular Frontend
       ↓
Stable API Contract
       ↓
Modular Backend
       ↓
Supabase Auth + PostgreSQL + Object Storage
       ↓
Draft → Publish
       ↓
Fast Public Invitation
```

Build for correctness first, simplicity second, and scale where the
actual traffic pattern requires it.
