import uuid
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("sentinews.middleware")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware that ensures every request has a unique correlation ID (X-Request-ID).
    If incoming request contains valid X-Request-ID, propagates it; otherwise generates a UUID4.
    Attaches request_id to request.state and returns it on the HTTP response headers.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming_request_id = request.headers.get("X-Request-ID")
        if incoming_request_id and len(incoming_request_id) <= 64:
            request_id = incoming_request_id
        else:
            request_id = str(uuid.uuid4())

        request.state.request_id = request_id
        start_time = time.perf_counter()

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = str(duration_ms)

        return response


class SessionAuthorizationMiddleware(BaseHTTPMiddleware):
    """
    Boundary authorization middleware that enforces strict deny-by-default
    policy-based access control outside the frozen learning core (learning.py).
    Delegates all authorization logic to AuthorizationPolicyResolver.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        if not path.startswith("/api/v1/learning"):
            return await call_next(request)

        from starlette.responses import JSONResponse
        from app.core.database import AsyncSessionLocal
        from app.security.authorization import (
            AuthorizationAction,
            global_authorization_resolver,
        )

        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        calling_user_id = global_authorization_resolver.extract_caller_id(request)

        # Propagate authenticated caller user_id to ASGI query string for frozen learning endpoints
        if calling_user_id and request.method == "POST" and "/sessions" in path:
            qs = request.scope.get("query_string", b"").decode("utf-8")
            if "user_id" not in qs:
                new_qs = f"user_id={calling_user_id}" if not qs else f"{qs}&user_id={calling_user_id}"
                request.scope["query_string"] = new_qs.encode("utf-8")

        async with AsyncSessionLocal() as db:
            decision = await global_authorization_resolver.authorize_request(request, db)
            if not decision.is_allowed:
                return JSONResponse(
                    status_code=decision.status_code,
                    content={
                        "code": decision.error_code,
                        "message": decision.message,
                        "request_id": req_id,
                    },
                )

        return await call_next(request)


