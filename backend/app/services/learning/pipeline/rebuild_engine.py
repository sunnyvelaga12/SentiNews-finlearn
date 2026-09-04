from typing import Optional, Dict, Any, List
from uuid import UUID
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learning import LearningAttempt
from app.models.progress import ConceptMastery, ReviewItem
from app.services.learning.pipeline.aggregate import LearningConceptAggregate
from app.services.learning.pipeline.domain import CanonicalProjectionState
from app.services.learning.pipeline.learner_state_projector import LearnerStateProjector
from app.services.learning.pipeline.projection_pipeline import ProjectionPipeline
from app.services.learning.pipeline.review_scheduler import ReviewSchedulingPolicy
from app.services.learning.mastery_config import compute_mastery_level



class LearnerStateRebuilder:
    """
    Deterministic Evidence Rebuild Engine — Contracts v3 (Gate 6).
    Deletes derived domain projections (concept_mastery, review_items)
    and replays immutable LearningAttempt rows in aggregate-scoped sequence order.
    """

    @staticmethod
    async def rebuild_for_user(
        db: AsyncSession,
        user_id: UUID,
        policy: Optional[ReviewSchedulingPolicy] = None,
    ) -> Any:
        """
        Full rebuild for a single user.

        Replay order (Gate 6):
        1. Find all distinct concepts attempted by user.
        2. Clear derived projections.
        3. For each concept (sorted by concept_id):
           Replay attempts in aggregate_sequence ASC order.
        4. Run LearnerStateProjector ONCE after all aggregates are rebuilt.
        """
        # 1. Find distinct concept_ids for user
        stmt_concepts = (
            select(LearningAttempt.concept_id)
            .where(LearningAttempt.user_id == user_id)
            .distinct()
        )
        c_res = await db.execute(stmt_concepts)
        concept_ids = sorted(list(c_res.scalars().all()))

        # 2. Delete derived domain projections
        await db.execute(delete(ConceptMastery).where(ConceptMastery.user_id == user_id))
        await db.execute(delete(ReviewItem).where(ReviewItem.user_id == user_id))
        await db.flush()

        # 3. If user has no attempts, project empty LearnerState cleanly (no dummy hack)
        if not concept_ids:
            state = await LearnerStateProjector.project(db, user_id)
            await db.flush()
            return state

        # 4. Replay per aggregate in sorted concept_id order (A3) and aggregate_sequence ASC (A4)
        latest_timestamp = None
        for concept_id in concept_ids:
            # Acquire aggregate lock
            aggs = await LearningConceptAggregate.acquire(db, user_id, [concept_id])
            aggregate = aggs[concept_id]

            # Fetch attempts for this (user_id, concept_id) ordered by aggregate_sequence
            stmt_attempts = (
                select(LearningAttempt)
                .where(
                    LearningAttempt.user_id == user_id,
                    LearningAttempt.concept_id == concept_id,
                )
                .order_by(
                    LearningAttempt.aggregate_sequence.asc().nulls_last(),
                    LearningAttempt.attempted_at.asc(),
                    LearningAttempt.id.asc(),
                )
            )
            res = await db.execute(stmt_attempts)
            attempts = list(res.scalars().all())

            for attempt in attempts:
                ts = attempt.received_at or attempt.attempted_at
                if latest_timestamp is None or ts > latest_timestamp:
                    latest_timestamp = ts

                await ProjectionPipeline.apply(
                    db,
                    attempt,
                    aggregate=aggregate,
                    policy=policy,
                    project_learner_state=False,  # Skip per-attempt learner_state rebuild
                )

        # 5. Project learner_state ONCE after all aggregates are rebuilt
        final_state = await LearnerStateProjector.project(db, user_id, as_of=latest_timestamp)
        await db.flush()
        return final_state

    @staticmethod
    async def extract_canonical_state(
        db: AsyncSession,
        user_id: UUID,
        concept_id: UUID,
    ) -> Optional[CanonicalProjectionState]:
        """
        Extracts semantic projection snapshot for deterministic comparison (A7).
        Excludes updated_at, rebuilt_at, and transaction metadata.
        """
        mastery_res = await db.execute(
            select(ConceptMastery).where(
                ConceptMastery.user_id == user_id,
                ConceptMastery.concept_id == concept_id,
            )
        )
        mastery = mastery_res.scalar_one_or_none()
        if not mastery:
            return None

        review_res = await db.execute(
            select(ReviewItem).where(
                ReviewItem.user_id == user_id,
                ReviewItem.concept_id == concept_id,
            )
        )
        review = review_res.scalar_one_or_none()

        next_review_iso = (
            review.next_review_at.isoformat() if review and review.next_review_at else ""
        )

        return CanonicalProjectionState(
            mastery_score=mastery.mastery_score,
            mastery_level=compute_mastery_level(mastery),
            correct_count=mastery.correct_count,
            incorrect_count=mastery.incorrect_count,
            lapse_count=mastery.lapse_count,
            active_recall_successes=mastery.active_recall_successes,
            delayed_recall_successes=mastery.delayed_recall_successes,
            review_stage=review.review_stage if review else 0,
            review_next_at_iso=next_review_iso,
        )

    @staticmethod
    async def rebuild_scope(
        db: AsyncSession,
        user_id: Optional[UUID] = None,
        concept_id: Optional[UUID] = None,
        algorithm_version: Optional[int] = None,
        policy: Optional[ReviewSchedulingPolicy] = None,
    ) -> List[UUID]:
        if user_id:
            await LearnerStateRebuilder.rebuild_for_user(db, user_id, policy=policy)
            return [user_id]

        stmt = select(LearningAttempt.user_id).distinct()
        if concept_id:
            stmt = stmt.where(LearningAttempt.concept_id == concept_id)
        res = await db.execute(stmt)
        user_ids = list(res.scalars().all())

        for u_id in user_ids:
            await LearnerStateRebuilder.rebuild_for_user(db, u_id, policy=policy)

        return user_ids

