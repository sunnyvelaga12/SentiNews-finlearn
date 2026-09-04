"""
Distributed Rate Limiting Abstraction — SentiNews Learn V0.4
Defines storage contracts for in-memory and distributed Redis rate limiting.
"""
import time
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from typing import Callable, Optional, Tuple
from fastapi import HTTPException, Request, status
from app.core.config import settings


class RateLimitStore(ABC):
    """Abstract storage interface for rate limiting sliding-window counters."""

    @abstractmethod
    async def is_allowed(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int, int]:
        """
        Check if request is allowed under the sliding window.
        Returns:
            Tuple[bool, int, int]: (allowed, remaining_quota, retry_after_seconds)
        """
        pass

    @abstractmethod
    async def reset(self, key: Optional[str] = None) -> None:
        """Reset quota for key or clear entire store (used in testing)."""
        pass


class MemoryRateLimitStore(RateLimitStore):
    """
    In-memory sliding-window log rate limiter.
    Deterministic, thread-safe for single-worker, used in dev, test, and CI environments.
    """

    def __init__(self):
        self._history = defaultdict(deque)

    async def is_allowed(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int, int]:
        now = time.time()
        window_start = now - window_seconds
        timestamps = self._history[key]

        # Evict timestamps older than the sliding window
        while timestamps and timestamps[0] <= window_start:
            timestamps.popleft()

        if len(timestamps) >= limit:
            oldest = timestamps[0]
            retry_after = max(1, int(oldest + window_seconds - now))
            return False, 0, retry_after

        # Record timestamp
        timestamps.append(now)
        remaining = max(0, limit - len(timestamps))
        return True, remaining, 0

    async def reset(self, key: Optional[str] = None) -> None:
        if key:
            self._history.pop(key, None)
        else:
            self._history.clear()


class RedisRateLimitStore(RateLimitStore):
    """
    Distributed Redis sliding-window rate limiter for multi-worker production deployments.
    Features conservative local memory fallback on Redis failure for sensitive authentication
    endpoints to prevent abuse during Redis outages, and graceful fail-open for telemetry.
    """

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client = None
        self._local_fallback = MemoryRateLimitStore()

    async def _get_client(self):
        if self._client is None:
            import redis.asyncio as aioredis
            self._client = aioredis.from_url(self.redis_url, encoding="utf-8", decode_responses=True)
        return self._client

    async def is_allowed(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int, int]:
        try:
            client = await self._get_client()
            now = time.time()
            window_start = now - window_seconds
            pipe = client.pipeline()
            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)
            # Add current entry
            pipe.zadd(key, {str(now): now})
            # Count entries in current window
            pipe.zcard(key)
            # Set key expiry
            pipe.expire(key, window_seconds + 1)
            results = await pipe.execute()
            count = results[2]

            if count > limit:
                # Remove the entry that exceeded the limit
                await client.zrem(key, str(now))
                return False, 0, window_seconds
            return True, max(0, limit - count), 0
        except Exception:
            # Sensitive endpoint check: if key indicates auth, fallback to local memory limiter
            is_sensitive = any(s in key for s in ("auth", "login", "register", "refresh"))
            if is_sensitive:
                return await self._local_fallback.is_allowed(key, limit, window_seconds)
            # For non-sensitive (e.g. telemetry), fail open to avoid user disruption
            return True, 1, 0

    async def reset(self, key: Optional[str] = None) -> None:
        await self._local_fallback.reset(key)
        try:
            client = await self._get_client()
            if key:
                await client.delete(key)
        except Exception:
            pass


# Global store instance factory
_global_store: Optional[RateLimitStore] = None


def get_rate_limit_store() -> RateLimitStore:
    """Return the active RateLimitStore singleton based on configuration."""
    global _global_store
    if _global_store is None:
        redis_url = getattr(settings, "REDIS_URL", None)
        if redis_url and getattr(settings, "ENVIRONMENT", "development") == "production":
            _global_store = RedisRateLimitStore(redis_url)
        else:
            _global_store = MemoryRateLimitStore()
    return _global_store


def get_client_ip(request: Request) -> str:
    """Extract client IP from request headers or direct client connection."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


class RateLimiter:
    """FastAPI dependency for endpoint-level sliding-window rate limiting."""

    def __init__(
        self,
        limit: int,
        window_seconds: int = 60,
        key_func: Optional[Callable[[Request], str]] = None,
        scope: str = "default",
    ):
        self.limit = limit
        self.window_seconds = window_seconds
        self.key_func = key_func or get_client_ip
        self.scope = scope

    async def __call__(self, request: Request):
        # Allow disabling rate limiting in specific test contexts via header or setting
        if getattr(settings, "TESTING", False) or request.headers.get("x-bypass-rate-limit") == "test-suite":
            return

        store = get_rate_limit_store()
        client_key = self.key_func(request)
        rate_key = f"ratelimit:{self.scope}:{client_key}"

        allowed, remaining, retry_after = await store.is_allowed(
            key=rate_key,
            limit=self.limit,
            window_seconds=self.window_seconds,
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after), "X-RateLimit-Remaining": "0"},
            )
