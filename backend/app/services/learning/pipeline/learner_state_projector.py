from datetime import datetime, timezone
from uuid import UUID
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import UserProfile


class LearnerStateProjector:
    @staticmethod
    async def project(
        db: AsyncSession,
        user_id: UUID,
        as_of: Optional[datetime] = None,
    ) -> Optional[UserProfile]:
        """
        Projects learner activity into the active user_profiles table.
        Updates last_active_at and calculates streak dynamically without scanning learning_attempts.
        """
        event_time = as_of or datetime.now(timezone.utc)

        # Fetch or create UserProfile row lock
        stmt = (
            select(UserProfile)
            .where(UserProfile.user_id == user_id)
            .with_for_update()
        )
        res = await db.execute(stmt)
        profile: Optional[UserProfile] = res.scalar_one_or_none()

        if profile is None:
            profile = UserProfile(
                user_id=user_id,
                streak_count=1,
                last_active_at=event_time,
            )
            db.add(profile)
        else:
            if profile.last_active_at:
                days_diff = (event_time.date() - profile.last_active_at.date()).days
                if days_diff == 1:
                    profile.streak_count += 1
                elif days_diff > 1:
                    profile.streak_count = 1
                # If days_diff == 0 (same day), maintain current streak
            else:
                profile.streak_count = 1
            profile.last_active_at = event_time

        await db.flush()
        return profile


