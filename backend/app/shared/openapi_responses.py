"""Helpers for documenting error responses in the OpenAPI spec.

Every domain error uses the same envelope (see `app.shared.errors`), so a route only
needs to say *which* status codes/error codes it can actually raise — the shape
itself is defined once here and reused everywhere. Compose with `merge(...)`:

    @router.post(
        "/categories",
        responses=merge(UNAUTHORIZED, FORBIDDEN, conflict("CATEGORY_SLUG_EXISTS", "...")),
    )
"""

from typing import Any

from app.shared.schema import CamelModel


class ErrorDetail(CamelModel):
    code: str
    message: str
    request_id: str
    details: dict[str, Any] = {}


class ErrorEnvelope(CamelModel):
    error: ErrorDetail


def error_response(status_code: int, code: str, message: str) -> dict[int, dict[str, Any]]:
    """Build one FastAPI `responses=` entry — a status code mapped to the error
    envelope schema plus a concrete example for that specific error code."""
    return {
        status_code: {
            "model": ErrorEnvelope,
            "description": message,
            "content": {
                "application/json": {
                    "example": {
                        "error": {
                            "code": code,
                            "message": message,
                            "requestId": "b3a1e2c4-5d6f-4a7b-8c9d-0e1f2a3b4c5d",
                            "details": {},
                        }
                    }
                }
            },
        }
    }


def not_found(code: str, message: str) -> dict[int, dict[str, Any]]:
    return error_response(404, code, message)


def conflict(code: str, message: str) -> dict[int, dict[str, Any]]:
    return error_response(409, code, message)


def validation_failed(message: str) -> dict[int, dict[str, Any]]:
    return error_response(422, "VALIDATION_FAILED", message)


UNAUTHORIZED = error_response(401, "AUTH_REQUIRED", "Authentication is required.")
FORBIDDEN = error_response(403, "AUTH_FORBIDDEN", "You do not have access to this resource.")


def merge(*responses: dict[int, dict[str, Any]]) -> dict[int, dict[str, Any]]:
    merged: dict[int, dict[str, Any]] = {}
    for r in responses:
        merged.update(r)
    return merged
