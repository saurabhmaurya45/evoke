# Wedding Platform --- Architecture Design

**Document Version:** 1.0\
**Status:** Proposed\
**Audience:** Engineering, Architecture, DevOps, Product\
**Primary Goal:** Zero-to-one architecture for a wedding template and
publishing platform

------------------------------------------------------------------------

## 1. Executive Summary

The Wedding Platform allows users to:

-   Sign up using email/password.
-   Sign in using Google and future identity providers.
-   Create one or more wedding projects.
-   Select a wedding website template.
-   Customize wedding content.
-   Upload photos and other media.
-   Preview the website.
-   Publish the wedding website.
-   Share a public URL with guests.
-   Optionally collect RSVPs.

The platform will use **Supabase Auth as the Identity Provider (IdP)**
while exposing an application-owned **Auth/Identity Service** between the
frontend and Supabase Auth.

The Auth Service is **not intended to replace Supabase Auth**. It owns
the application's authentication contract, request validation,
application-user provisioning, identity mapping, and integration with
Supabase Auth. Authentication capabilities already provided by Supabase
Auth must not be reimplemented.

The identity provider is accessed exclusively through an
`IdentityProvider` interface (see Section 14). Supabase Auth is the
initial implementation, not an architectural commitment --- Keycloak,
Auth0, and Cognito remain valid future alternatives without changing the
application-facing contract. See Section 4.5 for the full portability
boundary.

The initial platform should be implemented as a **modular monolith**
rather than a collection of independently deployed microservices. Domain
boundaries should nevertheless be explicit so individual modules can
later be extracted when scale or organizational requirements justify it.

### Core architectural principle

> **Supabase Auth owns authentication and identity-provider capabilities
> (password auth, OAuth/social login incl. Google, email verification,
> password reset, MFA, sessions, token issuance, brute-force
> protection). The (thin) Auth Service owns the application's identity
> contract via an `IdentityProvider` interface. The application backend
> owns business authorization and wedding/event data.**

------------------------------------------------------------------------

# 2. Goals

## 2.1 Functional Goals

The platform must support:

1.  Email/password registration.
2.  Email/password login.
3.  Google login.
4.  Future OAuth/OIDC providers.
5.  Email verification.
6.  Password reset.
7.  User profile.
8.  User dashboard.
9.  Wedding creation.
10. Template selection.
11. Template customization.
12. Media upload.
13. Preview.
14. Publishing.
15. Public wedding URL.
16. Guest access without authentication.
17. Template management for editors.
18. Administrative capabilities.
19. Multiple weddings per user.
20. Template versioning.
21. Draft and published versions.
22. Optional RSVP support.

## 2.2 Non-Functional Goals

The system should be:

-   Secure.
-   Maintainable.
-   Observable.
-   Horizontally scalable.
-   Cost-conscious.
-   Easy to operate.
-   Extensible.
-   Cloud-friendly.
-   Suitable for approximately 10,000+ monthly users initially.
-   Capable of handling substantially larger guest traffic than
    authenticated-user traffic.

------------------------------------------------------------------------

# 3. Non-Goals for MVP

The following should not be built initially unless a concrete
requirement appears:

-   Multi-region active-active architecture.
-   Service mesh.
-   Kafka-scale event infrastructure.
-   Database-per-microservice.
-   Custom OAuth implementation.
-   Custom password storage.
-   Custom token signing.
-   Custom MFA.
-   Complex authorization policy engine.
-   Kubernetes solely for architectural fashion.
-   Full microservice decomposition.
-   Enterprise organization/tenant hierarchy.
-   Dedicated search infrastructure.

------------------------------------------------------------------------

# 4. Architecture Principles

## 4.1 Identity Provider Separation

Supabase Auth is responsible for:

-   Authentication.
-   Credentials.
-   Password hashing.
-   OIDC/OAuth.
-   Social identity providers.
-   Sessions.
-   Token issuance.
-   Refresh tokens.
-   MFA.
-   Email verification.
-   Password reset.
-   Brute-force protection.
-   Account lockout.
-   Identity federation.

The application must not duplicate these capabilities.

## 4.2 Application Identity Boundary

The Auth Service owns:

-   Application-facing authentication APIs.
-   Request validation.
-   Application-specific parameters.
-   User provisioning orchestration.
-   Mapping Supabase Auth identities to application users.
-   Application profile information.
-   Coarse role mapping.
-   Authentication integration.
-   Token/session integration.

## 4.3 Business Authorization

Roles alone are insufficient.

Authorization is:

``` text
RBAC + Resource Ownership
```

For example:

``` text
USER
  +
Wedding.owner_id == authenticated_user.id
  =
Allowed to edit wedding
```

A normal user must never be able to edit another user's wedding simply
because they have the `USER` role.

## 4.4 Public and Private Traffic Separation

Authenticated dashboard traffic and public wedding traffic should be
treated as different workloads.

``` text
Private Platform
    -> Authentication required

Public Wedding Website
    -> Authentication not required
    -> CDN/cache optimized
```

## 4.5 Supabase Portability Boundary

Supabase is treated as a set of swappable infrastructure providers, not
as the application's runtime.

-   Business logic (draft concurrency/409 handling, immutable publish
    snapshots, template schema validation, billing/entitlement rules)
    lives in the application's own backend service code --- **not** in
    vendor-specific serverless functions (avoid putting this logic only
    in Supabase Edge Functions) and **not** solely in database
    triggers/RLS --- so it can run against any Postgres host.
-   Schema changes use plain SQL migrations (or a standard
    framework-native migration tool), not a Supabase-CLI-only migration
    format, so schema history stays portable.
-   The backend's own domain modules talk to Postgres via a normal
    connection string/ORM, not the Supabase client SDK. The Supabase JS
    SDK is acceptable for the frontend's direct auth calls only.
-   Row-Level Security (RLS) policies may be used as an extra
    defense-in-depth layer mirroring the same RBAC + ownership rules
    already enforced in the application layer (Section 22), but the
    application layer remains the authoritative enforcement point ---
    RLS is not the primary authorization mechanism.

### Supabase Exit Strategy

``` text
A future migration away from Supabase would require:
  - Swapping SupabaseIdentityProvider for a new IdentityProvider adapter.
  - Swapping SupabaseStorageProvider for a new StorageProvider adapter.
  - Pointing the Postgres connection string at a new host.
  - Re-applying the same plain-SQL migrations against that host.

It would NOT require:
  - Rewriting domain/business logic.
  - Changing the API contract.
  - Changing the frontend beyond its auth SDK initialization.
```

This is the same portability guarantee the original Keycloak-based
design relied on --- only the concrete provider behind the
`IdentityProvider` boundary has changed (Section 14).

------------------------------------------------------------------------

# 5. High-Level Architecture

``` mermaid
flowchart TB

    User["Wedding Owner"]
    Guest["Wedding Guest"]
    Admin["Admin / Editor"]

    Edge["CDN / WAF / Load Balancer"]

    Web["Wedding Web App"]

    Gateway["API Gateway / Reverse Proxy"]

    Auth["Auth / Identity Service"]
    Wedding["Wedding Module"]
    Template["Template Module"]
    Media["Media Module"]
    Publishing["Publishing Module"]
    GuestAPI["Public Wedding API"]
    Notification["Notification Worker"]

    SupabaseAuth["Supabase Auth"]
    Google["Google / Other OIDC Providers"]

    AppDB[("Application PostgreSQL<br/>(incl. opaque auth schema)")]
    Redis[("Redis")]
    ObjectStorage[("Object Storage")]
    Queue[("Message Queue")]

    User --> Edge
    Guest --> Edge
    Admin --> Edge

    Edge --> Web
    Edge --> Gateway

    Gateway --> Auth
    Gateway --> Wedding
    Gateway --> Template
    Gateway --> Media
    Gateway --> Publishing

    Auth --> SupabaseAuth
    SupabaseAuth --> Google
    Auth --> AppDB

    Wedding --> AppDB
    Template --> AppDB
    Media --> AppDB
    Media --> ObjectStorage
    Publishing --> AppDB
    Publishing --> ObjectStorage

    Wedding --> Redis
    Template --> Redis

    Publishing --> Queue
    Notification --> Queue

    Guest --> GuestAPI
    GuestAPI --> AppDB
    GuestAPI --> ObjectStorage
```

------------------------------------------------------------------------

# 6. Recommended MVP Deployment Architecture

The logical architecture contains multiple domain modules, but the
initial deployment should remain simple.

``` mermaid
flowchart TB

    Internet["Internet"]

    Edge["CDN / WAF / Load Balancer"]

    Frontend["React / Next.js"]

    Backend["Wedding Backend<br/>Modular Monolith"]

    Auth["Auth Module"]
    Users["User Module"]
    Weddings["Wedding Module"]
    Templates["Template Module"]
    Media["Media Module"]
    Publishing["Publishing Module"]
    Guests["Guest / RSVP Module"]

    SupabaseAuth["Supabase Auth<br/>(managed)"]

    AppDB[("Application PostgreSQL<br/>(public schema + opaque auth schema)")]
    Redis[("Redis")]
    Storage[("Object Storage")]

    Internet --> Edge
    Edge --> Frontend
    Edge --> Backend

    Backend --> Auth
    Backend --> Users
    Backend --> Weddings
    Backend --> Templates
    Backend --> Media
    Backend --> Publishing
    Backend --> Guests

    Auth --> SupabaseAuth

    Auth --> AppDB
    Users --> AppDB
    Weddings --> AppDB
    Templates --> AppDB
    Publishing --> AppDB
    Guests --> AppDB

    Media --> Storage
    Backend --> Redis
```

### Why modular monolith first?

At zero-to-one:

-   Faster development.
-   Easier local development.
-   Easier debugging.
-   Lower infrastructure cost.
-   No network overhead between every module.
-   Easier transactions.
-   Easier schema evolution.

The modules must still have clear interfaces and ownership.

------------------------------------------------------------------------

# 7. Domain Architecture

The platform should be divided into these business domains:

``` text
Wedding Platform
│
├── Identity / Auth
├── User
├── Wedding
├── Template
├── Media
├── Publishing
├── Guest / RSVP
├── Notification
└── Analytics
```

------------------------------------------------------------------------

# 8. Domain Responsibilities

  Domain         Responsibility
  -------------- -------------------------------------------------------------
  Auth           Identity integration, authentication contract, provisioning
  User           Application user profile
  Wedding        Wedding project and content
  Template       Template catalog and versions
  Media          Photos, videos, assets
  Publishing     Preview and publication lifecycle
  Guest          Public guest experience
  RSVP           Guest response management
  Notification   Email/SMS/push events
  Analytics      Usage and business analytics

------------------------------------------------------------------------

# 9. Core Data Model

``` mermaid
erDiagram

    USER ||--o{ WEDDING : owns

    TEMPLATE ||--o{ TEMPLATE_VERSION : has

    TEMPLATE_VERSION ||--o{ TEMPLATE_INSTANCE : used_by

    WEDDING ||--|| TEMPLATE_INSTANCE : uses

    WEDDING ||--o{ WEDDING_EVENT : contains

    WEDDING ||--o{ MEDIA_ASSET : contains

    WEDDING ||--|| PUBLISHED_SITE : publishes

    WEDDING ||--o{ GUEST : invites

    GUEST ||--o{ RSVP : submits

    USER ||--o{ PAYMENT : makes

    USER ||--o{ ENTITLEMENT : holds

    TEMPLATE ||--o{ ENTITLEMENT : grants_access_to

    TEMPLATE ||--o{ PAYMENT : purchased_via

    PAYMENT ||--o| ENTITLEMENT : source_of

    USER {
        uuid id PK
        string auth_user_id UK
        string email
        string display_name
        string status
        boolean profile_completed
        timestamp created_at
        timestamp updated_at
    }

    WEDDING {
        uuid id PK
        uuid owner_id FK
        string name
        string slug UK
        string status
        uuid template_instance_id
        timestamp created_at
        timestamp updated_at
    }

    TEMPLATE {
        uuid id PK
        string slug UK
        string name
        string category
        string status
        string pricing_model
        integer price_amount_minor
        char currency
        string storefront_status
        timestamp created_at
    }

    TEMPLATE_VERSION {
        uuid id PK
        uuid template_id FK
        integer version
        json schema
        json default_config
        string status
        timestamp created_at
    }

    TEMPLATE_INSTANCE {
        uuid id PK
        uuid template_version_id FK
        json configuration
    }

    WEDDING_EVENT {
        uuid id PK
        uuid wedding_id FK
        string name
        timestamp event_date
        string venue
    }

    MEDIA_ASSET {
        uuid id PK
        uuid wedding_id FK
        string object_key
        string content_type
        integer size
        string status
    }

    PUBLISHED_SITE {
        uuid id PK
        uuid wedding_id FK
        string published_version
        string public_url
        timestamp published_at
    }

    GUEST {
        uuid id PK
        uuid wedding_id FK
        string name
        string email
    }

    RSVP {
        uuid id PK
        uuid guest_id FK
        string status
        timestamp submitted_at
    }

    PAYMENT {
        uuid id PK
        uuid user_id FK
        uuid template_id FK
        uuid wedding_id FK
        integer amount_minor
        char currency
        string status
        string provider
        string provider_reference
        string method
        string invoice_number
        timestamp created_at
        timestamp updated_at
    }

    ENTITLEMENT {
        uuid id PK
        uuid user_id FK
        uuid template_id FK
        string source
        uuid payment_id FK
        timestamp granted_at
    }
```

------------------------------------------------------------------------

# 10. Identity and Authentication Architecture

## 10.1 Identity Flow

``` mermaid
flowchart LR

    Browser["Browser"]

    Auth["Auth Service"]

    SupabaseAuth["Supabase Auth"]

    Google["Google"]

    AppDB[("Application DB")]

    Browser --> Auth
    Auth --> SupabaseAuth
    SupabaseAuth --> Google
    Auth --> AppDB
```

The Auth Service is an abstraction boundary, not an authentication
implementation.

------------------------------------------------------------------------

# 11. Auth Service Detailed Design

## 11.1 Responsibilities

The Auth Service owns:

-   Application authentication API.
-   Input validation.
-   Application-specific user fields.
-   Supabase Auth integration.
-   Identity mapping.
-   User provisioning.
-   Role assignment orchestration.
-   Application user lookup.
-   Authentication state integration.
-   Provider management abstraction.
-   Audit events related to identity.

## 11.2 Explicitly Out of Scope

The Auth Service must not implement:

-   Password hashing.
-   Password storage.
-   OAuth protocol implementation.
-   OIDC protocol implementation.
-   Google authentication.
-   Token signing.
-   Refresh-token cryptography.
-   MFA.
-   Password reset.
-   Email verification.
-   Brute-force detection.

Those remain Supabase Auth responsibilities.

------------------------------------------------------------------------

# 12. Auth Service Internal Architecture

``` text
auth-service/
│
├── controllers/
│   ├── auth.controller
│   ├── user.controller
│   └── provider.controller
│
├── application/
│   ├── signup.usecase
│   ├── login.usecase
│   ├── callback.usecase
│   ├── logout.usecase
│   ├── refresh.usecase
│   └── current-user.usecase
│
├── domain/
│   ├── user/
│   ├── identity/
│   ├── role/
│   └── errors/
│
├── infrastructure/
│   ├── supabase/
│   │   ├── supabase-auth-client
│   │   ├── admin-client
│   │   └── token-validator
│   │
│   ├── database/
│   │   └── user-repository
│   │
│   └── cache/
│
├── middleware/
│   ├── authentication
│   ├── authorization
│   └── rate-limit
│
└── config/
```

------------------------------------------------------------------------

# 13. Auth Service Layering

``` mermaid
flowchart TB

    Controller["HTTP Controller"]

    UseCase["Application / Use Case"]

    Domain["Domain Layer"]

    IdentityProvider["IdentityProvider Interface"]

    SupabaseAdapter["Supabase Adapter"]

    Repository["User Repository"]

    DB["Application PostgreSQL"]

    Controller --> UseCase
    UseCase --> Domain

    UseCase --> IdentityProvider
    UseCase --> Repository

    IdentityProvider --> SupabaseAdapter
    SupabaseAdapter --> SupabaseAuth["Supabase Auth"]

    Repository --> DB
```

This prevents Supabase-specific APIs from leaking into business logic.

------------------------------------------------------------------------

# 14. Identity Provider Interface

Conceptually:

``` typescript
interface IdentityProvider {
  createUser(input: CreateIdentity): Promise<Identity>;
  getUser(id: string): Promise<Identity>;
  updateUser(id: string, input: UpdateIdentity): Promise<void>;
  disableUser(id: string): Promise<void>;

  assignRole(
    userId: string,
    role: string
  ): Promise<void>;

  validateToken(
    token: string
  ): Promise<TokenIdentity>;
}
```

The initial implementation is:

``` text
SupabaseIdentityProvider
```

Supabase Auth (GoTrue) provides password auth, OAuth/social login
(Google, and future Apple/Microsoft/GitHub), email verification,
password reset, MFA, sessions, and token issuance behind this interface.

A future/alternative provider could be:

``` text
KeycloakIdentityProvider
Auth0IdentityProvider
CognitoIdentityProvider
```

without changing the application-facing contract. Keycloak is no longer
the chosen provider for this platform, but remains a documented,
self-hostable alternative if Supabase ever needs to be exited (see
Section 4.5).

------------------------------------------------------------------------

# 15. Authentication Flow

Use:

``` text
Authorization Code + PKCE
```

for browser authentication.

``` mermaid
sequenceDiagram

    participant U as User
    participant FE as Web App
    participant AS as Auth Service
    participant SA as Supabase Auth
    participant G as Google
    participant DB as App DB

    U->>FE: Click Login

    FE->>AS: Start authentication

    AS->>AS: Generate state + PKCE

    AS-->>FE: Authorization URL

    FE->>SA: Redirect

    SA->>U: Login page

    alt Google Login
        SA->>G: Redirect
        U->>G: Authenticate
        G-->>SA: Identity
    end

    SA-->>FE: Authorization Code

    FE->>AS: Callback + Code

    AS->>SA: Exchange Code

    SA-->>AS: Tokens

    AS->>AS: Validate identity

    AS->>DB: Find/Create application user

    DB-->>AS: User

    AS-->>FE: Application session
```

------------------------------------------------------------------------

# 16. Why Authorization Code + PKCE

Benefits:

-   Standard OIDC flow.
-   Suitable for modern browser applications.
-   Protects authorization codes.
-   Avoids custom authentication implementation.
-   Works with Google and future identity providers.
-   Keeps Supabase Auth responsible for authentication.

------------------------------------------------------------------------

# 17. Signup Flow

``` mermaid
sequenceDiagram

    participant U as User
    participant FE as Frontend
    participant AS as Auth Service
    participant SA as Supabase Auth
    participant DB as Application DB

    U->>FE: Enter signup details

    FE->>AS: POST /auth/signup

    AS->>AS: Validate request

    AS->>AS: Validate application fields

    AS->>SA: Create identity

    SA-->>AS: Supabase Auth User ID

    AS->>SA: Assign USER role

    AS->>DB: Create application user

    DB-->>AS: User created

    AS-->>FE: Signup successful

    FE->>U: Verify email
```

### Failure case

If:

``` text
Supabase Auth user creation = SUCCESS
Application DB creation = FAILURE
```

the Auth Service must support reconciliation.

Recommended approaches:

-   Idempotency key.
-   Retry.
-   Compensating delete where appropriate.
-   Background reconciliation job.

------------------------------------------------------------------------

# 18. Application User Model

Supabase Auth should be the identity source.

The application maintains a projection:

``` text
users
--------------------------------
id
auth_user_id
email
display_name
status
profile_completed
created_at
updated_at
```

`auth_user_id` stores the Supabase `auth.users.id` (UUID). The
application must treat the Supabase `auth` schema as an opaque external
system --- application code must never query it directly, only through
the Supabase Auth API/Admin API or the thin Auth Service, exactly as it
would treat a separate Keycloak database.

Business relationships should reference:

``` text
users.id
```

and never depend on email addresses.

------------------------------------------------------------------------

# 19. Auth APIs

### Signup

``` http
POST /v1/auth/signup
```

Request:

``` json
{
  "email": "user@example.com",
  "password": "********",
  "firstName": "Saurabh",
  "lastName": "Maurya"
}
```

### Start Login

``` http
GET /v1/auth/login
```

### OAuth Callback

``` http
GET /v1/auth/callback
```

### Current User

``` http
GET /v1/auth/me
```

Response:

``` json
{
  "id": "usr_123",
  "email": "user@example.com",
  "name": "Saurabh Maurya",
  "roles": ["USER"],
  "profileCompleted": true
}
```

### Logout

``` http
POST /v1/auth/logout
```

------------------------------------------------------------------------

# 20. Google Login

Supabase Auth acts as the identity broker.

``` mermaid
sequenceDiagram

    participant U as User
    participant FE as Frontend
    participant AS as Auth Service
    participant SA as Supabase Auth
    participant G as Google

    U->>FE: Continue with Google

    FE->>AS: Start Google login

    AS->>SA: Authorization request

    SA->>G: Redirect

    U->>G: Authenticate

    G-->>SA: Identity

    SA-->>FE: Authorization Code

    FE->>AS: Callback

    AS->>SA: Exchange Code

    SA-->>AS: Identity / Tokens

    AS-->>FE: Application session
```

Future providers can be added through Supabase Auth:

``` text
Google
Apple
Microsoft
GitHub
Generic OIDC
```

without changing the application's authentication contract.

------------------------------------------------------------------------

# 21. Roles

Initial roles:

``` text
USER
EDITOR
ADMIN
```

> EDITOR is reserved for a later phase. The current frontend only
> implements USER and ADMIN. EDITOR remains fully documented below so
> the template-management workflow is ready to enable when needed.

## USER

-   View templates.
-   Create wedding.
-   Edit own wedding.
-   Delete own wedding.
-   Publish own wedding.
-   Manage own media.
-   View own RSVP data.

## EDITOR

-   Create templates.
-   Edit templates.
-   Create template versions.
-   Publish template versions.
-   Archive templates.
-   Perform approved content-management operations.

## ADMIN

-   Manage users.
-   Manage templates.
-   Manage platform configuration.
-   Access operational administration.
-   Manage system-level resources.

------------------------------------------------------------------------

# 22. RBAC + Ownership

Authorization must evaluate:

``` text
Authenticated identity
        +
Role
        +
Resource ownership
```

Example:

``` mermaid
flowchart TD

    Request["PUT /weddings/{id}"]

    Identity["Validate identity"]

    Role["Evaluate role"]

    Ownership["Check wedding.owner_id"]

    Allow["ALLOW"]

    Deny["DENY"]

    Request --> Identity
    Identity --> Role
    Role --> Ownership

    Ownership -->|"Owner / Authorized Editor"| Allow
    Ownership -->|"Unauthorized"| Deny
```

This RBAC + ownership check in the application backend is the
authoritative enforcement point. Any RLS policies configured in
Postgres (Section 4.5) mirror this same logic as defense-in-depth; they
do not replace it.

------------------------------------------------------------------------

# 23. JWT Validation

Protected services should validate tokens locally.

Validate:

-   Signature.
-   Issuer.
-   Audience.
-   Expiration.
-   Not-before.
-   Subject.
-   Algorithm.
-   Required claims.

Extract:

``` text
user_id
roles
email
```

Avoid calling Supabase Auth on every request.

Use Supabase's public signing key/JWKS for local JWT verification.

------------------------------------------------------------------------

# 24. User Service

The User domain owns application-level profile information.

Responsibilities:

-   Profile.
-   Display name.
-   Profile image.
-   Preferences.
-   Onboarding state.
-   Account metadata.

Example APIs:

``` http
GET   /v1/users/me
PATCH /v1/users/me
GET   /v1/users/me/preferences
PATCH /v1/users/me/preferences
```

It should not own:

-   Passwords.
-   Authentication sessions.
-   OAuth credentials.

------------------------------------------------------------------------

# 25. Wedding Service

The Wedding domain is the primary business domain.

Responsibilities:

-   Wedding creation.
-   Wedding metadata.
-   Couple information.
-   Story.
-   Events.
-   Venue.
-   Family information.
-   Wedding settings.
-   Wedding lifecycle.
-   Ownership.

APIs:

``` http
POST   /v1/weddings
GET    /v1/weddings
GET    /v1/weddings/{id}
PATCH  /v1/weddings/{id}
DELETE /v1/weddings/{id}
```

Events:

``` http
POST   /v1/weddings/{id}/events
PATCH  /v1/weddings/{id}/events/{eventId}
DELETE /v1/weddings/{id}/events/{eventId}
```

------------------------------------------------------------------------

# 26. Wedding Lifecycle

``` mermaid
stateDiagram-v2

    [*] --> DRAFT

    DRAFT --> CUSTOMIZING

    CUSTOMIZING --> PREVIEW

    PREVIEW --> CUSTOMIZING

    PREVIEW --> PUBLISHED

    PUBLISHED --> CUSTOMIZING

    PUBLISHED --> ARCHIVED

    DRAFT --> ARCHIVED
    CUSTOMIZING --> ARCHIVED
```

Recommended states:

``` text
DRAFT
CUSTOMIZING
PREVIEW
PUBLISHED
ARCHIVED
```

------------------------------------------------------------------------

# 27. Template Service

Responsibilities:

-   Template catalog.
-   Template metadata.
-   Categories.
-   Template schema.
-   Template versions.
-   Template assets.
-   Template publishing.
-   Template availability.

APIs:

``` http
GET  /v1/templates
GET  /v1/templates/{id}
GET  /v1/templates/{id}/versions

POST /v1/templates
PATCH /v1/templates/{id}

POST /v1/templates/{id}/versions
POST /v1/templates/{id}/publish
```

------------------------------------------------------------------------

# 28. Template Versioning

A wedding should reference both:

``` text
template_id
template_version_id
```

Example:

``` text
Royal Wedding
    v1
    v2
    v3
```

Wedding A:

``` text
Royal Wedding v2
```

If v4 is released, Wedding A remains on v2 until the owner explicitly
upgrades.

This prevents template changes from unexpectedly breaking published
weddings.

------------------------------------------------------------------------

# 29. Template Rendering Model

The renderer should combine:

``` text
Template Definition
+
Template Version
+
Wedding Data
+
Wedding Configuration
```

to produce:

``` text
Rendered Wedding
```

Example:

``` json
{
  "template": "royal",
  "version": 3,
  "sections": {
    "hero": {
      "enabled": true,
      "title": "Saurabh & XYZ"
    },
    "story": {
      "enabled": true
    },
    "gallery": {
      "enabled": true
    },
    "events": {
      "enabled": true
    }
  }
}
```

------------------------------------------------------------------------

# 30. Template Data Model

``` mermaid
erDiagram

    TEMPLATE ||--o{ TEMPLATE_VERSION : contains

    TEMPLATE_VERSION ||--o{ TEMPLATE_ASSET : contains

    TEMPLATE_VERSION ||--o{ TEMPLATE_INSTANCE : instantiated

    TEMPLATE {
        uuid id
        string slug
        string name
        string category
        string status
    }

    TEMPLATE_VERSION {
        uuid id
        uuid template_id
        int version
        json schema
        json default_config
        string status
    }

    TEMPLATE_ASSET {
        uuid id
        uuid version_id
        string object_key
        string asset_type
    }

    TEMPLATE_INSTANCE {
        uuid id
        uuid version_id
        json configuration
    }
```

------------------------------------------------------------------------

# 31. Media Service

Media should not be stored in PostgreSQL.

Use object storage for:

-   Photos.
-   Videos.
-   Template assets.
-   Backgrounds.
-   Fonts.
-   Generated assets.

PostgreSQL stores metadata only.

``` mermaid
sequenceDiagram

    participant U as Browser
    participant API as Media API
    participant DB as PostgreSQL
    participant S3 as Object Storage

    U->>API: Request upload URL

    API->>DB: Create PENDING asset

    API-->>U: Pre-signed upload URL

    U->>S3: Upload file directly

    S3-->>U: Upload complete

    U->>API: Confirm upload

    API->>DB: Mark asset READY
```

This prevents the application backend from becoming a file-transfer
bottleneck.

## Storage Provider Interface

Object storage is accessed through the same ports-and-adapters pattern
used for identity (Section 14), so the storage vendor is swappable
without touching Media Service business logic.

``` typescript
interface StorageProvider {
  createUploadUrl(input: CreateUploadRequest): Promise<PresignedUpload>;
  getObjectUrl(objectKey: string): Promise<string>;
  deleteObject(objectKey: string): Promise<void>;
  headObject(objectKey: string): Promise<ObjectMetadata>;
}
```

The initial implementation is:

``` text
SupabaseStorageProvider
```

Supabase Storage is S3-compatible, so a future provider could be a
direct S3 adapter or another S3-compatible vendor without changing the
application-facing contract.

------------------------------------------------------------------------

# 32. Media Security

Every upload should validate:

-   File size.
-   MIME type.
-   Magic bytes.
-   Image dimensions.
-   Allowed formats.
-   Filename sanitization.

Potential future pipeline:

``` text
Upload
  ↓
Object Storage
  ↓
Scan
  ↓
Process
  ↓
Generate thumbnails
  ↓
READY
```

------------------------------------------------------------------------

# 33. Publishing Service

Publishing converts a draft wedding into a public version.

``` mermaid
flowchart LR

    Draft["Wedding Draft"]

    Template["Template Version"]

    Renderer["Rendering Engine"]

    Published["Immutable Published Version"]

    Storage["Object Storage"]

    CDN["CDN"]

    URL["Public URL"]

    Draft --> Renderer
    Template --> Renderer

    Renderer --> Published
    Published --> Storage
    Storage --> CDN
    CDN --> URL
```

------------------------------------------------------------------------

# 34. Draft vs Published

A user may edit:

``` text
Draft v17
```

while guests continue seeing:

``` text
Published v15
```

After publish:

``` text
Draft v17
    ↓
Published v17
```

This gives the platform:

-   Safe previews.
-   Rollbacks.
-   Version history.
-   Scheduled publishing in the future.
-   No partial updates visible to guests.

------------------------------------------------------------------------

# 35. Public Wedding Website

Example:

``` text
https://wedding.example.com/w/saurabh-and-xyz
```

Guests should not require Supabase Auth authentication.

``` mermaid
flowchart LR

    Guest["Guest"]

    CDN["CDN"]

    PublicAPI["Public Wedding Renderer"]

    DB["Application DB"]

    Storage["Object Storage"]

    Guest --> CDN

    CDN --> PublicAPI

    PublicAPI --> DB
    PublicAPI --> Storage
```

Published wedding pages should be aggressively cacheable.

Ideal request path:

``` text
Guest
  ↓
CDN
  ↓
Cached published wedding
```

Only cache misses should reach application infrastructure.

------------------------------------------------------------------------

# 36. Public URL Design

Use human-readable slugs:

``` text
/w/saurabh-and-xyz
```

rather than:

``` text
/w/12345
```

Maintain a mapping:

``` text
slug
  ↓
wedding_id
  ↓
published_version
```

The slug must be unique.

------------------------------------------------------------------------

# 37. Guest / RSVP Domain

Guests are not necessarily platform users.

Guest model:

``` text
Guest
 ├── Wedding
 ├── Name
 ├── Email
 └── RSVP
```

Example APIs:

``` http
POST  /v1/public/weddings/{slug}/rsvp
GET   /v1/weddings/{id}/rsvps
PATCH /v1/weddings/{id}/rsvps/{rsvpId}
```

Public endpoints require:

-   Rate limiting.
-   Abuse prevention.
-   Input validation.
-   CAPTCHA where appropriate.
-   Request-size limits.

------------------------------------------------------------------------

# 38. Notification Service

Notification processing should be asynchronous.

``` mermaid
flowchart LR

    Wedding["Wedding Service"]

    Queue["Message Queue"]

    Notification["Notification Worker"]

    Email["Email Provider"]

    Wedding --> Queue
    Queue --> Notification
    Notification --> Email
```

Potential events:

``` text
USER_CREATED
EMAIL_VERIFICATION_REQUESTED
PASSWORD_RESET_REQUESTED
WEDDING_CREATED
WEDDING_PUBLISHED
INVITATION_SENT
RSVP_RECEIVED
```

------------------------------------------------------------------------

# 39. Event-Driven Architecture

Do not make every operation asynchronous.

Use events for operations where asynchronous processing is valuable.

``` mermaid
flowchart LR

    Wedding["Wedding Module"]
    Publishing["Publishing Module"]
    RSVP["RSVP Module"]

    Queue["Event Bus / Queue"]

    Notification["Notification"]
    Analytics["Analytics"]
    Search["Future Search"]
    Processing["Media Processing"]

    Wedding --> Queue
    Publishing --> Queue
    RSVP --> Queue

    Queue --> Notification
    Queue --> Analytics
    Queue --> Search
    Queue --> Processing
```

------------------------------------------------------------------------

# 40. API Architecture

``` text
/api
└── /v1
    ├── /auth
    ├── /users
    ├── /weddings
    ├── /templates
    ├── /media
    ├── /publish
    └── /public
```

Examples:

``` http
GET /api/v1/templates

POST /api/v1/weddings

GET /api/v1/weddings/{id}

PATCH /api/v1/weddings/{id}

POST /api/v1/weddings/{id}/publish

GET /api/v1/public/weddings/{slug}
```

------------------------------------------------------------------------

# 41. API Authorization Model

For:

``` http
PATCH /weddings/123
```

the backend must evaluate:

``` text
1. Is the request authenticated?
2. Is the token valid?
3. What is the user's role?
4. Does the user own wedding 123?
5. Is the wedding editable?
6. Is the requested operation allowed?
```

Only then:

``` text
ALLOW
```

------------------------------------------------------------------------

# 42. API Gateway

Recommended responsibilities:

-   TLS termination.
-   WAF.
-   Routing.
-   Rate limiting.
-   Request size limits.
-   CORS.
-   Security headers.
-   Basic access logging.

Do not put detailed business authorization in the gateway.

Example:

``` text
Gateway:
"Is this request authenticated?"

Wedding Module:
"Can this user edit this wedding?"
```

------------------------------------------------------------------------

# 43. Database Architecture

MVP:

``` text
Application PostgreSQL
```

Logical ownership:

``` text
users
weddings
wedding_events
templates
template_versions
template_instances
media_assets
published_sites
guests
rsvps
payments
entitlements
audit_logs
```

Supabase manages its own internal `auth` schema inside the same
Postgres instance as the application's `public` schema. The application
must treat `auth` as opaque, exactly as it would treat a physically
separate Keycloak database:

``` text
Supabase Auth
   ↓
auth schema (opaque, managed by Supabase)

Application
   ↓
public schema (application tables above)
```

The application must never query the `auth` schema directly. The only
permitted reference is `auth.users.id`, stored on `users.auth_user_id`
and obtained through the Supabase Auth API/Admin API or the Auth
Service --- never through a direct SQL join into `auth.*`.

------------------------------------------------------------------------

# 44. Redis

Redis should be a performance layer, not the source of truth.

Potential uses:

-   Template metadata caching.
-   Published-site metadata.
-   Rate limiting.
-   Short-lived authentication state.
-   Frequently accessed configuration.

``` text
PostgreSQL = Source of truth
Redis      = Cache
```

------------------------------------------------------------------------

# 45. Observability

All backend components should expose:

``` text
Logs
Metrics
Traces
Health
Readiness
```

## Auth Metrics

``` text
auth_signup_total
auth_login_success_total
auth_login_failure_total
auth_oauth_failure_total
auth_token_validation_failure_total
auth_supabase_request_total
auth_supabase_error_total
auth_supabase_latency
```

## Wedding Metrics

``` text
wedding_created_total
wedding_updated_total
wedding_deleted_total
wedding_published_total
```

## Template Metrics

``` text
template_selected_total
template_created_total
template_version_created_total
template_render_failure_total
```

## Publishing Metrics

``` text
publish_success_total
publish_failure_total
render_latency
```

------------------------------------------------------------------------

# 46. Distributed Tracing

Every request should carry:

``` text
trace_id
request_id
user_id
wedding_id
```

Example:

``` text
POST /weddings/123/publish

trace_id = abc123
user_id = usr_123
wedding_id = wed_456
```

A publish operation should be traceable across:

``` text
Frontend
   ↓
API
   ↓
Wedding
   ↓
Template
   ↓
Renderer
   ↓
Object Storage
```

------------------------------------------------------------------------

# 47. Security Architecture

Minimum security controls:

-   HTTPS everywhere.
-   Secure cookies.
-   HttpOnly cookies where session cookies are used.
-   SameSite configuration.
-   CSRF protection for cookie-based state-changing requests.
-   CORS restrictions.
-   Authorization Code + PKCE.
-   JWT validation.
-   Rate limiting.
-   Input validation.
-   Output encoding.
-   SQL parameterization.
-   File upload validation.
-   Object-storage access controls.
-   Secrets management.
-   Audit logging.
-   Brute-force protection through Supabase Auth.
-   Email verification.
-   Password policy through Supabase Auth.

------------------------------------------------------------------------

# 48. Secrets

Never store:

``` text
Supabase service-role key / JWT signing secret
Database passwords
OAuth client secrets
Object storage credentials
Email credentials
Payment gateway API keys / webhook signing secrets
```

in source control.

Use a secrets manager appropriate to the deployment platform.

The application should receive secrets through:

``` text
Environment / Secret Store
```

and never expose them to frontend code.

------------------------------------------------------------------------

# 49. Supabase Project Configuration

Recommended initial configuration (replaces realm/client concerns from
a Keycloak-based design with Supabase project-level equivalents):

Enabled auth providers:

``` text
Email / Password
Google
```

Future:

``` text
Apple
Microsoft
GitHub
Generic OIDC
```

Redirect URLs, configured per environment:

``` text
local:      http://localhost:3000/auth/callback
staging:    https://staging.wedding.example.com/auth/callback
production: https://wedding.example.com/auth/callback
```

JWT signing key rotation policy:

``` text
Rotate the Supabase JWT signing key on a fixed schedule and
immediately on suspected compromise. Application services validate
tokens against Supabase's current JWKS (Section 23) so rotation does
not require an application deployment.
```

Roles (application-level, mapped from Supabase Auth identities via the
Auth Service, not Supabase's own RBAC primitives):

``` text
USER
EDITOR
ADMIN
```

Row-Level Security (RLS) policies may additionally be configured in
Postgres mirroring the same RBAC + ownership rules as a defense-in-depth
layer. RLS is **not** the primary authorization mechanism --- see
Section 4.5 and Section 22.

------------------------------------------------------------------------

# 50. Supabase Auth High Availability

Supabase Auth (GoTrue) is consumed as a managed service, so instance
sizing and failover are Supabase's operational responsibility rather
than something this platform configures directly.

GoTrue itself is open-source and can be self-hosted later for direct HA
control, without an application rewrite --- because the application only
ever talks to it through the `IdentityProvider` boundary (Section 14).
This is a concrete example of the portability guarantee described in
Section 4.5: swapping the deployment model of the identity provider does
not touch business logic, the API contract, or the frontend beyond auth
SDK initialization.

------------------------------------------------------------------------

# 51. Failure Scenarios

## Supabase Auth unavailable

Impact:

-   New login may fail.
-   New signup may fail.
-   Social authentication may fail.

Existing application sessions should continue where possible.

## Application DB unavailable

Impact:

-   Application user lookup may fail.
-   Dashboard APIs may fail.
-   New user provisioning may fail.

## Object Storage unavailable

Impact:

-   Media upload fails.
-   Existing cached published pages should continue where possible.

## Backend unavailable

Public published sites should ideally remain available through
CDN/cache.

## Frontend session storage (known issue)

The frontend's `auth.service.ts` currently stores the session in
`sessionStorage` only. This breaks with server-side rendering: the
recently added `server.ts` cannot read `sessionStorage` (it does not
exist on the server), causing server-rendered pages to disagree with
the client about auth state and produce a hydration mismatch.
Recommendation: move to a cookie-based session, following Supabase's
`@supabase/ssr` pattern, so both server and client can read the same
auth state consistently.

------------------------------------------------------------------------

# 52. Resilience Strategy

``` mermaid
flowchart TB

    User["User"]

    CDN["CDN"]

    Backend["Backend"]

    DB["PostgreSQL"]

    Storage["Object Storage"]

    User --> CDN

    CDN --> Backend

    Backend --> DB
    Backend --> Storage

    CDN -.->|"Cache hit"| User
```

Public content should be optimized so that a temporary backend failure
does not automatically make every published wedding unavailable.

------------------------------------------------------------------------

# 53. Deployment Strategy

## MVP

``` text
Frontend
Backend
Supabase (Auth, PostgreSQL, Storage - managed)
Redis
```

Containerized deployment for Frontend/Backend/Redis.

## Later

Add:

``` text
CDN
WAF
Queue
Workers
Dedicated media processing
Service extraction
```

------------------------------------------------------------------------

# 54. CI/CD

Recommended pipeline:

``` mermaid
flowchart LR

    Developer["Developer"]

    PR["Pull Request"]

    Tests["Unit Tests"]

    Integration["Integration Tests"]

    Security["Security Scan"]

    Build["Container Build"]

    Registry["Container Registry"]

    Deploy["Deployment"]

    Smoke["Smoke Tests"]

    Developer --> PR
    PR --> Tests
    Tests --> Integration
    Integration --> Security
    Security --> Build
    Build --> Registry
    Registry --> Deploy
    Deploy --> Smoke
```

Required checks:

-   Lint.
-   Unit tests.
-   Integration tests.
-   API tests.
-   Dependency scanning.
-   Container scanning.
-   Secret scanning.
-   Build validation.

------------------------------------------------------------------------

# 55. Testing Strategy

## Auth

Test:

-   Signup.
-   Login.
-   Google flow.
-   Invalid credentials.
-   Expired token.
-   Invalid issuer.
-   Invalid audience.
-   Disabled user.
-   Role assignment.
-   User provisioning.
-   Duplicate signup.
-   Supabase Auth unavailable.

## Wedding

Test:

-   Create wedding.
-   Update own wedding.
-   Access another user's wedding.
-   Delete wedding.
-   Wedding state transitions.

## Template

Test:

-   Template selection.
-   Template versioning.
-   Template rendering.
-   Invalid configuration.
-   Published version stability.

## Media

Test:

-   Upload.
-   Invalid file type.
-   Oversized file.
-   Failed upload.
-   Object storage failure.

## Publishing

Test:

-   Preview.
-   Publish.
-   Republish.
-   Rollback.
-   CDN behavior.

------------------------------------------------------------------------

# 56. Authorization Test Matrix

  Action                          USER             EDITOR   ADMIN
  ----------------------------- ------ ------------------ -------
  View templates                   Yes                Yes     Yes
  Create wedding                   Yes                Yes     Yes
  Edit own wedding                 Yes                Yes     Yes
  Edit another user's wedding       No   Policy dependent     Yes
  Publish own wedding              Yes                Yes     Yes
  Create template                   No                Yes     Yes
  Edit template                     No                Yes     Yes
  Delete template                   No   Policy dependent     Yes
  Manage users                      No                 No     Yes
  System configuration              No                 No     Yes

------------------------------------------------------------------------

# 57. Public vs Authenticated APIs

## Authenticated

``` text
/api/v1/users/*
/api/v1/weddings/*
/api/v1/templates/admin/*
/api/v1/media/*
/api/v1/publish/*
```

## Public

``` text
/api/v1/public/weddings/{slug}
/api/v1/public/weddings/{slug}/rsvp
```

Public APIs must never trust a user-provided owner ID.

------------------------------------------------------------------------

# 58. Scaling Strategy

For approximately 10,000 monthly users, the architecture should
comfortably fit within a relatively small infrastructure footprint.

The more important metric is not monthly registered users but:

-   Authentication requests/sec.
-   Concurrent users.
-   Public wedding page requests/sec.
-   Media upload volume.
-   Publishing operations/sec.
-   RSVP requests/sec.

The largest traffic multiplier is expected to be guests.

Therefore:

``` text
Authenticated traffic
    ↓
Backend

Guest traffic
    ↓
CDN
```

is critical.

------------------------------------------------------------------------

# 59. Future Scaling Architecture

When justified, extract modules:

``` mermaid
flowchart TB

    CDN["CDN"]

    Gateway["API Gateway"]

    Auth["Auth Service"]
    Wedding["Wedding Service"]
    Template["Template Service"]
    Media["Media Service"]
    Publishing["Publishing Service"]
    RSVP["RSVP Service"]
    Notification["Notification Service"]
    Analytics["Analytics Service"]

    SupabaseAuth["Supabase Auth"]

    AuthDB[("Auth DB")]
    WeddingDB[("Wedding DB")]
    TemplateDB[("Template DB")]

    Queue["Event Bus"]

    CDN --> Gateway

    Gateway --> Auth
    Gateway --> Wedding
    Gateway --> Template
    Gateway --> Media
    Gateway --> Publishing
    Gateway --> RSVP

    Auth --> SupabaseAuth
    Auth --> AuthDB

    Wedding --> WeddingDB
    Template --> TemplateDB

    Wedding --> Queue
    Publishing --> Queue
    RSVP --> Queue

    Queue --> Notification
    Queue --> Analytics
```

Do not implement this architecture prematurely.

------------------------------------------------------------------------

# 60. Future Multi-Tenancy

The initial model is:

``` text
User
  ↓
Wedding
```

If the business later supports wedding planners/agencies:

``` text
Organization
   │
   ├── Users
   ├── Weddings
   └── Templates
```

At that point introduce organization-level tenancy and authorization.

------------------------------------------------------------------------

# 61. Billing & Commerce Domain

The frontend dashboard introduces commercial concepts (`InvitationSite`,
`PaymentRecord`, `AdminCustomer`, `AdminMetric`, per-template
free/paid toggles) that did not previously exist in this architecture.
This section defines how they map onto the backend domain model.

## 61.1 Vocabulary: InvitationSite Is a Projection, Not a New Entity

The frontend's `InvitationSite` (occasion, status draft/published/
expired, url, views, rsvps) is a UI-facing dashboard projection of:

``` text
Wedding / Event
  + its PUBLISHED_SITE pointer
  + lightweight analytics counters
```

It is **not** a separate backend entity and requires no backend rename.
The dashboard simply composes an existing `WEDDING`, its
`PUBLISHED_SITE` (Section 9), and analytics counters into one view
model.

`views` is a lightweight, eventually-consistent counter (e.g. a
`wedding_analytics.view_count` column), incremented asynchronously. It
must never sit in the hot path of a page render and must never be part
of the transactional publish/draft logic (Section 34).

## 61.2 Commercial Fields on TEMPLATE

The `TEMPLATE` entity gains commercial fields, distinct from its
existing `status` field (which governs content/version readiness, not
commercial visibility):

``` text
TEMPLATE
--------------------------------
...existing fields (Section 9)...
pricing_model         FREE | PAID
price_amount_minor    integer (minor currency unit)
currency              char(3), default INR
storefront_status     LISTED | UNLISTED
```

## 61.3 PAYMENT Entity

``` text
PAYMENT
--------------------------------
id
user_id              FK -> users.id
template_id          FK -> templates.id, nullable
wedding_id           FK -> weddings.id, nullable
amount_minor
currency
status               PENDING | SUCCEEDED | FAILED | REFUNDED
provider             RAZORPAY | STRIPE | ...
provider_reference
method
invoice_number
created_at
updated_at
```

Payments are accessed only through a `PaymentProvider` interface, the
same ports-and-adapters pattern as `IdentityProvider` (Section 14) and
`StorageProvider` (Section 31), so the payment gateway is swappable:

``` typescript
interface PaymentProvider {
  createCheckoutSession(input: CreateCheckoutRequest): Promise<CheckoutSession>;
  verifyWebhookSignature(payload: Buffer, signature: string): boolean;
  getPayment(providerReference: string): Promise<PaymentStatus>;
  refund(providerReference: string, amountMinor?: number): Promise<RefundResult>;
}
```

Initial implementation: `RazorpayPaymentProvider`. A future
`StripePaymentProvider` (or other gateway) can be added without
changing the application-facing contract.

## 61.4 ENTITLEMENT Entity

``` text
ENTITLEMENT
--------------------------------
id
user_id       FK -> users.id
template_id   FK -> templates.id
source        PURCHASE | FREE | PROMO
payment_id    FK -> payments.id, nullable
granted_at
```

A user must hold an `ENTITLEMENT` for a `PAID` template before
publishing a wedding/event that uses it. Free templates need no check.

## 61.5 New APIs

``` http
PATCH /v1/templates/{id}
```

Extended with ADMIN-only fields: `pricingModel`, `priceAmount`,
`storefrontStatus`.

``` http
POST /v1/payments/checkout
POST /v1/payments/webhook
GET  /v1/users/me/entitlements
GET  /v1/admin/metrics
GET  /v1/admin/customers
```

`/v1/admin/metrics` and `/v1/admin/customers` are ADMIN-only:
aggregate revenue/customers/RSVPs, and a paginated customer list with a
plan/revenue projection, respectively.

## 61.6 Publish-Time Entitlement Check

Publishing (Section 33) gains an additional rule: if the wedding's
template has `pricing_model == PAID`, the requesting user must hold a
matching `ENTITLEMENT`, or the publish is rejected with a new error
code:

``` text
TEMPLATE_NOT_ENTITLED
```

## 61.7 Admin Analytics Are Computed, Not Duplicated

`AdminMetric` and `AdminCustomer` must be computed from `users`,
`weddings`, and `payments` via read queries or materialized views. Do
**not** create separate hand-maintained aggregate tables --- they can
drift from source data (see ADR-010).

------------------------------------------------------------------------

# 62. End-to-End User Journey

``` mermaid
flowchart TD

    Start["Visit Wedding Platform"]

    Login["Login / Signup"]

    Auth["Supabase Auth Authentication"]

    User["Application User"]

    Dashboard["Dashboard"]

    Create["Create Wedding"]

    Template["Select Template"]

    Customize["Customize"]

    Upload["Upload Photos"]

    Preview["Preview"]

    Publish["Publish"]

    URL["Generate Public URL"]

    Share["Share with Guests"]

    Guest["Guest Opens URL"]

    RSVP["Optional RSVP"]

    Start --> Login
    Login --> Auth
    Auth --> User
    User --> Dashboard
    Dashboard --> Create
    Create --> Template
    Template --> Customize
    Customize --> Upload
    Upload --> Preview
    Preview --> Publish
    Publish --> URL
    URL --> Share
    Share --> Guest
    Guest --> RSVP
```

------------------------------------------------------------------------

# 63. Critical Business Data Flow

The platform can be understood as:

``` text
IDENTITY
   ↓
USER
   ↓
WEDDING
   ↓
TEMPLATE INSTANCE
   ↓
CONTENT
   ↓
DRAFT
   ↓
PREVIEW
   ↓
PUBLISHED VERSION
   ↓
PUBLIC URL
   ↓
GUEST
   ↓
RSVP
```

This should guide future domain decisions.

------------------------------------------------------------------------

# 64. Recommended Technology Stack

  Layer               Recommendation
  ------------------- --------------------------------
  Frontend            React / Next.js
  Backend             Node.js + TypeScript
  API                 REST initially
  Authentication      Supabase Auth (behind IdentityProvider abstraction)
  Identity Boundary   Auth Service
  Database            PostgreSQL (managed via Supabase; only plain PostgreSQL features used, for portability)
  Cache               Redis
  Object Storage      Supabase Storage (S3-compatible, behind StorageProvider abstraction)
  Payments            Payment gateway (behind PaymentProvider abstraction)
  CDN                 Cloud CDN
  Queue               Managed queue initially
  Observability       OpenTelemetry
  Metrics             Prometheus
  Logs                Centralized logging
  Containers          Docker
  Orchestration       Kubernetes only when justified
  IaC                 Terraform
  CI/CD               GitHub Actions

------------------------------------------------------------------------

# 65. Recommended Repository Structure

``` text
wedding-platform/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── auth/
│   ├── database/
│   ├── templates/
│   ├── validation/
│   ├── observability/
│   └── shared/
│
├── infrastructure/
│   ├── terraform/
│   ├── docker/
│   └── kubernetes/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   └── runbooks/
│
└── README.md
```

Backend:

``` text
api/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── weddings/
│   ├── templates/
│   ├── media/
│   ├── publishing/
│   ├── guests/
│   └── rsvp/
│
├── infrastructure/
├── middleware/
└── common/
```

------------------------------------------------------------------------

# 66. Architectural Decisions

## ADR-001: Use Keycloak

**Status:** Superseded by ADR-008.

**Decision:** Use Keycloak as the identity provider.

**Reason:**

-   OIDC/OAuth support.
-   Google identity federation.
-   Password authentication.
-   User lifecycle.
-   MFA.
-   Session management.
-   Token management.
-   Avoid building custom authentication.

------------------------------------------------------------------------

## ADR-002: Introduce Auth Service

**Decision:** Introduce an application-owned Auth/Identity Service.

**Reason:**

-   Decouple application contracts from the identity provider (Supabase
    Auth).
-   Centralize application-specific validation.
-   Manage application user provisioning.
-   Provide a stable identity abstraction.
-   Avoid leaking provider-specific APIs throughout the application.

**Constraint:**

The Auth Service must not reimplement Supabase Auth capabilities.

------------------------------------------------------------------------

## ADR-003: Modular Monolith for MVP

**Decision:** Start with a modular monolith.

**Reason:**

-   Lower operational complexity.
-   Faster development.
-   Easier debugging.
-   Easier transactions.
-   Lower infrastructure cost.

------------------------------------------------------------------------

## ADR-004: PostgreSQL

**Decision:** Use PostgreSQL for application data.

**Reason:**

Wedding data is relational and transactional.

------------------------------------------------------------------------

## ADR-005: Object Storage for Media

**Decision:** Store media in object storage.

**Reason:**

-   Cost.
-   Scalability.
-   Direct browser uploads.
-   CDN integration.
-   Separation from transactional database.

------------------------------------------------------------------------

## ADR-006: Template Versioning

**Decision:** Templates are immutable by version.

**Reason:**

Existing weddings must not unexpectedly change when a template is
updated.

------------------------------------------------------------------------

## ADR-007: CDN for Public Weddings

**Decision:** Public wedding content should be CDN/cache optimized.

**Reason:**

Guest traffic can be several times larger than authenticated user
traffic.

------------------------------------------------------------------------

## ADR-008: Adopt Supabase for Auth, Postgres, and Storage

**Decision:** Use Supabase (Auth, PostgreSQL, Storage) as the initial
managed infrastructure provider, superseding ADR-001's choice of
Keycloak.

**Reason:**

-   Faster zero-to-one delivery than operating Keycloak and object
    storage separately.
-   Managed operations for auth, database, and storage.
-   Strong Postgres/RLS fit for the RBAC + ownership model already
    required (Section 22).

**Constraint:**

Supabase must remain swappable. All access goes through the
`IdentityProvider` and `StorageProvider` interfaces, plain SQL
migrations, and a normal Postgres connection string, per the
portability guardrails in Section 4.5.

------------------------------------------------------------------------

## ADR-009: Per-Template Commercial Model Instead of Platform Subscription Tiers

**Decision:** Pricing is set per template (free or paid, admin-toggled),
not through platform-wide subscription tiers.

**Reason:**

Matches what the product/frontend actually needs right now: an admin
dashboard that toggles `published`/pricing per template. Platform-wide
subscription tiers are not part of the current product and would add
unused complexity.

------------------------------------------------------------------------

## ADR-010: Admin Analytics Are Computed, Not Duplicated

**Decision:** Admin dashboard metrics and customer projections
(`AdminMetric`, `AdminCustomer`) are computed from `users`, `weddings`,
and `payments` via read queries or materialized views, never stored in
hand-maintained aggregate tables.

**Reason:**

Avoid a second, driftable source of truth for revenue and customer
numbers.

------------------------------------------------------------------------

# 67. Major Risks

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Auth Service becomes second         Keep clear ownership boundary
  Supabase Auth                       

  Excessive microservices             Start modular monolith

  User data duplicated incorrectly    Supabase Auth identity + application
                                      projection

  Role-based security insufficient    RBAC + ownership

  Template updates break existing     Immutable template versions
  weddings                            

  Public traffic overloads APIs       CDN and caching

  Media overloads backend             Pre-signed direct uploads

  Supabase Auth outage blocks login    Managed HA + IdentityProvider
                                      boundary enables self-hosting
                                      GoTrue if ever required

  Public RSVP abuse                   Rate limiting/CAPTCHA

  Database becomes bottleneck         Indexing, caching, read
                                      optimization

  Admin revenue/customer figures      Compute from source tables/views,
  drift from source data              never hand-maintained aggregates

  Complex infrastructure too early    Progressive scaling
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 68. Final Recommended Architecture

## MVP

``` text
                    Internet
                       │
                 CDN / WAF / LB
                       │
             ┌─────────┴─────────┐
             │                   │
         Web App             Backend
                                 │
                  ┌──────────────┼──────────────┐
                  │              │              │
                Auth          Wedding        Template
                  │              │              │
                  │              └──────┬───────┘
                  │                     │
                  │                 PostgreSQL
                  │                (public + opaque auth schema)
                  │
             Supabase Auth (managed)

             Media → Supabase Storage (Object Storage)
             Public Sites → CDN
```

## Growth

``` text
Modular Monolith
       │
       ├── Auth
       ├── Wedding
       ├── Template
       ├── Media
       └── Publishing
              │
              ▼
        Extract selectively
```

------------------------------------------------------------------------

# 69. Final Architecture Recommendation

The architecture should follow these rules:

1.  **Supabase Auth is the authentication authority, behind an
    `IdentityProvider` interface.**
2.  **Auth Service is an identity abstraction/orchestration layer.**
3.  **Never rebuild capabilities already provided by Supabase Auth.**
4.  **Application users are separate from Supabase Auth identities.**
5.  **Use RBAC for coarse access and resource ownership for business
    authorization; RLS is defense-in-depth, not the primary
    mechanism.**
6.  **Start with three roles: USER, EDITOR, ADMIN (USER and ADMIN
    active now, EDITOR reserved for a later phase).**
7.  **Keep wedding ownership in the application database.**
8.  **Use Authorization Code + PKCE for browser authentication.**
9.  **Treat Supabase's `auth` schema as opaque, even though it shares a
    Postgres instance with the application's `public` schema.**
10. **Use PostgreSQL as the business source of truth, with only plain
    PostgreSQL features so it stays portable off Supabase.**
11. **Use object storage for media.**
12. **Use immutable template versions.**
13. **Separate draft and published wedding state.**
14. **Do not require authentication for public wedding pages.**
15. **Put public wedding traffic behind a CDN.**
16. **Start as a modular monolith.**
17. **Extract services only when scale or team boundaries justify it.**
18. **Use asynchronous events for notifications, analytics, media
    processing, and similar workloads.**
19. **Build observability from the beginning.**
20. **Keep the architecture simple enough to ship the first version
    quickly.**

------------------------------------------------------------------------

# 70. Architecture Evolution

### Stage 0 --- Development

``` text
Web
 ↓
Backend
 ↓
Supabase Auth
 ↓
PostgreSQL
```

### Stage 1 --- MVP Production

``` text
CDN/WAF
   ↓
Web + Backend
   ├── Supabase Auth (managed)
   ├── PostgreSQL
   ├── Redis
   └── Supabase Storage
```

### Stage 2 --- Growth

``` text
CDN
 ↓
Gateway
 ↓
Modular Backend
 ├── Auth
 ├── Wedding
 ├── Template
 ├── Media
 └── Publishing

 + Queue
 + Workers
 + Observability
```

### Stage 3 --- Scale

Extract only the domains that have real scaling or ownership pressure:

``` text
Auth Service
Wedding Service
Template Service
Publishing Service
Media Service
RSVP Service
Notification Service
Analytics Service
```

The architecture should evolve based on measured bottlenecks rather than
anticipated complexity.

------------------------------------------------------------------------

# 71. Architecture Review Verdict

**Recommended: APPROVE WITH THE ABOVE BOUNDARIES**

Supabase Auth is not over-engineering for this product if it is used as
an identity provider rather than as the application's business
authorization/data system.

The Auth Service is also justified **provided it remains thin in
responsibility**:

``` text
                 Auth Service
                       │
       ┌───────────────┼────────────────┐
       │               │                │
 Validation      User Mapping      Application Contract
       │               │                │
       └───────────────┼────────────────┘
                       │
                  Supabase Auth
                       │
              Authentication
```

The biggest architectural mistake to avoid is building:

``` text
Application
   ↓
Auth Service
   ↓
"Custom Supabase Auth"
   ↓
Supabase Auth
```

The intended design is:

``` text
Application
   ↓
Auth Service
   ↓
Supabase Auth
```

where each component has a clear responsibility.

**The platform should optimize for shipping the wedding experience, not
building authentication infrastructure.**
