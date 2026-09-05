import logging
import uuid
from datetime import datetime, timezone
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.api.v1.auth import router as auth_router
from app.api.v1.curriculum import router as curriculum_router
from app.api.v1.concepts import router as concepts_router
from app.api.v1.lessons import router as lessons_router
from app.api.v1.diagnostic import router as diagnostic_router
from app.api.v1.mastery import router as mastery_router
from app.api.v1.review import router as review_router
from app.api.v1.admin import router as admin_router
from app.api.v1.seo import router as seo_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentinews_learn")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs"
)

# GZip Compression for payloads >= 1000 bytes
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.core.middleware import SessionAuthorizationMiddleware

# Boundary IDOR Session Authorization Middleware
app.add_middleware(SessionAuthorizationMiddleware)

from app.core.rate_limit import get_rate_limit_store, get_client_ip

# Rate limiting config for endpoints
RATE_LIMITS = {
    "/api/v1/auth/login": (10, 60),       # 10 requests per 60s
    "/api/v1/auth/register": (5, 60),     # 5 requests per 60s
    "/api/v1/auth/refresh": (30, 60),     # 30 requests per 60s
    "/api/v1/telemetry/events": (120, 60),# 120 requests per 60s
}

# Request ID & Logging Middleware
@app.middleware("http")
async def request_id_and_logging_middleware(request: Request, call_next):
    # Validate incoming X-Request-ID or generate UUIDv4
    client_req_id = request.headers.get("X-Request-ID")
    if client_req_id:
        try:
            request_id = str(uuid.UUID(client_req_id))
        except ValueError:
            request_id = str(uuid.uuid4())
    else:
        request_id = str(uuid.uuid4())

    request.state.request_id = request_id

    # Rate Limiting Check (bypassed in testclient / test suite)
    path = request.url.path
    client_ip = get_client_ip(request)
    if path in RATE_LIMITS and client_ip not in ("testclient", "unknown", "127.0.0.1", "localhost"):
        max_reqs, window_sec = RATE_LIMITS[path]
        rate_key = f"endpoint:{path}:{client_ip}"
        store = get_rate_limit_store()
        allowed, remaining, retry_after = await store.is_allowed(rate_key, max_reqs, window_sec)
        
        if not allowed:
            logger.warning(f"Rate limit exceeded for key={rate_key} req_id={request_id}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "code": "RATE_LIMITED",
                    "message": "Too many requests. Please try again later.",
                    "request_id": request_id,
                },
                headers={"X-Request-ID": request_id, "Retry-After": str(retry_after)},
            )

    start_time = datetime.now(timezone.utc)
    response = await call_next(request)
    process_time_ms = round((datetime.now(timezone.utc) - start_time).total_seconds() * 1000, 2)

    response.headers["X-Request-ID"] = request_id
    logger.info(
        f"req_id={request_id} method={request.method} path={request.url.path} status={response.status_code} duration_ms={process_time_ms}"
    )
    return response

# Liveness Health Check
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "UP",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT
    }

# Readiness Health Check (Verifies PostgreSQL Connection)
@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {
            "status": "READY",
            "database": "CONNECTED",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Readiness DB check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "NOT_READY",
                "database": "DISCONNECTED",
                "error": str(e)
            }
        )

from app.api.v1.learning import router as learning_router
from app.api.v1.telemetry import router as telemetry_router
from app.api.v1.learner import router as learner_router
from app.core.errors import (
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

# Register Standard Error Handlers
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Mount REST API Router v1
api_v1_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_v1_prefix)
app.include_router(telemetry_router, prefix=api_v1_prefix)
app.include_router(learner_router, prefix=api_v1_prefix)
app.include_router(learning_router, prefix=f"{api_v1_prefix}/learning", tags=["Learning Engine"])
app.include_router(curriculum_router, prefix=api_v1_prefix, tags=["Curriculum"])
app.include_router(concepts_router, prefix=api_v1_prefix, tags=["Concepts"])
app.include_router(lessons_router, prefix=api_v1_prefix, tags=["Lessons"])
app.include_router(diagnostic_router, prefix=api_v1_prefix, tags=["Diagnostic"])
app.include_router(mastery_router, prefix=api_v1_prefix, tags=["Mastery"])
app.include_router(review_router, prefix=api_v1_prefix, tags=["Review"])
app.include_router(admin_router, prefix=api_v1_prefix, tags=["Admin"])
app.include_router(seo_router, prefix=api_v1_prefix, tags=["SEO"])

import os
from fastapi.staticfiles import StaticFiles

_uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../uploads"))
os.makedirs(os.path.join(_uploads_dir, "media"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")
