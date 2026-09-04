import logging
import uuid
from typing import Any, Dict, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("sentinews.errors")

HTTP_STATUS_CODE_MAP = {
    status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
    status.HTTP_401_UNAUTHORIZED: "UNAUTHORIZED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_409_CONFLICT: "CONFLICT",
    status.HTTP_422_UNPROCESSABLE_ENTITY: "VALIDATION_ERROR",
    status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMITED",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
}


def build_error_envelope(
    code: str,
    message: str,
    request_id: str,
    details: Optional[Any] = None,
) -> Dict[str, Any]:
    envelope: Dict[str, Any] = {
        "code": code,
        "message": message,
        "request_id": request_id,
    }
    if details is not None:
        envelope["details"] = details
    return envelope


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    code = HTTP_STATUS_CODE_MAP.get(exc.status_code, "HTTP_ERROR")
    message = str(exc.detail) if isinstance(exc.detail, str) else "Request processing failed"

    logger.warning(
        f"HTTP {exc.status_code} [{code}] request_id={request_id} path={request.url.path} msg={message}"
    )

    headers = getattr(exc, "headers", None) or {}
    headers["X-Request-ID"] = request_id

    return JSONResponse(
        status_code=exc.status_code,
        content=build_error_envelope(code=code, message=message, request_id=request_id),
        headers=headers,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.info(
        f"Validation Error request_id={request_id} path={request.url.path} errors={exc.errors()}"
    )

    clean_errors = []
    for err in exc.errors():
        clean_errors.append({
            "field": " -> ".join(str(loc) for loc in err.get("loc", [])),
            "issue": err.get("msg", "Invalid parameter"),
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=build_error_envelope(
            code="VALIDATION_ERROR",
            message="Request body or query parameters failed schema validation",
            request_id=request_id,
            details=clean_errors,
        ),
        headers={"X-Request-ID": request_id},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.error(
        f"Unhandled Server Exception request_id={request_id} path={request.url.path} exc={exc}",
        exc_info=True,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=build_error_envelope(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred. Please try again.",
            request_id=request_id,
        ),
        headers={"X-Request-ID": request_id},
    )
