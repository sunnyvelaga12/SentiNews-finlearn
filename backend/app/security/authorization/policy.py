"""
Authorization Policy Base Layer — SentiNews Learn V0.4
Defines OWASP-compliant deny-by-default authorization contracts.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession


class DecisionType(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"


class AuthorizationAction(str, Enum):
    CREATE_SESSION = "CREATE_SESSION"
    READ_SESSION = "READ_SESSION"
    SUBMIT_ATTEMPT = "SUBMIT_ATTEMPT"
    UNKNOWN = "UNKNOWN"


@dataclass
class AuthorizationDecision:
    decision: DecisionType
    status_code: int = 403
    error_code: str = "FORBIDDEN"
    message: str = "Access denied by authorization policy"
    context: Optional[Dict[str, Any]] = None

    @property
    def is_allowed(self) -> bool:
        return self.decision == DecisionType.ALLOW

    @classmethod
    def allow(cls, context: Optional[Dict[str, Any]] = None) -> "AuthorizationDecision":
        return cls(decision=DecisionType.ALLOW, status_code=200, message="Authorized", context=context)

    @classmethod
    def deny(
        cls,
        status_code: int = 403,
        error_code: str = "FORBIDDEN",
        message: str = "Access denied",
        context: Optional[Dict[str, Any]] = None
    ) -> "AuthorizationDecision":
        return cls(
            decision=DecisionType.DENY,
            status_code=status_code,
            error_code=error_code,
            message=message,
            context=context
        )

    @classmethod
    def not_found(cls, message: str = "Learning session not found") -> "AuthorizationDecision":
        """Enumeration-resistant 404 denial for non-existent or foreign objects."""
        return cls(
            decision=DecisionType.DENY,
            status_code=404,
            error_code="NOT_FOUND",
            message=message
        )


class BaseAuthorizationPolicy(ABC):
    """Abstract policy interface. Subclasses enforce specific resource invariants."""

    @abstractmethod
    async def evaluate(
        self,
        calling_user_id: Optional[UUID],
        action: AuthorizationAction,
        resource_id: Optional[UUID],
        db: AsyncSession,
        extra: Optional[Dict[str, Any]] = None
    ) -> AuthorizationDecision:
        """Evaluate authorization request. Subclasses MUST default to DENY on unknown branches."""
        pass
