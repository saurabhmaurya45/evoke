"""Schema validation + security checks for template-driven JSON data.

A `TemplateVersion` stores an admin-authored JSON Schema (`schema`) plus an
optional set of default field values (`defaults`). Later, end users submit
their own JSON (event drafts) that must conform to that same schema. `schema`
itself is authored as a flat field-name -> JSON-Schema-fragment map (see
docs/Template-Module-Design-Specification.md section 4.3) rather than a full
JSON Schema document — `_to_json_schema` normalizes it before use. Both cases
funnel through `validate_instance` so the rules are identical everywhere:

1. Structural validation — the JSON must conform to the template's JSON Schema
   (Draft 2020-12), so a template's schema is the single source of truth for
   what a valid submission looks like.
2. Security validation — the JSON is arbitrary, externally-supplied data that
   gets stored and later rendered back (e.g. in an invitation page). It must
   not contain markup/script content, dangerous URI schemes, or an oversized/
   too-deep structure. This is a reject-on-detection pass, not silent
   sanitization: silently stripping content would store something different
   from what the caller submitted without telling them. A rejection reports
   exactly which field and why, same as a schema violation.
"""

from __future__ import annotations

import html
import json
from typing import Any

import bleach
from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import SchemaError

from app.shared.errors import ValidationFailedError

# Defensive caps independent of whatever the template schema itself declares.
# A schema author can't be trusted to have set maxLength/maxProperties on every
# field, and jsonschema's own validator has no built-in protection against a
# maliciously deep or oversized instance (a JSON-bomb style payload can exhaust
# memory/CPU during validation before any schema rule is even checked).
_MAX_STRING_LENGTH = 20_000
_MAX_SERIALIZED_BYTES = 256_000
_MAX_DEPTH = 20

_DANGEROUS_URI_SCHEMES = ("javascript:", "data:", "vbscript:", "file:")

# Sibling keys on the stored `schema` dict that configure the generated
# wrapper (see `_to_json_schema`) rather than naming a template field.
_RESERVED_TOP_LEVEL_KEYS = {"required", "additionalProperties"}

_FORMAT_CHECKER = FormatChecker()


def _to_json_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Normalize the stored `schema` into a full JSON Schema document.

    Per docs/Template-Module-Design-Specification.md section 4.3, `schema` is
    authored as a flat map of field name -> JSON Schema fragment, e.g.
    `{"couple": {"type": "object", "properties": {...}}, "date": {"type":
    "string", "format": "date"}}` — there is no top-level "type"/"properties"
    wrapper, because admins only ever author the field list. jsonschema needs
    a real top-level schema to validate an object instance against, so wrap it.

    Two reserved sibling keys, if present alongside the field names, configure
    the wrapper instead of naming a field:
      - "required": list[str] — top-level fields that must be present.
      - "additionalProperties": bool — allow fields outside the declared set.
        Defaults to False: the stored schema is meant to be the exhaustive
        contract for what a template accepts, so an unlisted field is
        rejected rather than silently passed through to storage.

    If `schema` already has a top-level "properties" key, it's already a full
    JSON Schema document (e.g. hand-authored with `"type": "object"`) and is
    used as-is — this keeps both forms working.
    """
    if "properties" in schema:
        return schema

    fields = {k: v for k, v in schema.items() if k not in _RESERVED_TOP_LEVEL_KEYS}
    wrapped: dict[str, Any] = {
        "type": "object",
        "properties": fields,
        "additionalProperties": schema.get("additionalProperties", False),
    }
    if "required" in schema:
        wrapped["required"] = schema["required"]
    return wrapped


def validate_schema_definition(schema: dict[str, Any]) -> None:
    """Check that a template's `schema` field, once normalized (see
    `_to_json_schema`), is a syntactically valid JSON Schema (Draft 2020-12).

    Without this, an admin's malformed schema would only surface the first
    time someone tries to validate data against it — as a confusing failure
    far from where the mistake was made. Raises `ValidationFailedError` (422)
    if the schema itself is invalid.
    """
    try:
        Draft202012Validator.check_schema(_to_json_schema(schema))
    except SchemaError as exc:
        raise ValidationFailedError(
            f"schema is not a valid JSON Schema: {exc.message}",
            details={"path": [str(p) for p in exc.path]},
        ) from exc


def _check_security(value: Any, *, path: str) -> list[dict[str, str]]:
    """Recursively walk a JSON value, returning every {path, message} security
    violation found. Never mutates — a violation is a hard rejection."""
    violations: list[dict[str, str]] = []

    if isinstance(value, str):
        if len(value) > _MAX_STRING_LENGTH:
            violations.append(
                {"path": path, "message": f"exceeds maximum length of {_MAX_STRING_LENGTH} characters."}
            )
            return violations
        if "\x00" in value:
            violations.append({"path": path, "message": "contains a null byte."})
            return violations
        # bleach.clean HTML-escapes bare "&"/"<"/">" even when there's no real
        # markup, so compare after unescaping entities back — a plain-text
        # "Alex & Sam" or "5 < 10" must not be flagged, only actual tags/
        # attributes that strip=True removed.
        cleaned = html.unescape(bleach.clean(value, tags=[], attributes={}, strip=True))
        if cleaned != value:
            violations.append(
                {"path": path, "message": "contains HTML/script markup, which is not allowed."}
            )
            return violations
        if value.strip().lower().startswith(_DANGEROUS_URI_SCHEMES):
            violations.append({"path": path, "message": "uses a disallowed URI scheme."})
        return violations

    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str) or len(key) > 200:
                violations.append({"path": path or "$", "message": "has an invalid property name."})
                continue
            violations.extend(_check_security(item, path=f"{path}.{key}" if path else key))
        return violations

    if isinstance(value, list):
        for index, item in enumerate(value):
            violations.extend(_check_security(item, path=f"{path}[{index}]"))
        return violations

    return violations


def _depth(value: Any) -> int:
    if isinstance(value, dict):
        return 1 + max((_depth(v) for v in value.values()), default=0)
    if isinstance(value, list):
        return 1 + max((_depth(v) for v in value), default=0)
    return 0


def _check_size(instance: dict[str, Any]) -> None:
    serialized_size = len(json.dumps(instance).encode("utf-8"))
    if serialized_size > _MAX_SERIALIZED_BYTES:
        raise ValidationFailedError(
            f"data exceeds the maximum allowed size of {_MAX_SERIALIZED_BYTES} bytes.",
            details={"sizeBytes": serialized_size},
        )
    depth = _depth(instance)
    if depth > _MAX_DEPTH:
        raise ValidationFailedError(
            f"data is nested more than {_MAX_DEPTH} levels deep.", details={"depth": depth}
        )


def _strip_required(node: Any) -> Any:
    """Recursively drop "required" from every object-schema node (any dict
    that declares "properties") — used for `partial=True` so a template's
    `defaults` can legitimately leave required fields for the end user to
    fill in later, without disabling `required` for real submissions."""
    if isinstance(node, dict):
        stripped = {k: _strip_required(v) for k, v in node.items()}
        if "properties" in node:
            stripped.pop("required", None)
        return stripped
    if isinstance(node, list):
        return [_strip_required(v) for v in node]
    return node


def _strip_empty_leaves(node: Any) -> Any:
    """Recursively drop dict keys whose value is "" — used for `partial=True`
    so an empty placeholder value (e.g. `{"name_1": ""}` in a template's
    `defaults`) isn't held to that field's `minLength`/`pattern`, while a
    non-empty value is still fully checked."""
    if isinstance(node, dict):
        return {k: _strip_empty_leaves(v) for k, v in node.items() if v != ""}
    if isinstance(node, list):
        return [_strip_empty_leaves(v) for v in node]
    return node


def validate_instance(
    schema: dict[str, Any],
    instance: dict[str, Any],
    *,
    field_label: str = "data",
    partial: bool = False,
) -> None:
    """Validate `instance` against `schema` and reject it if it contains
    markup/script content, a dangerous URI scheme, or an oversized/too-deep
    structure.

    `partial=True` is for a template's own `defaults` — a pre-fill template,
    not a final submission, so a field the admin left blank (`""`) or omitted
    entirely must not trip that field's `required`/`minLength`/`pattern`.
    Every field that *is* given a non-empty value is still fully validated
    (type, maxLength, format, enum, security), so genuinely wrong data (wrong
    type, disallowed markup, exceeding a length cap) is still caught. Real
    end-user submissions must use `partial=False` (the default).

    Raises `ValidationFailedError` (422) with every violation found — schema
    violations and security violations are reported the same way, since both
    are just "this submission is not acceptable" from the caller's point of
    view. Checked in cheapest-first order: size/depth, then security content,
    then full schema conformance.
    """
    _check_size(instance)

    working_instance = _strip_empty_leaves(instance) if partial else instance

    security_violations = _check_security(working_instance, path="")
    if security_violations:
        raise ValidationFailedError(
            f"{field_label} contains disallowed content.",
            details={"violations": security_violations},
        )

    json_schema = _to_json_schema(schema)
    if partial:
        json_schema = _strip_required(json_schema)

    validator = Draft202012Validator(json_schema, format_checker=_FORMAT_CHECKER)
    schema_errors = sorted(
        validator.iter_errors(working_instance), key=lambda e: [str(p) for p in e.path]
    )
    if schema_errors:
        raise ValidationFailedError(
            f"{field_label} does not conform to the template schema.",
            details={
                "errors": [
                    {"path": [str(p) for p in e.path], "message": e.message} for e in schema_errors
                ]
            },
        )
