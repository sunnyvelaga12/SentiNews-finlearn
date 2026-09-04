"""
Argon2id Password Storage Primitive — SentiNews Learn V0.4
Centralized, parameter-locked, zero-truncation password hashing service.
"""
from typing import Optional
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from argon2.low_level import Type

# Candidate production operational baseline parameters (OWASP recommended)
DEFAULT_TIME_COST = 3
DEFAULT_MEMORY_COST = 65536  # 64 MiB
DEFAULT_PARALLELISM = 4
DEFAULT_HASH_LEN = 32
DEFAULT_SALT_LEN = 16

# Static pre-computed Argon2id dummy hash with exact same operational cost profile
# Used for constant-time work on non-existent user authentication paths
DUMMY_ARGON2_HASH = "$argon2id$v=19$m=65536,t=3,p=4$4PTMwP/ESAr9BU93eabHwg$syEyJN12DrvWPs0zI6OOk3UmZlOT9Ab6FE0/Tve+pU4"


def get_hasher(
    time_cost: int = DEFAULT_TIME_COST,
    memory_cost: int = DEFAULT_MEMORY_COST,
    parallelism: int = DEFAULT_PARALLELISM,
    hash_len: int = DEFAULT_HASH_LEN,
    salt_len: int = DEFAULT_SALT_LEN,
) -> PasswordHasher:
    """Instantiate a PasswordHasher configured explicitly with Argon2id parameters."""
    return PasswordHasher(
        time_cost=time_cost,
        memory_cost=memory_cost,
        parallelism=parallelism,
        hash_len=hash_len,
        salt_len=salt_len,
        type=Type.ID,
    )


# Singleton hasher instance using locked baseline configuration
_hasher = get_hasher()


def hash_password(password: str) -> str:
    """
    Hash password using Argon2id with strict boundary enforcement.
    Accepts full 8 to 128 character passwords without 72-byte truncation.
    """
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if len(password) > 128:
        raise ValueError("Password must not exceed 128 characters")
    return _hasher.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify plain password against an Argon2id hash.
    Returns False on mismatch, invalid hash format, or empty input.
    """
    if not password or not hashed_password:
        return False
    try:
        return _hasher.verify(hashed_password, password)
    except (VerifyMismatchError, InvalidHashError):
        return False
    except Exception:
        return False


def needs_rehash(hashed_password: str) -> bool:
    """
    Check if a stored hash was generated with older or different parameters
    and requires upgrading on successful authentication.
    """
    if not hashed_password:
        return True
    try:
        return _hasher.check_needs_rehash(hashed_password)
    except Exception:
        return True


def verify_dummy_password(password: str) -> None:
    """
    Execute constant-work Argon2id verification against the static dummy hash.
    Ensures missing user lookups execute identical cryptographic work.
    """
    try:
        _hasher.verify(DUMMY_ARGON2_HASH, password or "dummy_password_fallback")
    except Exception:
        pass
