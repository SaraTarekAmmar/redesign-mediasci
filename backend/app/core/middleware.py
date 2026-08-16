"""
Operation Hub — Request Middleware

Provides:
- Request ID injection (X-Request-ID header)
- Request/response timing
- Access logging
"""

import logging
import time
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger("operation_hub.access")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request with timing and inject X-Request-ID."""

    SKIP_PATHS = {"/api/health", "/api/v1/health", "/docs", "/openapi.json"}

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{duration_ms}ms"

        if request.url.path not in self.SKIP_PATHS:
            logger.info(
                "%s %s — %s | %.1fms | req_id=%s",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
                request_id,
            )

        return response
