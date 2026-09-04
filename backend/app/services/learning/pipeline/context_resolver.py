from datetime import datetime, timezone
from uuid import UUID
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.learning import LearningAttempt
from app.models.progress import ReviewItem
from app.services.learning.pipeline.domain import LearningContext


class LearningContextResolver:
    @staticmethod
    async def resolve(
        db: AsyncSession,
        user_id: UUID,
        concept_id: UUID,
        objective_id: UUID,
    ) -> LearningContext:
        """
        Resolves learning context from DB without locking.
        Required for evidence classification (e.g. active recall vs delayed recall).
        """
        # 1. Fetch ReviewItem if present
        review_stmt = select(ReviewItem).where(
            ReviewItem.user_id == user_id,
            ReviewItem.concept_id == concept_id,
        )
        review_result = await db.execute(review_stmt)
        review_item: Optional[ReviewItem] = review_result.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        is_review = False
        days_since_last_correct: Optional[float] = None
        current_review_stage = 0

        if review_item:
            current_review_stage = review_item.review_stage
            # Check if this item is due for review
            if review_item.next_review_at and review_item.next_review_at <= now:
                is_review = True

            if review_item.last_reviewed_at:
                delta = (now - review_item.last_reviewed_at).total_seconds()
                days_since_last_correct = max(0.0, delta / 86400.0)

        # 2. Fetch attempt count for this concept
        attempt_count_stmt = select(func.count(LearningAttempt.id)).where(
            LearningAttempt.user_id == user_id,
            LearningAttempt.concept_id == concept_id,
        )
        attempt_count_res = await db.execute(attempt_count_stmt)
        prev_attempts = attempt_count_res.scalar() or 0
        attempt_number = prev_attempts + 1

        return LearningContext(
            is_review=is_review,
            days_since_last_correct=days_since_last_correct,
            attempt_number=attempt_number,
            current_review_stage=current_review_stage,
        )
