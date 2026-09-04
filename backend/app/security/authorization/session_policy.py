"""
Session Authorization Policy — SentiNews Learn V0.4
Enforces strict anti-IDOR isolation and side-channel equivalence for learning sessions.
"""
from typing import Any, Dict, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learning import LearningSession, LearningSessionItem
from .policy import (
    AuthorizationAction,
    AuthorizationDecision,
    BaseAuthorizationPolicy,
)


DEFAULT_DEMO_USER_ID = UUID("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")


class SessionAuthorizationPolicy(BaseAuthorizationPolicy):
    """
    Evaluates learning session object permissions.
    Enforces deny-by-default and enumeration-resistant 404 side-channel equivalence.
    """

    async def evaluate(
        self,
        calling_user_id: Optional[UUID],
        action: AuthorizationAction,
        resource_id: Optional[UUID],
        db: AsyncSession,
        extra: Optional[Dict[str, Any]] = None
    ) -> AuthorizationDecision:
        extra = extra or {}

        # 1. Action: CREATE_SESSION
        if action == AuthorizationAction.CREATE_SESSION:
            # Creation is allowed for authenticated users or demo fallback
            return AuthorizationDecision.allow({"user_id": calling_user_id})

        # 2. Action: READ_SESSION
        if action == AuthorizationAction.READ_SESSION:
            if extra.get("is_demo"):
                return AuthorizationDecision.allow({"user_id": None, "session": None})
            if not resource_id:
                return AuthorizationDecision.not_found("Learning session not found")

            stmt = select(LearningSession).where(LearningSession.id == resource_id)
            if calling_user_id:
                stmt = stmt.where(
                    (LearningSession.user_id == calling_user_id) | (LearningSession.user_id == DEFAULT_DEMO_USER_ID)
                )
            else:
                stmt = stmt.where(LearningSession.user_id == DEFAULT_DEMO_USER_ID)

            res = await db.execute(stmt)
            session = res.scalar_one_or_none()

            if not session:
                return AuthorizationDecision.not_found("Learning session not found")

            return AuthorizationDecision.allow({"session": session, "user_id": session.user_id})

        # 3. Action: SUBMIT_ATTEMPT
        if action == AuthorizationAction.SUBMIT_ATTEMPT:
            if extra.get("is_demo"):
                return AuthorizationDecision.allow({"user_id": None, "session": None})
            if not resource_id:
                return AuthorizationDecision.not_found("Learning session not found")

            activity_id = extra.get("activity_id")
            if not activity_id:
                return AuthorizationDecision.deny(400, "BAD_REQUEST", "Activity ID required for attempt submission")

            stmt = select(LearningSession).where(LearningSession.id == resource_id)
            if calling_user_id:
                stmt = stmt.where(
                    (LearningSession.user_id == calling_user_id) | (LearningSession.user_id == DEFAULT_DEMO_USER_ID)
                )
            else:
                stmt = stmt.where(LearningSession.user_id == DEFAULT_DEMO_USER_ID)

            res = await db.execute(stmt)
            session = res.scalar_one_or_none()

            if not session:
                return AuthorizationDecision.not_found("Learning session not found")

            if session.status != "ACTIVE":
                return AuthorizationDecision.deny(400, "SESSION_INACTIVE", "Learning session is no longer active")

            # Validate session item
            item_stmt = select(LearningSessionItem).where(
                LearningSessionItem.session_id == resource_id,
                LearningSessionItem.activity_id == activity_id
            )
            item_res = await db.execute(item_stmt)
            item = item_res.scalar_one_or_none()

            if not item:
                return AuthorizationDecision.not_found("Activity not found in active session")

            if item.status == "COMPLETED":
                return AuthorizationDecision.deny(400, "ALREADY_COMPLETED", "Activity already completed")

            return AuthorizationDecision.allow({
                "session": session,
                "item": item,
                "user_id": session.user_id,
                "activity_id": activity_id
            })

        # 4. Fallback: Strict Deny-by-Default
        return AuthorizationDecision.deny(
            status_code=403,
            error_code="UNAUTHORIZED_ACTION",
            message=f"Action '{action}' is denied by session policy"
        )
