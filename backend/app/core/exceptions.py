"""
Operation Hub — Core Exceptions

All custom application exceptions live here.
Routers raise these; the global handler in core/handlers.py converts them to HTTP responses.
"""

from typing import Any


class OperationHubException(Exception):
    """Base class for all application exceptions."""
    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None, detail: Any = None):
        self.message = message or self.__class__.message
        self.detail = detail
        super().__init__(self.message)


# ── 400 Bad Request ──────────────────────────────────────────────────────────

class BadRequestException(OperationHubException):
    status_code = 400
    error_code = "BAD_REQUEST"
    message = "Bad request."


class ValidationException(OperationHubException):
    status_code = 422
    error_code = "VALIDATION_ERROR"
    message = "Validation failed."

    def __init__(self, errors: dict[str, list[str]]):
        self.errors = errors
        super().__init__(message="Validation failed.", detail=errors)


# ── 401 Unauthorized ─────────────────────────────────────────────────────────

class AuthenticationException(OperationHubException):
    status_code = 401
    error_code = "UNAUTHENTICATED"
    message = "Authentication required."


class InvalidCredentialsException(AuthenticationException):
    error_code = "INVALID_CREDENTIALS"
    message = "The provided credentials are incorrect."


class TokenExpiredException(AuthenticationException):
    error_code = "TOKEN_EXPIRED"
    message = "Your session has expired. Please log in again."


# ── 403 Forbidden ────────────────────────────────────────────────────────────

class ForbiddenException(OperationHubException):
    status_code = 403
    error_code = "FORBIDDEN"
    message = "You do not have permission to perform this action."


class InsufficientPermissionsException(ForbiddenException):
    error_code = "INSUFFICIENT_PERMISSIONS"

    def __init__(self, required: str | list[str] | None = None):
        msg = "Insufficient permissions."
        if required:
            perms = [required] if isinstance(required, str) else required
            msg = f"Requires permission: {', '.join(perms)}"
        super().__init__(message=msg)


class InsufficientRoleException(ForbiddenException):
    error_code = "INSUFFICIENT_ROLE"

    def __init__(self, required: str | list[str] | None = None):
        msg = "Insufficient role."
        if required:
            roles = [required] if isinstance(required, str) else required
            msg = f"Requires role: {', '.join(roles)}"
        super().__init__(message=msg)


# ── 404 Not Found ─────────────────────────────────────────────────────────────

class NotFoundException(OperationHubException):
    status_code = 404
    error_code = "NOT_FOUND"
    message = "Resource not found."

    def __init__(self, resource: str = "Resource", id: int | str | None = None):
        msg = f"{resource} not found."
        if id is not None:
            msg = f"{resource} with id={id} not found."
        super().__init__(message=msg)


# ── 409 Conflict ──────────────────────────────────────────────────────────────

class ConflictException(OperationHubException):
    status_code = 409
    error_code = "CONFLICT"
    message = "Resource already exists."


class DuplicateEmailException(ConflictException):
    error_code = "DUPLICATE_EMAIL"
    message = "A user with this email already exists."


# ── 422 Business Logic ────────────────────────────────────────────────────────

class BusinessRuleException(OperationHubException):
    status_code = 422
    error_code = "BUSINESS_RULE_VIOLATION"
    message = "This operation violates a business rule."


class PasswordMismatchException(BusinessRuleException):
    error_code = "PASSWORD_MISMATCH"
    message = "The password confirmation does not match."
