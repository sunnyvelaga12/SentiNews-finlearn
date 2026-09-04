"""
Learning Concept Aggregate — Single ownership boundary (Gate 2).

Architecture Contract v3:
- Acquires locks in deterministic sorted concept_id order (A3)
- Owns: concept_mastery + review_item + aggregate_version + sequence
- All projection mutations go through this abstraction
- Phase 2A.1: always exactly one concept per acquire() call (A11)
- Replaces independent get_or_create_for_update() in MasteryEngine/ReviewScheduler
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.progress import ConceptMastery, ReviewItem


@dataclass
class LearningConceptAggregate:
    """
    Single ownership boundary for concept-level learning state.

    After acquire(), the caller holds FOR UPDATE locks on both
    concept_mastery and review_item rows for this (user_id, concept_id).
    """
    concept_id: UUID
    concept_mastery: ConceptMastery
    review_item: ReviewItem
    aggregate_version: int
    next_sequence: int

    def advance(self) -> None:
        """
        Called after projection. Increments version and records the sequence
        that was just applied. Must be called before COMMIT.
        """
        self.aggregate_version += 1
        self.concept_mastery.aggregate_version = self.aggregate_version
        self.concept_mastery.last_event_sequence = self.next_sequence

    @staticmethod
    async def acquire(
        db: AsyncSession,
        user_id: UUID,
        concept_ids: List[UUID],
    ) -> Dict[UUID, 'LearningConceptAggregate']:
        """
        Acquire all aggregates for the given concepts.

        CRITICAL (A3): concept_ids are sorted before lock acquisition
        to prevent deadlocks across concurrent requests.

        Phase 2A.1 (A11): this list always has exactly one element.

        Lock ordering:
        1. concept_mastery FOR UPDATE (sorted by concept_id)
        2. review_item FOR UPDATE (same concept_id order)

        Returns dict of concept_id → LearningConceptAggregate.
        """
        sorted_ids = sorted(concept_ids)
        aggregates: Dict[UUID, LearningConceptAggregate] = {}

        for cid in sorted_ids:
            mastery = await _get_or_create_mastery_for_update(db, user_id, cid)
            review = await _get_or_create_review_for_update(db, user_id, cid)

            aggregates[cid] = LearningConceptAggregate(
                concept_id=cid,
                concept_mastery=mastery,
                review_item=review,
                aggregate_version=mastery.aggregate_version,
                next_sequence=mastery.last_event_sequence + 1,
            )

        return aggregates


async def _get_or_create_mastery_for_update(
    db: AsyncSession,
    user_id: UUID,
    concept_id: UUID,
) -> ConceptMastery:
    """
    Atomic: INSERT ON CONFLICT DO NOTHING, then SELECT FOR UPDATE.
    Prevents lost updates under concurrent first attempts.
    """
    now = datetime.now(timezone.utc)
    stmt_insert = insert(ConceptMastery).values(
        user_id=user_id,
        concept_id=concept_id,
        mastery_score=0,
        confidence_level=0.5,
        evidence_count=0,
        correct_count=0,
        incorrect_count=0,
        attempt_count=0,
        error_count=0,
        lapse_count=0,
        active_recall_successes=0,
        delayed_recall_successes=0,
        unique_objective_successes=0,
        unique_activity_successes=0,
        mastery_algorithm_version=1,
        aggregate_version=0,
        last_event_sequence=0,
        last_evaluated_at=now,
        created_at=now,
    ).on_conflict_do_nothing(index_elements=["user_id", "concept_id"])
    await db.execute(stmt_insert)
    await db.flush()

    stmt_select = (
        select(ConceptMastery)
        .where(
            ConceptMastery.user_id == user_id,
            ConceptMastery.concept_id == concept_id,
        )
        .with_for_update()
    )
    res = await db.execute(stmt_select)
    return res.scalar_one()


async def _get_or_create_review_for_update(
    db: AsyncSession,
    user_id: UUID,
    concept_id: UUID,
) -> ReviewItem:
    """
    Atomic: INSERT ON CONFLICT DO NOTHING, then SELECT FOR UPDATE.
    Same lock ordering as mastery — always acquired after mastery for same concept.
    """
    now = datetime.now(timezone.utc)
    initial_next_review = now + timedelta(days=1)

    stmt_insert = insert(ReviewItem).values(
        user_id=user_id,
        concept_id=concept_id,
        review_stage=1,
        stability_days=1,
        lapses=0,
        correct_count=0,
        incorrect_count=0,
        scheduler_version=1,
        next_review_at=initial_next_review,
        created_at=now,
        updated_at=now,
    ).on_conflict_do_nothing(index_elements=["user_id", "concept_id"])
    await db.execute(stmt_insert)
    await db.flush()

    stmt_select = (
        select(ReviewItem)
        .where(
            ReviewItem.user_id == user_id,
            ReviewItem.concept_id == concept_id,
        )
        .with_for_update()
    )
    res = await db.execute(stmt_select)
    return res.scalar_one()
