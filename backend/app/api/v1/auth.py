import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Header, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.auth import (
    get_password_hash,
    verify_password,
    verify_dummy_password,
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    get_current_user,
)
from app.models.user import User, UserProfile, RefreshSession

router = APIRouter(prefix="/auth", tags=["Authentication"])


def validate_csrf_origin(request: Request) -> None:
    """Validate Origin/Referer and Fetch Metadata headers against allowed origins for state-changing cookie requests."""
    # 1. Fetch Metadata check (Sec-Fetch-Site)
    sec_fetch_site = request.headers.get("sec-fetch-site")
    if sec_fetch_site == "cross-site":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-site request rejected by Fetch Metadata policy",
        )

    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    
    # In non-browser / test environments without origin/referer headers, allow execution
    if not origin and not referer:
        return

    allowed = list(settings.cors_origins) + ["http://testserver", "http://localhost", "http://127.0.0.1"]
    import re

    if origin:
        normalized_origin = origin.rstrip("/")
        is_allowed = any(normalized_origin == a.rstrip("/") or normalized_origin.startswith(a.rstrip("/")) for a in allowed)
        if not is_allowed and re.search(r"^https://([a-zA-Z0-9_-]+\.)*vercel\.app", normalized_origin):
            is_allowed = True
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-origin request rejected: invalid origin header",
            )
    elif referer:
        normalized_ref = referer.rstrip("/")
        is_allowed = any(normalized_ref.startswith(a.rstrip("/")) for a in allowed)
        if not is_allowed and re.search(r"^https://([a-zA-Z0-9_-]+\.)*vercel\.app", normalized_ref):
            is_allowed = True
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-origin request rejected: invalid referer header",
            )


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    display_name: Optional[str] = Field(None, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    email: str
    display_name: Optional[str] = None
    role: str
    streak_count: int = 0
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int  # Seconds
    user: UserProfileResponse


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=AuthResponse,
    summary="Register a new learner account",
)
async def register(
    payload: RegisterRequest,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    validate_csrf_origin(request)

    # 1. Check existing user
    stmt = select(User).where(User.email == payload.email.lower().strip())
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists",
        )

    # 2. Create User and Profile with Argon2id hash
    user = User(
        id=uuid.uuid4(),
        email=payload.email.lower().strip(),
        hashed_password=get_password_hash(payload.password),
        is_active=True,
        is_verified=False,
        role="LEARNER",
    )
    db.add(user)
    await db.flush()

    profile = UserProfile(
        id=uuid.uuid4(),
        user_id=user.id,
        display_name=payload.display_name or payload.email.split("@")[0],
        streak_count=0,
    )
    db.add(profile)

    # 3. Generate tokens & initial RefreshSession family
    access_token, exp_time = create_access_token(user.id, user.email, user.role)
    raw_refresh, hashed_refresh, refresh_exp = generate_refresh_token()
    family_id = uuid.uuid4()

    session_record = RefreshSession(
        id=uuid.uuid4(),
        user_id=user.id,
        family_id=family_id,
        token_hash=hashed_refresh,
        expires_at=refresh_exp,
        revoked_at=None,
        replaced_by=None,
    )
    db.add(session_record)
    await db.commit()

    # 4. Set HttpOnly refresh cookie (Secure in prod, lax in dev)
    is_prod = (settings.ENVIRONMENT == "production")
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )

    return AuthResponse(
        access_token=access_token,
        token_type="Bearer",
        expires_in=15 * 60,
        user=UserProfileResponse(
            id=user.id,
            email=user.email,
            display_name=profile.display_name,
            role=user.role,
            streak_count=profile.streak_count,
            created_at=user.created_at,
        ),
    )


@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    response_model=AuthResponse,
    summary="Authenticate and receive JWT access token",
)
async def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    validate_csrf_origin(request)

    stmt = select(User).where(User.email == payload.email.lower().strip())
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        # Prevent user enumeration side-channel via fixed Argon2id dummy check
        verify_dummy_password(payload.password)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # Get profile
    prof_stmt = select(UserProfile).where(UserProfile.user_id == user.id)
    prof_res = await db.execute(prof_stmt)
    profile = prof_res.scalar_one_or_none()
    display_name = profile.display_name if profile else user.email.split("@")[0]
    streak = profile.streak_count if profile else 0

    # Tokens & RefreshSession family
    access_token, _ = create_access_token(user.id, user.email, user.role)
    raw_refresh, hashed_refresh, refresh_exp = generate_refresh_token()
    family_id = uuid.uuid4()

    session_record = RefreshSession(
        id=uuid.uuid4(),
        user_id=user.id,
        family_id=family_id,
        token_hash=hashed_refresh,
        expires_at=refresh_exp,
        revoked_at=None,
        replaced_by=None,
    )
    db.add(session_record)
    await db.commit()

    is_prod = (settings.ENVIRONMENT == "production")
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )

    return AuthResponse(
        access_token=access_token,
        token_type="Bearer",
        expires_in=15 * 60,
        user=UserProfileResponse(
            id=user.id,
            email=user.email,
            display_name=display_name,
            role=user.role,
            streak_count=streak,
            created_at=user.created_at,
        ),
    )


@router.post(
    "/refresh",
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token and issue new access token under row-level lock",
)
async def refresh_tokens(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    x_refresh_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    validate_csrf_origin(request)

    # Explicit header takes precedence over ambient cookie
    token_to_use = x_refresh_token or refresh_token
    if not token_to_use:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required",
        )

    hashed_input = hash_refresh_token(token_to_use)
    now = datetime.now(timezone.utc)

    # Row-level lock on refresh_session row for atomic concurrency serialization
    stmt = (
        select(RefreshSession)
        .where(RefreshSession.token_hash == hashed_input)
        .with_for_update()
    )
    res = await db.execute(stmt)
    session_row = res.scalar_one_or_none()

    if not session_row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # 1. Replay attack detection: token was already revoked!
    if session_row.revoked_at is not None:
        # Revoke all active sessions belonging to this compromised family
        rev_stmt = (
            update(RefreshSession)
            .where(
                RefreshSession.family_id == session_row.family_id,
                RefreshSession.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
        await db.execute(rev_stmt)
        await db.commit()

        response.delete_cookie(key="refresh_token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    # 2. Expiration check
    if session_row.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # 3. User verification
    user_stmt = select(User).where(User.id == session_row.user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    # 4. Atomic rotation within the SAME family_id
    new_session_id = uuid.uuid4()
    session_row.revoked_at = now
    session_row.replaced_by = new_session_id

    access_token, _ = create_access_token(user.id, user.email, user.role)
    new_raw_refresh, new_hashed_refresh, new_exp = generate_refresh_token()

    new_session = RefreshSession(
        id=new_session_id,
        user_id=user.id,
        family_id=session_row.family_id,
        token_hash=new_hashed_refresh,
        expires_at=new_exp,
        revoked_at=None,
        replaced_by=None,
    )
    db.add(new_session)
    await db.commit()

    is_prod = (settings.ENVIRONMENT == "production")
    response.set_cookie(
        key="refresh_token",
        value=new_raw_refresh,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )

    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 15 * 60,
    }


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Revoke active refresh token session and clear cookie",
)
async def logout(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    x_refresh_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    validate_csrf_origin(request)

    token_to_use = x_refresh_token or refresh_token
    if token_to_use:
        hashed_input = hash_refresh_token(token_to_use)
        stmt = (
            select(RefreshSession)
            .where(RefreshSession.token_hash == hashed_input)
            .with_for_update()
        )
        res = await db.execute(stmt)
        session_row = res.scalar_one_or_none()
        if session_row and session_row.revoked_at is None:
            session_row.revoked_at = datetime.now(timezone.utc)
            await db.commit()

    response.delete_cookie(key="refresh_token")
    return {"message": "Logged out successfully"}


@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
    response_model=UserProfileResponse,
    summary="Get current authenticated user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    prof_stmt = select(UserProfile).where(UserProfile.user_id == current_user.id)
    prof_res = await db.execute(prof_stmt)
    profile = prof_res.scalar_one_or_none()

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        display_name=profile.display_name if profile else current_user.email.split("@")[0],
        role=current_user.role,
        streak_count=profile.streak_count if profile else 0,
        created_at=current_user.created_at,
    )
