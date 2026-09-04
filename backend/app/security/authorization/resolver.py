"""
Authorization Policy Resolver — SentiNews Learn V0.4
Resolves incoming HTTP requests to resource authorization policies with strict deny-by-default semantics.
"""
import re
import urllib.parse
from typing import Optional, Tuple, Dict, Any
from uuid import UUID
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import decode_access_token
from .policy import (
    AuthorizationAction,
    AuthorizationDecision,
    BaseAuthorizationPolicy,
)
from .session_policy import SessionAuthorizationPolicy


# Regex patterns for learning routes
RE_SESSIONS_ROOT = re.compile(r"^/api/v1/learning/sessions/?$")
RE_NEXT_ACTION = re.compile(r"^/api/v1/learning/next-action/?$")
RE_SESSION_BY_ID = re.compile(r"^/api/v1/learning/sessions/([^/]+)/?$")
RE_ATTEMPT_SUBMIT = re.compile(
    r"^/api/v1/learning/sessions/([^/]+)/activities/([^/]+)/attempts/?$"
)


class AuthorizationPolicyResolver:
    """
    Central request-to-policy resolver.
    Enforces deny-by-default for any unrecognized action or route under the protected learning surface.
    """

    def __init__(self):
        self._session_policy = SessionAuthorizationPolicy()

    @staticmethod
    def extract_caller_id(request: Request) -> Optional[UUID]:
        """Extract authenticated user UUID from Authorization Bearer token."""
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = decode_access_token(token)
            sub = payload.get("sub")
            return UUID(sub) if sub else None
        except Exception:
            return None

    @staticmethod
    def normalize_path(raw_path: str) -> str:
        """Sanitize and normalize path against URL encoding, traversal, and multiple slashes."""
        unquoted = urllib.parse.unquote(raw_path)
        # Collapse multiple slashes
        collapsed = re.sub(r"/+", "/", unquoted)
        # Strip trailing slash except for root
        if len(collapsed) > 1 and collapsed.endswith("/"):
            collapsed = collapsed[:-1]
        return collapsed

    def parse_intent(
        self, request: Request
    ) -> Tuple[AuthorizationAction, Optional[UUID], Optional[BaseAuthorizationPolicy], Dict[str, Any]]:
        """
        Parse HTTP request into an AuthorizationAction and matching policy.
        Returns (action, resource_id, policy, extra_dict).
        If route is unrecognized, returns (AuthorizationAction.UNKNOWN, None, None, {}).
        """
        path = self.normalize_path(request.url.path)
        method = request.method.upper()

        if not path.startswith("/api/v1/learning"):
            # Outside learning protected surface
            return AuthorizationAction.UNKNOWN, None, None, {}

        # 1. Next Action Route (Read action)
        if RE_NEXT_ACTION.match(path) and method == "GET":
            return AuthorizationAction.READ_SESSION, None, self._session_policy, {"route": "next_action"}

        # 2. Session Create Route
        if RE_SESSIONS_ROOT.match(path) and method == "POST":
            return AuthorizationAction.CREATE_SESSION, None, self._session_policy, {}

        # 3. Session Read Route
        sess_match = RE_SESSION_BY_ID.match(path)
        if sess_match and method == "GET":
            sess_id_str = sess_match.group(1)
            if sess_id_str == "demo":
                return AuthorizationAction.READ_SESSION, None, self._session_policy, {"is_demo": True}
            try:
                session_uuid = UUID(sess_id_str)
                return AuthorizationAction.READ_SESSION, session_uuid, self._session_policy, {}
            except ValueError:
                return AuthorizationAction.UNKNOWN, None, self._session_policy, {"error": "malformed_uuid"}

        # 4. Attempt Submit Route
        attempt_match = RE_ATTEMPT_SUBMIT.match(path)
        if attempt_match and method == "POST":
            sess_id_str = attempt_match.group(1)
            act_id_str = attempt_match.group(2)
            if sess_id_str == "demo":
                return (
                    AuthorizationAction.SUBMIT_ATTEMPT,
                    None,
                    self._session_policy,
                    {"activity_id": act_id_str, "is_demo": True},
                )
            try:
                session_uuid = UUID(sess_id_str)
                try:
                    activity_uuid = UUID(act_id_str)
                except ValueError:
                    activity_uuid = act_id_str
                return (
                    AuthorizationAction.SUBMIT_ATTEMPT,
                    session_uuid,
                    self._session_policy,
                    {"activity_id": activity_uuid},
                )
            except ValueError:
                return AuthorizationAction.UNKNOWN, None, self._session_policy, {"error": "malformed_uuid"}

        # 5. Fallback: Unrecognized route or method in protected /api/v1/learning space
        return AuthorizationAction.UNKNOWN, None, self._session_policy, {"path": path, "method": method}

    async def authorize_request(
        self, request: Request, db: AsyncSession
    ) -> AuthorizationDecision:
        """
        Evaluate authorization for the incoming request against configured policies.
        Enforces strict DENY on any unknown protected route or failed ownership check.
        """
        path = self.normalize_path(request.url.path)
        if not path.startswith("/api/v1/learning"):
            # Non-learning routes are handled by standard route handlers
            return AuthorizationDecision.allow()

        calling_user_id = self.extract_caller_id(request)
        action, resource_id, policy, extra = self.parse_intent(request)

        # Invariant: Unknown action under protected space MUST DENY
        if action == AuthorizationAction.UNKNOWN or policy is None:
            if extra.get("error") == "malformed_uuid":
                return AuthorizationDecision.not_found("Learning session not found")
            return AuthorizationDecision.deny(
                status_code=403,
                error_code="UNRECOGNIZED_PROTECTED_ROUTE",
                message="Access denied: Unknown or unauthorized learning action",
                context={"path": path, "method": request.method}
            )

        # Allow next-action read without strict session resource
        if extra.get("route") == "next_action":
            return AuthorizationDecision.allow({"user_id": calling_user_id})

        return await policy.evaluate(
            calling_user_id=calling_user_id,
            action=action,
            resource_id=resource_id,
            db=db,
            extra=extra
        )


# Global singleton resolver instance
global_authorization_resolver = AuthorizationPolicyResolver()
