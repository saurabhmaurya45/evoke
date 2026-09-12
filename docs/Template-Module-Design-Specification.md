# Template Module --- Design Specification

**Document Version:** 1.0  
**Status:** Implementation  
**Audience:** Backend, Frontend, Architecture  
**Primary Goal:** Define the Template Module architecture, data model, and API contracts for the Evoke platform  

---

## 1. Executive Summary

The Template Module manages reusable event invitation templates. Templates are:
- **Created by admins** with schema, defaults, and capabilities
- **Published as immutable versions** that never change
- **Discovered by users** via a public gallery
- **Used as blueprints** for creating new events

The module stores only metadata and data structures—**not** HTML/CSS/JS. Template assets (HTML, CSS, JavaScript) are bundled with the frontend application.

---

## 2. Scope & Responsibilities

### 2.1 In Scope

- Template CRUD (admin-only)
- Template versioning (immutable snapshots)
- Schema definition and validation
- Default values management
- Capability registry
- Public gallery listing
- Category management
- Currency management

### 2.2 Out of Scope (MVP)

- Template rendering engine (frontend responsibility)
- Asset CDN/CDN delivery (future: separate service)
- Template marketplace/billing (handled by commerce module)
- Collaborative template editing (future: multi-user versioning)
- Template analytics (future: separate service)

---

## 3. Architecture Principles

### 3.1 Immutable Versions

Once a template version is published, it is **frozen forever**. All published versions are retained indefinitely.

```
Royal Wedding
├── v1 (2026-01) → PUBLISHED (immutable)
├── v2 (2026-03) → PUBLISHED (immutable)
├── v3 (2026-06) → PUBLISHED (immutable)
└── v4 (2026-09) → PUBLISHED (immutable)
```

Events lock to a specific version. Upgrading is the user's choice.

### 3.2 Assets Bundled with Frontend

Template HTML/CSS/JS are **not stored in the database**. Instead:

```
Frontend (Git-Managed Assets)
├── src/assets/templates/royal-wedding/
│   ├── index.html
│   ├── styles.css
│   └── script.js
└── src/assets/templates/minimal/
    ├── index.html
    ├── styles.css
    └── script.js

Database (Metadata + Schema Only)
├── templates (master metadata)
└── template_versions (schema, defaults, capabilities)
```

Admin registers template → database stores schema + metadata only.

### 3.3 Data-Driven Validation

Templates define:
- **Schema** — JSON Schema rules for validation
- **Defaults** — Initial data when event is created
- **Capabilities** — Feature flags (gallery, RSVP, countdown, etc.)

Users enter data; system validates against schema.

### 3.4 Category as Event Type

Event type is **derived from template category**. No denormalization.

```
categories: wedding, birthday, corporate, etc.
templates: each has category_id
events: type = templates[event.template_id].category_id
```

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

```
categories (1) ──── (M) templates
currencies (1) ──── (M) templates
templates (1) ──── (M) template_versions
templates (1) ──── (M) events
```

### 4.2 Table Definitions

#### **categories**
```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url VARCHAR(255),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Classify templates (wedding, birthday, corporate, etc.)

---

#### **currencies**
```sql
CREATE TABLE currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(3) UNIQUE NOT NULL,       -- INR, USD, EUR
  name VARCHAR(50) NOT NULL,
  symbol VARCHAR(10) NOT NULL,         -- ₹, $, €
  minor_unit INT NOT NULL,             -- 100 (paise), 1 (cents)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Support multi-currency pricing for templates

---

#### **templates**
```sql
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,   -- royal-wedding
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category_id UUID NOT NULL REFERENCES categories(id),
  pricing_model VARCHAR(20) NOT NULL,  -- FREE, PAID
  price_amount_minor BIGINT,           -- 49900 (₹499)
  currency_id UUID REFERENCES currencies(id),
  storefront_status VARCHAR(20) NOT NULL DEFAULT 'LISTED',  -- LISTED, UNLISTED
  thumbnail_url VARCHAR(255),
  preview_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_category ON templates(category_id);
CREATE INDEX idx_templates_storefront ON templates(storefront_status);
```

**Purpose:** Master template metadata  
**Mutability:** storefront_status can change; other fields rarely change

---

#### **template_versions**
```sql
CREATE TABLE template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  template_version INT NOT NULL,       -- v1, v2, v3, v4
  schema_version INT NOT NULL,         -- 1, 2, 3 (data contract version)
  protocol_version INT NOT NULL DEFAULT 1,  -- iframe protocol version
  
  -- JSONB columns (metadata + schema)
  schema JSONB NOT NULL,               -- JSON Schema validation rules
  defaults JSONB NOT NULL,             -- Initial values for new events
  capabilities JSONB NOT NULL,         -- { gallery: true, audio: false, ... }
  
  status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',  -- DRAFT, PUBLISHED
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(template_id, template_version)
);

CREATE INDEX idx_template_versions_template ON template_versions(template_id);
CREATE INDEX idx_template_versions_status ON template_versions(status);
```

**Purpose:** Immutable snapshots of template configuration  
**Immutability:** Once inserted, never updated or deleted

---

### 4.3 JSONB Column Definitions

#### **schema** (JSON Schema)
```json
{
  "couple": {
    "type": "object",
    "properties": {
      "name_1": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100,
        "title": "Partner 1 Name"
      },
      "name_2": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100,
        "title": "Partner 2 Name"
      },
      "nickname": {
        "type": "string",
        "maxLength": 100,
        "title": "Couple Nickname (optional)"
      }
    },
    "required": ["name_1", "name_2"]
  },
  "date": {
    "type": "string",
    "format": "date",
    "title": "Event Date"
  },
  "venue": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "maxLength": 200 },
      "city": { "type": "string", "maxLength": 100 },
      "country": { "type": "string", "maxLength": 100 }
    }
  },
  "story": {
    "type": "string",
    "maxLength": 5000,
    "title": "Your Love Story (optional)"
  }
}
```

**Purpose:** Validation rules for user data  
**Used by:** Backend validator, frontend form generator

---

#### **defaults** (Default Values)
```json
{
  "couple": {
    "name_1": "",
    "name_2": "",
    "nickname": ""
  },
  "date": "2026-12-31",
  "venue": {
    "name": "Taj Mahal",
    "city": "Agra",
    "country": "India"
  },
  "story": ""
}
```

**Purpose:** Initial data when event is created  
**Used by:** Event creation flow

---

#### **capabilities** (Feature Flags)
```json
{
  "gallery": true,
  "audio": true,
  "countdown": true,
  "rsvp": true,
  "guestList": true,
  "theme": {
    "colorCustomization": true,
    "fontCustomization": false
  }
}
```

**Purpose:** Declare which features template supports  
**Used by:** Editor UI (show/hide buttons), validation

---

## 5. API Contracts

### 5.1 Admin APIs (ADMIN role required)

#### **5.1.1 Create Template**

```http
POST /v1/templates
```

**Request:**
```json
{
  "slug": "royal-wedding",
  "name": "Royal Wedding",
  "description": "Elegant royal wedding invitation template",
  "categoryId": "cat_123",
  "pricingModel": "PAID",
  "priceAmountMinor": 49900,
  "currencyId": "cur_inr",
  "thumbnailUrl": "https://cdn.example.com/royal-thumb.jpg",
  "previewUrl": "https://cdn.example.com/royal-preview.jpg"
}
```

**Response:** 201 Created
```json
{
  "data": {
    "id": "tpl_123",
    "slug": "royal-wedding",
    "name": "Royal Wedding",
    "categoryId": "cat_123",
    "category": "wedding",
    "pricingModel": "PAID",
    "priceAmountMinor": 49900,
    "storefrontStatus": "UNLISTED",
    "createdAt": "2026-09-12T10:00:00Z"
  }
}
```

---

#### **5.1.2 Create Template Version**

```http
POST /v1/templates/{templateId}/versions
```

**Request:**
```json
{
  "schema": {...},
  "defaults": {...},
  "capabilities": {...},
  "schemaVersion": 1,
  "protocolVersion": 1
}
```

**Response:** 201 Created
```json
{
  "data": {
    "id": "tv_123",
    "templateId": "tpl_123",
    "templateVersion": 1,
    "schemaVersion": 1,
    "protocolVersion": 1,
    "status": "DRAFT",
    "createdAt": "2026-09-12T10:05:00Z"
  }
}
```

---

#### **5.1.3 Publish Template Version**

```http
POST /v1/templates/{templateId}/versions/{version}/publish
```

**Response:** 200 OK
```json
{
  "data": {
    "id": "tv_123",
    "templateId": "tpl_123",
    "templateVersion": 1,
    "status": "PUBLISHED",
    "publishedAt": "2026-09-12T10:10:00Z"
  }
}
```

---

#### **5.1.4 Update Template Metadata**

```http
PATCH /v1/templates/{templateId}
```

**Request:**
```json
{
  "name": "Royal Wedding v2",
  "description": "Updated description",
  "storefrontStatus": "LISTED",
  "pricingModel": "FREE"
}
```

**Response:** 200 OK
```json
{
  "data": {
    "id": "tpl_123",
    "name": "Royal Wedding v2",
    "storefrontStatus": "LISTED",
    "pricingModel": "FREE",
    "updatedAt": "2026-09-12T10:15:00Z"
  }
}
```

---

### 5.2 Public APIs

#### **5.2.1 List Templates (Gallery)**

```http
GET /v1/templates?category=wedding&page=1&pageSize=20
```

**Response:** 200 OK
```json
{
  "data": [
    {
      "id": "tpl_123",
      "slug": "royal-wedding",
      "name": "Royal Wedding",
      "category": "wedding",
      "pricingModel": "PAID",
      "priceAmountMinor": 49900,
      "currency": "INR",
      "thumbnailUrl": "...",
      "capabilities": [
        "gallery",
        "audio",
        "rsvp"
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 50
  }
}
```

**Query Parameters:**
- `category` — Filter by category slug
- `search` — Free-text search on name/description
- `page` — Page number (1-indexed)
- `pageSize` — Results per page

---

#### **5.2.2 Get Template Details**

```http
GET /v1/templates/{templateId}
```

**Response:** 200 OK
```json
{
  "data": {
    "id": "tpl_123",
    "slug": "royal-wedding",
    "name": "Royal Wedding",
    "description": "...",
    "category": "wedding",
    "pricingModel": "PAID",
    "priceAmountMinor": 49900,
    "currency": "INR",
    "thumbnailUrl": "...",
    "previewUrl": "...",
    "capabilities": {
      "gallery": true,
      "audio": true,
      "rsvp": true,
      "countdown": true
    }
  }
}
```

---

#### **5.2.3 Get Template Version (Editor)**

```http
GET /v1/templates/{templateId}/versions/{version}
```

**Response:** 200 OK
```json
{
  "data": {
    "id": "tv_123",
    "templateId": "tpl_123",
    "templateVersion": 1,
    "schemaVersion": 1,
    "protocolVersion": 1,
    "schema": {...},
    "defaults": {...},
    "capabilities": {...}
  }
}
```

---

## 6. Data Flow

### 6.1 Admin: Register & Publish Template

```
1. Admin creates template metadata
   POST /v1/templates
   └─ Creates templates row
   └─ storefront_status = UNLISTED (hidden by default)

2. Admin creates template version with schema/defaults
   POST /v1/templates/{templateId}/versions
   └─ Creates template_versions row
   └─ status = DRAFT (not ready yet)

3. Admin publishes version
   POST /v1/templates/{templateId}/versions/{version}/publish
   └─ Updates template_versions.status = PUBLISHED
   └─ template_version auto-increments

4. Admin lists template in gallery
   PATCH /v1/templates/{templateId}
   { "storefrontStatus": "LISTED" }
   └─ Template now appears in GET /v1/templates
```

### 6.2 User: Browse & Select Template

```
1. User browses gallery
   GET /v1/templates?category=wedding
   └─ Returns templates WHERE storefront_status = LISTED

2. User views template details
   GET /v1/templates/{templateId}
   └─ Returns metadata + capabilities

3. User selects template to create event
   POST /v1/events
   {
     "title": "Aarav & Diya",
     "templateId": "tpl_123"
   }
   └─ Fetch template_versions (latest PUBLISHED)
   └─ Copy defaults → event.draft
   └─ Lock template_version in event row
```

### 6.3 User: Edit Event Using Template

```
1. User opens editor
   GET /v1/events/{eventId}
   ├─ Returns event + draft data
   ├─ Fetches GET /v1/templates/{templateId}/versions/{version}
   │  └─ Returns schema + capabilities
   └─ Frontend loads template HTML from public/templates/{templateId}/

2. Editor renders
   ├─ HTML structure from template asset
   ├─ Schema used for validation
   ├─ Capabilities used for feature toggling
   └─ Defaults used for initialization

3. User edits field
   ├─ Frontend updates signal
   ├─ 800ms debounce
   └─ PUT /v1/events/{eventId}/draft { "data": {...} }
      └─ Backend validates against schema
      └─ Updates event.draft (single JSONB field)
```

---

## 7. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Immutable versions** | Existing events never break when templates update |
| **Assets in frontend** | Simplifies deployment; no need for asset CDN in MVP |
| **Schema-driven validation** | Supports 100+ templates without custom code per template |
| **JSONB storage** | Flexible, queryable, allows nested structures |
| **Defaults per version** | Each version can have different initial data |
| **Capabilities as flags** | Editor can show/hide features based on template |
| **No type denormalization** | Event type derived from template.category |
| **Admin-only creation** | Prevents template sprawl; admins control quality |

---

## 8. Implementation Order

### Phase 1: Database Schema
- Create tables: categories, currencies, templates, template_versions
- Create indexes
- Seed initial categories + currencies

### Phase 2: Admin APIs
- POST /v1/templates (create template)
- POST /v1/templates/{id}/versions (create version)
- POST /v1/templates/{id}/versions/{v}/publish
- PATCH /v1/templates/{id} (update metadata)

### Phase 3: Public APIs
- GET /v1/templates (list/browse)
- GET /v1/templates/{id} (details)
- GET /v1/templates/{id}/versions/{v} (for editor)

### Phase 4: Integration
- Event creation uses template defaults
- Event validation uses template schema
- Editor sends schema to frontend

---

## 9. Error Handling

| Error | Status | Code | Message |
|-------|--------|------|---------|
| Template not found | 404 | TEMPLATE_NOT_FOUND | Template does not exist |
| Version not found | 404 | TEMPLATE_VERSION_NOT_FOUND | Version does not exist |
| Invalid schema | 400 | INVALID_SCHEMA | Schema is not valid JSON Schema |
| Already published | 409 | ALREADY_PUBLISHED | Version is already published |
| Unauthorized | 403 | FORBIDDEN | User is not ADMIN |
| Duplicate slug | 409 | SLUG_TAKEN | Template slug already exists |

---

## 10. Testing Strategy

### Unit Tests
- Schema validation (valid/invalid data)
- Capability flags
- Version immutability

### Integration Tests
- Create template → create version → publish
- Gallery filtering by category
- Template details with schema

### Contract Tests
- Admin API responses match schema
- Public API responses match schema
- Error responses consistent

---

## 11. Future Enhancements (Out of MVP)

- Template versioning with migration strategies
- Collaborative template editing (multi-user)
- Template analytics (usage, popularity)
- Template CDN for distributed asset delivery
- Template marketplace with ratings
- Template migration guide (v1 → v2)
- Template cloning (copy existing template)

---

## 12. Security Considerations

- **Admin-only:** POST/PATCH template operations require ADMIN role
- **Public read:** GET operations are public (no auth required)
- **Schema validation:** All user data validated against schema before storage
- **No code injection:** Templates cannot contain user-provided JavaScript
- **Asset validation:** Template HTML/CSS/JS validated before frontend bundling

---
