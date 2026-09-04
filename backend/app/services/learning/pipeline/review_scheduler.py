from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.progress import ReviewItem
from app.services.learning.pipeline.domain import LearningEvidence

STAGE_INTERVALS = {
    1: 1,
    2: 3,
    3: 7,
    4: 14,
    5: 30,
}


@dataclass(frozen=True)
class ReviewState:
    stage: int
    stability_days: float
    difficulty_score: float
    lapses: int


@dataclass(frozen=True)
class SchedulingInput:
    review_state: Optional[ReviewState]
    evidence: LearningEvidence
    attempted_at: datetime


@dataclass(frozen=True)
class SchedulingDecision:
    next_review_at: datetime
    stage: int
    stability_days: float
    difficulty_score: float
    lapses: int


class ReviewSchedulingPolicy(ABC):
    @abstractmethod
    def schedule(self, input_data: SchedulingInput) -> SchedulingDecision:
        """Pure domain calculation completely decoupled from persistence."""
        pass


class DeterministicV1Policy(ReviewSchedulingPolicy):
    """Transparent 1/3/7/14/30 stage interval policy."""

    def schedule(self, input_data: SchedulingInput) -> SchedulingDecision:
        current_state = input_data.review_state
        current_stage = current_state.stage if current_state else 0
        current_lapses = current_state.lapses if current_state else 0
        current_diff = current_state.difficulty_score if current_state else 5.0

        attempt_time = input_data.attempted_at or datetime.now(timezone.utc)

        if input_data.evidence.result.is_correct:
            next_stage = min(5, current_stage + 1)
            stability = float(STAGE_INTERVALS.get(next_stage, 30))
            next_review = attempt_time + timedelta(days=stability)
            next_lapses = current_lapses
        else:
            next_stage = 1
            stability = 1.0
            next_review = attempt_time + timedelta(days=1)
            next_lapses = current_lapses + 1

        return SchedulingDecision(
            next_review_at=next_review,
            stage=next_stage,
            stability_days=stability,
            difficulty_score=current_diff,
            lapses=next_lapses,
        )


class ReviewScheduler:
    @staticmethod
    async def apply(
        db: AsyncSession,
        evidence: LearningEvidence,
        review_item: ReviewItem,
        policy: Optional[ReviewSchedulingPolicy] = None,
    ) -> ReviewItem:
        """
        Mutates pre-locked review_item using pure domain ReviewSchedulingPolicy.
        Flushes to DB but DOES NOT COMMIT (single transaction commit owned by orchestrator — A2).

        Contract (A3): The review_item row must already be locked FOR UPDATE via
        LearningConceptAggregate.acquire() before calling this method.
        Contract (A6): Uses evidence.context.submitted_at for all timestamps.
        """
        if policy is None:
            policy = DeterministicV1Policy()

        event_time = evidence.context.submitted_at

        current_review_state = ReviewState(
            stage=review_item.review_stage,
            stability_days=float(review_item.stability_days or 1.0),
            difficulty_score=5.0,
            lapses=review_item.lapses,
        )

        input_data = SchedulingInput(
            review_state=current_review_state,
            evidence=evidence,
            attempted_at=event_time,
        )

        decision = policy.schedule(input_data)

        if evidence.result.is_correct:
            review_item.correct_count += 1
        else:
            review_item.incorrect_count += 1

        review_item.review_stage = decision.stage
        review_item.stability_days = decision.stability_days
        review_item.next_review_at = decision.next_review_at
        review_item.lapses = decision.lapses
        review_item.last_reviewed_at = event_time
        review_item.updated_at = event_time  # Deterministic (A6)

        db.add(review_item)
        await db.flush()
        return review_item

