# Evoke Backend

FastAPI + SQLAlchemy 2.0 (async) backend for the Evoke event-invitation platform.
See `../docs/` for the full architecture (identity, portability boundary, domain
model, API contract). Implemented: Foundation, Auth, Users, Events, Templates,
Drafts, Publishing, and Payments (Razorpay — see [Payments](#payments-razorpay)).
Media and RSVP are not implemented yet.

## Stack

- **API:** FastAPI, async endpoints throughout
- **DB access:** SQLAlchemy 2.0 (async, `asyncpg` driver), Alembic for migrations
- **Identity:** Supabase Auth, behind the `IdentityProvider` interface
  (`app/shared/auth/identity_provider.py`) — see the portability boundary in the
  architecture docs. Swapping providers later means writing a new adapter, not
  rewriting business logic.
- **Database:** PostgreSQL, managed by Supabase in production; any Postgres works
  locally/in tests.

## Local setup

1. **Python env**

   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -e ".[dev]"
   ```

2. **Environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in `DATABASE_URL` (Supabase project settings → Database → Connection string,
   using the `postgresql+asyncpg://` scheme) and `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`
   / `SUPABASE_SECRET_KEY` (Supabase project settings → API Keys). Set
   `SUPABASE_JWT_SECRET` only if your project still uses the legacy shared HS256
   secret (Project settings → JWT Keys) — leave it blank (and optionally set
   `SUPABASE_JWKS_URL` explicitly) to validate tokens against the project's JWKS
   endpoint instead.

   For payments, set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (Razorpay Dashboard →
   Account & Settings → API Keys; use `rzp_test_…` keys locally) and
   `RAZORPAY_WEBHOOK_SECRET` (the secret you enter when creating the webhook).
   `API_BASE_URL` / `FRONTEND_BASE_URL` build the Razorpay callback and the
   post-payment redirect. All are optional: without Razorpay keys, free templates
   still publish and paid checkout returns `503 PAYMENTS_NOT_CONFIGURED`.

   Never commit `.env`.

3. **Run migrations**

   ```bash
   alembic upgrade head
   ```

4. **Run the API**

   ```bash
   uvicorn app.main:app --reload
   ```

   - `GET /health` — process liveness
   - `GET /ready` — checks the DB connection
   - `GET /docs` — OpenAPI/Swagger UI

   On Windows, `--reload` occasionally leaves an orphaned worker serving the old
   code (and it never reloads on `.env` changes). If a change seems to have no
   effect, stop every `uvicorn`/`python` process on port 8000 and start again —
   `/ready` alone can't tell you which code is running.

## Payments (Razorpay)

Invitations built on a **PAID** template can only be published after a successful
Razorpay payment. Code lives in `app/payments/`; the `payments` table is created by
migration `c3d9e1f2a4b5_add_payments_table`.

**Pricing** comes from the `templates` row (`pricing_model`, `price_amount_minor` in
paise, `currency_id` → defaults to `INR`). The client only ever sends an `eventId`;
the amount is always computed server-side (`app/payments/pricing.py`). An event's
template is resolved by `resolve_event_template()` in `app/events/service.py`:
`event.template_id` → `draft.template_id` → template whose slug equals the event title
(the frontend creates events titled with the template slot id, e.g. `tpl-samarpan-royal`).

**Flow**

1. `POST /v1/payments/checkout {eventId}`
   - free template, or already paid → publishes the event, returns `paymentRequired: false`;
   - paid → inserts a `CREATED` payment, creates a Razorpay **Payment Link**
     (`reference_id` = our payment id) and returns `paymentRequired: true, checkoutUrl`.
     A still-valid link for the same event and amount is reused, and checkout takes a
     row lock on the event (`SELECT … FOR UPDATE`) so simultaneous requests — double
     clicks, two tabs — wait for the first one and get the same link instead of
     creating duplicates.
2. The frontend redirects the browser to `checkoutUrl`; the user pays on Razorpay.
3. Razorpay redirects to `GET /v1/payments/razorpay/callback`. The backend verifies the
   HMAC-SHA256 signature (`link_id|reference_id|status|payment_id`, keyed by
   `RAZORPAY_KEY_SECRET`), marks the payment `PAID`, publishes the event, and 303s to
   `{FRONTEND_BASE_URL}/payment/result?status=success|failed&paymentId=…&eventId=…`.
4. `POST /v1/payments/razorpay/webhook` (`payment_link.paid` / `.expired` /
   `.cancelled`, verified with `RAZORPAY_WEBHOOK_SECRET`) is the backup for users who
   close the tab before the redirect. Callback and webhook share one idempotent
   `mark_paid()`, so a payment is never applied twice.

`POST /v1/events/{id}/publish` returns **402 `PAYMENT_REQUIRED`** for an unpaid event on
a paid template (admins are exempt).

**Endpoints**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/payments/quote?eventId=` | owner/admin | Template name, price, `paymentRequired`, `alreadyPaid`, event slug/status |
| POST | `/v1/payments/checkout` | owner/admin | Publish free events, or start a Razorpay checkout |
| GET | `/v1/payments` | user | Current user's payments (dashboard history) |
| GET | `/v1/payments/{paymentId}` | owner/admin | Payment status (polled by the result page) |
| GET | `/v1/payments/razorpay/callback` | none (signature) | Razorpay browser redirect |
| POST | `/v1/payments/razorpay/webhook` | none (signature) | Razorpay server webhook |
| GET | `/v1/admin/payments` | admin | All payments with customer email and template |
| GET | `/v1/admin/customers` | admin | Includes `revenueMinor` (sum of PAID payments) |

Payment statuses: `CREATED` → `PAID`, or `EXPIRED` / `CANCELLED` (from webhooks).

**Webhook setup:** the backend must be publicly reachable (e.g. `ngrok http 8000`
locally). In Razorpay Dashboard → Webhooks, add
`https://<public-host>/v1/payments/razorpay/webhook` with the events
`payment_link.paid`, `payment_link.expired`, `payment_link.cancelled`, and copy the
secret into `RAZORPAY_WEBHOOK_SECRET`. Without it, webhooks are rejected with 400 and
only the browser callback confirms payments.

**Testing in Razorpay test mode:** set a template to PAID (admin dashboard → Edit →
Paid, which PATCHes `pricingModel`/`priceAmountMinor`), publish an invitation built on
it, and pay with **Netbanking → any bank → Success** on the demo bank page, or an
Indian test card (e.g. Visa `4386 2894 0766 0153`, any future expiry/CVV).
International cards such as `4242 4242 4242 4242` are rejected unless international
payments are enabled on the Razorpay account, and Razorpay rejects obvious dummy
mobile numbers (`9999999999`).

## Tests

Tests never touch a real Supabase project or issue real JWTs — auth is exercised
through a `FakeIdentityProvider` test double (`tests/conftest.py`), and the DB layer
needs any reachable Postgres:

```bash
# Option A: point at any Postgres you already have running (fastest, no Docker)
export TEST_DATABASE_URL="postgresql+asyncpg://<user>@localhost:5432/<some_db>"
pytest

# Option B: no TEST_DATABASE_URL set + Docker running -> spins up an ephemeral
# Postgres container automatically via testcontainers
pytest
```

## Adding a new domain module

Follow the existing modules (`app/users`, `app/events`, `app/templates`,
`app/drafts`, `app/payments`) as the template: `models.py` (SQLAlchemy), `schemas.py` (Pydantic
`CamelModel` subclasses — the API is camelCase JSON, Python stays snake_case),
`service.py` (business logic, ownership checks via
`app.shared.authorization.ensure_owner_or_admin`, audit logging via
`app.shared.audit.log_action`), `router.py` (thin, delegates to `service.py`).

Register new models in `app/db_models.py` and new routers in `app/main.py`. Write
migrations by hand (see `alembic/versions/`) rather than relying on autogenerate
against a live DB — this repo doesn't assume you have one connected at write time.

## Portability

Business logic (ownership rules, draft optimistic concurrency, template versioning)
lives in this codebase's `service.py` files — never in Supabase Edge Functions or
solely in RLS policies. Migrations are plain Alembic/SQL. The backend talks to
Postgres via a normal connection string, not the Supabase SDK. See
`docs/wedding-platform-architecture.md` §4.5 for the full exit-strategy rationale.
