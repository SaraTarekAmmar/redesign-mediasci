"""
Operation Hub — Global Exception Handlers

Register these with the FastAPI app in main.py.
They convert application exceptions into consistent JSON responses.
"""

import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import (
    OperationHubException,
    ValidationException,
)

logger = logging.getLogger("operation_hub")


def _error_response(
    status_code: int,
    error_code: str,
    message: str,
    detail: object = None,
) -> JSONResponse:
    body: dict = {
        "success": False,
        "error_code": error_code,
        "message": message,
    }
    if detail is not None:
        body["detail"] = detail
    return JSONResponse(status_code=status_code, content=body)


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all global exception handlers to the FastAPI application."""

    @app.exception_handler(OperationHubException)
    async def application_exception_handler(
        request: Request, exc: OperationHubException
    ) -> JSONResponse:
        logger.warning(
            "Application exception: %s — %s",
            exc.error_code,
            exc.message,
        )
        return _error_response(
            status_code=exc.status_code,
            error_code=exc.error_code,
            message=exc.message,
            detail=getattr(exc, "errors", None) or getattr(exc, "detail", None),
        )

    @app.exception_handler(ValidationException)
    async def validation_exception_handler(
        request: Request, exc: ValidationException
    ) -> JSONResponse:
        return _error_response(
            status_code=422,
            error_code="VALIDATION_ERROR",
            message="Validation failed.",
            detail={"errors": exc.errors},
        )

    @app.exception_handler(RequestValidationError)
    async def pydantic_validation_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        """Convert Pydantic v2 validation errors into our standard format."""
        errors: dict[str, list[str]] = {}
        for error in exc.errors():
            field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
            errors.setdefault(field, []).append(error["msg"])

        return _error_response(
            status_code=422,
            error_code="VALIDATION_ERROR",
            message="The request data is invalid.",
            detail={"errors": errors},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code_map = {
            400: "BAD_REQUEST",
            401: "UNAUTHENTICATED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            422: "UNPROCESSABLE_ENTITY",
            429: "TOO_MANY_REQUESTS",
            500: "INTERNAL_SERVER_ERROR",
        }
        error_code = code_map.get(exc.status_code, "HTTP_ERROR")
        return _error_response(
            status_code=exc.status_code,
            error_code=error_code,
            message=str(exc.detail),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception("Unhandled exception on %s %s", request.method, request.url)
        return _error_response(
            status_code=500,
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred. Please try again later.",
        )
