from typing import Dict, Any, Optional
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.learning import LearningActivity
from app.models.concept import Concept
from app.models.progress import ReviewItem, ConceptMastery

class NextActionEngine:
    """Evaluates learner state and returns the optimal next action recommendation without side-effects."""

    @staticmethod
    async def recommend_next_action(db: AsyncSession, user_id: UUID) -> Dict[str, Any]:
        # 1. Check active due review items
        now = datetime.now(timezone.utc)
        due_reviews_query = await db.execute(
            select(func.count(ReviewItem.id)).where(
                ReviewItem.user_id == user_id,
                ReviewItem.next_review_at <= now,
            )
        )
        due_review_count = due_reviews_query.scalar() or 0

        # 2. Check latest active concept from ConceptMastery
        mastery_res = await db.execute(
            select(ConceptMastery.concept_id)
            .where(ConceptMastery.user_id == user_id)
            .order_by(ConceptMastery.last_evaluated_at.desc())
            .limit(1)
        )
        last_concept_id = mastery_res.scalar_one_or_none()

        # 3. Determine Session Policy & Action Type
        action_type = "START_SESSION"
        target_concept = None

        if due_review_count >= 1:
            policy = "CRITICAL_REVIEW"
            action_type = "REVIEW"
            reason = f"You have {due_review_count} review item{'s' if due_review_count > 1 else ''} due for active recall."

            # Target the specific overdue concept
            due_item_res = await db.execute(
                select(ReviewItem).where(
                    ReviewItem.user_id == user_id,
                    ReviewItem.next_review_at <= now,
                ).order_by(ReviewItem.next_review_at.asc()).limit(1)
            )
            due_item = due_item_res.scalar_one_or_none()
            if due_item:
                concept_res = await db.execute(
                    select(Concept).where(Concept.id == due_item.concept_id)
                )
                target_concept = concept_res.scalar_one_or_none()
        elif not last_concept_id:
            policy = "NEW_LEARNER"
            reason = "Welcome! Let's start your financial intelligence journey."
        else:
            policy = "DEFAULT"
            reason = "Ready for your next bite-sized learning session."

        # 4. Fetch candidate concept if not already set by due review
        if not target_concept and last_concept_id:
            concept_res = await db.execute(
                select(Concept).where(Concept.id == last_concept_id)
            )
            target_concept = concept_res.scalar_one_or_none()

        if not target_concept:
            # Fallback to first available published concept (e.g. Inflation)
            fallback_res = await db.execute(
                select(Concept).where(Concept.status == "PUBLISHED").order_by(Concept.created_at.asc()).limit(1)
            )
            target_concept = fallback_res.scalar_one_or_none()

        curiosity_title = getattr(target_concept, "description", None) or (target_concept.title if target_concept else "Financial Intelligence")
        if target_concept and target_concept.slug == "inflation":
            curiosity_title = "Why ₹100 quietly loses buying power even when you don't spend it."

        return {
            "action_type": action_type,
            "policy": policy,
            "reason": reason,
            "target_concept": {
                "id": str(target_concept.id) if target_concept else None,
                "slug": target_concept.slug if target_concept else "inflation",
                "title": target_concept.title if target_concept else "Inflation",
                "curiosity_title": curiosity_title,
            } if target_concept else None,
            "due_review_count": due_review_count,
            "estimated_minutes": 4
        }
