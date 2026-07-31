import logging
import time
import uuid
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        start = time.monotonic()
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        logging.getLogger("career-os.access").info(
            "%s %s %s %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            (time.monotonic() - start) * 1000,
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 120) -> None:
        super().__init__(app)
        self.limit = requests_per_minute
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        bucket = self.hits[client]
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= self.limit:
            return JSONResponse(
                status_code=429,
                content={"error": {"code": "RATE_LIMITED", "message": "Too many requests"}},
            )
        bucket.append(now)
        return await call_next(request)
