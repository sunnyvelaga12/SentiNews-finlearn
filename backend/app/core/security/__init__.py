"""
Security primitives package — SentiNews Learn V0.4
Canonical unidirectional implementation of JWT tokens, Argon2id passwords, and CSRF protection.
"""
import uuid
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, List
from fastapi import HTTPException, Request, status
from jose import JWTError, jwt
from app.core.config import settings
from app.core.security.passwords import (
    hash_password,
    verify_password,
    needs_rehash,
    verify_dummy_password,
    DEFAULT_TIME_COST,
    DEFAULT_MEMORY_COST,
    DEFAULT_PARALLELISM,
    DUMMY_ARGON2_HASH,
)

ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES  # 15 min
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS      # 7 days


def hash_token(token: str) -> str:
    """Compute SHA-256 hash of opaque token string for database storage."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def get_password_hash(password: str) -> str:
    """Hash password using centralized Argon2id primitive."""
    return hash_password(password)


def create_access_token(user_id: uuid.UUID | str, email: str = "", role: str = "LEARNER") -> Tuple[str, datetime]:
    """Generate signed JWT access token with iat and exp claims."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "type": "access",
    }
    encoded_jwt = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt, expires_at


def generate_refresh_token() -> Tuple[str, str, datetime]:
    """Generate opaque random refresh token, its SHA-256 hash for storage, and expiry."""
    raw_token = secrets.token_urlsafe(64)
    hashed_token = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, hashed_token, expires_at


def hash_refresh_token(raw_token: str) -> str:
    """Hash an incoming raw refresh token for database lookup."""
    return hash_token(raw_token)


def create_step_up_token(user_id: str) -> str:
    expires_delta = timedelta(minutes=settings.STEP_UP_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {
        "sub": str(user_id),
        "type": "step_up",
        "jti": secrets.token_hex(16),
        "exp": expire
    }
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate signed JWT access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type: expected access token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_jwt_token(token: str, expected_type: str = "access") -> dict:
    """Legacy compatibility facade over decode_access_token."""
    payload = decode_access_token(token)
    token_type = payload.get("type")
    if expected_type and token_type != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token type. Expected {expected_type}."
        )
    return payload


import re

DEFAULT_ADMIN_USER_ID = uuid.UUID("b0370776-dcc9-449a-8bbb-b4d0cf9e9494")


def resolve_admin_context(
    request: Request,
    allowed_roles: Optional[List[str]] = None
) -> Tuple[uuid.UUID, str]:
    """
    Authoritative Admin Context Resolver for Content Studio & Curriculum APIs.
    1. Checks Authorization header for valid Bearer JWT.
    2. If missing or studio session, checks X-Admin-Role header or defaults to SUPER_ADMIN with DEFAULT_ADMIN_USER_ID.
    3. Enforces allowed_roles boundary check.
    """
    if allowed_roles is None:
        allowed_roles = ["CONTENT_EDITOR", "SUPER_ADMIN", "ADMIN"]

    auth_header = request.headers.get("authorization")
    role_header = request.headers.get("x-admin-role")

    actor_id: uuid.UUID = DEFAULT_ADMIN_USER_ID
    actor_role: str = "SUPER_ADMIN"

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = verify_jwt_token(token)
            actor_id = uuid.UUID(payload["sub"])
            actor_role = payload.get("role", "LEARNER")
        except Exception:
            if role_header:
                actor_role = role_header
            actor_id = DEFAULT_ADMIN_USER_ID
    elif role_header:
        actor_role = role_header
        actor_id = DEFAULT_ADMIN_USER_ID
    else:
        actor_role = "SUPER_ADMIN"
        actor_id = DEFAULT_ADMIN_USER_ID

    if allowed_roles and actor_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"FORBIDDEN_ROLE: Requires one of {allowed_roles}, but caller has '{actor_role}'."
        )

    return actor_id, actor_role


def validate_origin_and_csrf(request: Request, csrf_token_header: Optional[str] = None):
    # Only validate on state-changing methods
    if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
        origin = request.headers.get("origin") or request.headers.get("referer")
        if origin:
            allowed = any(origin.startswith(allowed_origin) for allowed_origin in settings.cors_origins)
            if not allowed:
                # Dynamic support for Vercel production and preview domains
                if re.search(r"^https://([a-zA-Z0-9_-]+\.)*vercel\.app", origin):
                    allowed = True
            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Origin or Referer domain header validation failed."
                )
        
        if not csrf_token_header:
            csrf_token_header = request.headers.get("x-csrf-token")
        if not csrf_token_header:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing X-CSRF-Token header on state-changing request."
            )


__all__ = [
    "hash_password",
    "verify_password",
    "needs_rehash",
    "verify_dummy_password",
    "get_password_hash",
    "hash_token",
    "create_access_token",
    "generate_refresh_token",
    "hash_refresh_token",
    "create_step_up_token",
    "decode_access_token",
    "verify_jwt_token",
    "validate_origin_and_csrf",
    "resolve_admin_context",
    "DEFAULT_ADMIN_USER_ID",
    "DEFAULT_TIME_COST",
    "DEFAULT_MEMORY_COST",
    "DEFAULT_PARALLELISM",
    "DUMMY_ARGON2_HASH",
]

