import logging
import uuid
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("evoke.errors")


class AppError(Exception):
    """Base class for all domain/application errors with a stable error code.

    Raise this (or a subclass) from application/service code; the exception handler
    registered in `register_error_handlers` turns it into the API's error envelope.
    """

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class AuthRequiredError(AppError):
    def __init__(self, message: str = "Authentication is required.") -> None:
        super().__init__("AUTH_REQUIRED", message, status.HTTP_401_UNAUTHORIZED)


class AuthForbiddenError(AppError):
    def __init__(self, message: str = "You do not have access to this resource.") -> None:
        super().__init__("AUTH_FORBIDDEN", message, status.HTTP_403_FORBIDDEN)


class NotFoundError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code, message, status.HTTP_404_NOT_FOUND)


class ConflictError(AppError):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code, message, status.HTTP_409_CONFLICT, details)


class ValidationFailedError(AppError):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__("VALIDATION_FAILED", message, status.HTTP_422_UNPROCESSABLE_ENTITY, details)


class RequestIdMiddleware:
    """Plain ASGI middleware, not `BaseHTTPMiddleware`.

    `BaseHTTPMiddleware` runs the downstream app in a separate anyio task group,
    which detaches async DB drivers (asyncpg) from the event loop they were opened
    on — a well-known Starlette/asyncpg incompatibility. Raw ASGI avoids it entirely.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        request_id = headers.get(b"x-request-id", b"").decode() or str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                message["headers"] = [
                    *message.get("headers", []),
                    (b"x-request-id", request_id.encode()),
                ]
            await send(message)

        await self.app(scope, receive, send_with_request_id)


def _error_body(code: str, message: str, request_id: str, details: dict[str, Any]) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "requestId": request_id,
            "details": details,
        }
    }


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "unknown")
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(exc.code, exc.message, request_id, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "unknown")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_body(
                "VALIDATION_FAILED",
                "The request payload failed validation.",
                request_id,
                {"errors": exc.errors()},
            ),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "unknown")
        logger.exception("Unhandled exception", extra={"request_id": request_id})
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body(
                "INTERNAL_ERROR", "An unexpected error occurred.", request_id, {}
            ),
        )
