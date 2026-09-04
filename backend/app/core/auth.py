import os
import uuid
import secrets
import hashlib
from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, RefreshSession
from app.core.security import (
    hash_password,
    verify_password,
    needs_rehash,
    verify_dummy_password,
    DUMMY_ARGON2_HASH,
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    decode_access_token,
    get_password_hash,
)

security_bearer = HTTPBearer(auto_error=False)
DEFAULT_DEMO_USER_ID = uuid.UUID("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")


async def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve authenticated user identity from Bearer token, with demo fallback for dev mode."""
    if not auth or not auth.credentials:
        # Dev fallback: resolve seeded demo user
        stmt = select(User).where(User.id == DEFAULT_DEMO_USER_ID)
        res = await db.execute(stmt)
        demo_user = res.scalar_one_or_none()
        if demo_user and demo_user.is_active:
            return demo_user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(auth.credentials)
    user_id_str: str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed user ID in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(User).where(User.id == user_uuid)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    return user


async def get_optional_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Resolve user if Bearer token present, otherwise return None."""
    if not auth or not auth.credentials:
        return None
    try:
        return await get_current_user(auth, db)
    except HTTPException:
        return None


__all__ = [
    "get_current_user",
    "get_optional_current_user",
    "create_access_token",
    "generate_refresh_token",
    "hash_refresh_token",
    "decode_access_token",
    "get_password_hash",
    "hash_password",
    "verify_password",
    "needs_rehash",
    "verify_dummy_password",
    "DEFAULT_DEMO_USER_ID",
]
