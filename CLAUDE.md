# Evoke — Engineering Rules

## Validation

- Validate at every layer that actually has the information to validate, and no other layer.
  - **Pydantic schema level** (`app/*/schemas.py`): shape and self-contained cross-field rules — things fully knowable from the request body alone (e.g. `pricingModel=PAID` requires `priceAmountMinor` + `currencyId` in the same payload). Use `model_validator(mode="after")`, raise `ValueError` with a message referencing the camelCase field name the client sent.
  - **Service layer** (`app/*/service.py`): anything requiring a DB read — foreign-key existence/active checks, uniqueness checks, invariants that depend on a partial update's *merged* state (a `PATCH` payload alone can't see fields it didn't touch). Never rely on a DB constraint to surface a validation error to the client — check first, raise a typed error, and let the constraint be the last-resort safety net, not the primary mechanism.
- Before writing an `INSERT`/`UPDATE` that has a `UNIQUE` or `FOREIGN KEY` constraint backing it, check for the conflict/missing-reference explicitly and raise the matching typed error. Do not let `IntegrityError` reach the client — it becomes a generic, unhelpful 500 instead of a clean 409/422 with a message that says what was actually wrong. (Concrete instance of this bug: `create_template` was missing a duplicate-slug pre-check that `create_category`/`create_currency` already had — fixed by adding the same pre-check pattern.)
- For every new mutating endpoint, ask explicitly: what makes this input invalid, and at which layer can that actually be detected? Write that check down instead of assuming the ORM/DB will catch it acceptably.

## Error handling

- All domain errors are `AppError` subclasses (`app/shared/errors.py`) with a stable `code`, a human-readable `message`, and the correct HTTP status:
  - 401 `AuthRequiredError` — no/invalid credentials.
  - 403 `AuthForbiddenError` — authenticated but not permitted.
  - 404 `NotFoundError` — resource doesn't exist. Use 404 (not 403) when revealing existence itself would leak information (e.g. a non-admin probing for a draft resource by id) — see `get_template_version`.
  - 409 `ConflictError` — request is well-formed but conflicts with current state (duplicate unique key, invalid state transition).
  - 422 `ValidationFailedError` — request violates a business-rule invariant that isn't a plain schema violation (schema violations are handled automatically by FastAPI's `RequestValidationError`, same envelope, same status).
- Never let an unexpected exception type reach a route handler uncaught if you can anticipate it — anticipate it and raise the typed error instead. The catch-all handler exists as a safety net for truly unexpected failures, not as a substitute for input validation.
- Every error response uses the same envelope: `{"error": {"code", "message", "requestId", "details"}}`. Don't invent a different shape for a new error path.
- Error messages must say what was wrong and, where relevant, which field — not a generic "invalid input."

## API design & documentation

- Every route gets a `summary` and a docstring `description` — write them for a Swagger consumer who has never read the code: what the endpoint does, auth requirements, what makes a request fail, and any non-obvious behavior (soft-delete instead of hard-delete, immutability, idempotency).
- Tag each route exactly once. `APIRouter(tags=[...])` at the router level and a route-level `tags=[...]` are **concatenated by FastAPI, not overridden** — combining them duplicates the operation across sections in Swagger's UI. Either tag at the router level and never override per-route, or don't set a router-level tag and tag every route explicitly — never mix both on the same router.
- Auth must be a real OpenAPI security scheme (`fastapi.security.HTTPBearer`, not manual `Authorization` header parsing via `Header()`) so Swagger renders the padlock icon and "Authorize" button, and the security requirement is machine-readable in the spec.
- Prefer explicit Pydantic `Field(description=...)` on request/response fields over relying on the field name alone — the OpenAPI schema should be self-explanatory without reading the source.

## General

- Match an existing pattern before inventing a new one. If two similar resources (e.g. categories/currencies) already implement create/update/delete a certain way, a third resource joining that pattern should follow it exactly, not a variant.
- No mock/seed data in application code or startup lifespan — the app must boot clean with an empty catalog. Seeding, if ever needed, is an external script, never something `main.py` runs automatically.
- After any schema/model change, verify the actual database matches (`information_schema.columns`) rather than assuming a migration applied cleanly — migration chains can end up partially applied during iteration.
