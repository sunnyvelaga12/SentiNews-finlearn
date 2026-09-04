"""
Learner Curriculum State Service — SentiNews Learn V0.4 / V1.0
Computes multi-dimensional learner-specific metrics:
- Lessons completed (based on verified attempts and user_progress records)
- Concepts mastered
- Application tier & Transfer tier
- Capability badges
"""
import uuid
from datetime import datetime, timezone
from typing import Set, Dict, Any, Optional, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.learning import LearningAttempt
from app.models.progress import ConceptMastery, UserProgress
from app.schemas.curriculum_contract import ModuleProgressMetrics, BadgeContract


class LearnerCurriculumStateService:
    @classmethod
    async def get_verified_completed_concept_ids(
        cls, db: AsyncSession, user_id: uuid.UUID
    ) -> Set[uuid.UUID]:
        """
        Evidence-Driven Rule:
        A concept is considered completed when the learner has at least 1
        evaluated attempt with is_correct=True and evaluation_status='EVALUATED',
        or has achieved verified mastery >= 7000 (70%).
        """
        stmt = (
            select(LearningAttempt.concept_id)
            .where(
                LearningAttempt.user_id == user_id,
                LearningAttempt.evaluation_status == "EVALUATED",
                LearningAttempt.is_correct == True,
            )
            .distinct()
        )
        res = await db.execute(stmt)
        cids = {r[0] for r in res.all() if r[0]}

        # Also include concepts with high mastery from concept_mastery
        m_stmt = (
            select(ConceptMastery.concept_id)
            .where(
                ConceptMastery.user_id == user_id,
                ConceptMastery.mastery_score >= 7000,
            )
            .distinct()
        )
        m_res = await db.execute(m_stmt)
        for r in m_res.all():
            if r[0]:
                cids.add(r[0])

        return cids

    @classmethod
    async def get_completed_lesson_ids(
        cls, db: AsyncSession, user_id: uuid.UUID
    ) -> Set[uuid.UUID]:
        """
        Returns set of lesson IDs marked as completed for the user in user_progress.
        """
        stmt = (
            select(UserProgress.lesson_id)
            .where(
                UserProgress.user_id == user_id,
                UserProgress.completed == True,
            )
        )
        res = await db.execute(stmt)
        return {r[0] for r in res.all() if r[0]}

    @classmethod
    async def mark_lesson_completed(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        lesson_id: uuid.UUID,
        lesson_version_id: uuid.UUID,
        concept_ids: List[uuid.UUID],
        score: float = 100.0,
    ) -> UserProgress:
        """
        Server-Authoritative Lesson Completion Writer:
        1. Upserts user_progress record with completed=True and current timestamp.
        2. Single-writer invariant: ConceptMastery is NEVER written or mutated here.
           Mastery is strictly computed from evaluated learning attempts by the frozen core.
        """
        now = datetime.now(timezone.utc)

        from sqlalchemy.dialects.postgresql import insert as pg_insert

        # Atomic PostgreSQL upsert enforcing uq_user_lesson_progress boundary
        # Single-writer invariant: ConceptMastery is NEVER written or mutated here.
        stmt = (
            pg_insert(UserProgress)
            .values(
                id=uuid.uuid4(),
                user_id=user_id,
                lesson_id=lesson_id,
                lesson_version_id=lesson_version_id,
                completed=True,
                score=score,
                completed_at=now,
                created_at=now,
            )
            .on_conflict_do_update(
                constraint="uq_user_lesson_progress",
                set_={
                    "completed": True,
                    "lesson_version_id": lesson_version_id,
                    "score": score,
                    "completed_at": now,
                },
            )
            .returning(UserProgress)
        )
        res = await db.execute(stmt)
        record = res.scalar_one()
        await db.flush()
        return record

    @classmethod
    async def get_mastered_concept_count(
        cls, db: AsyncSession, user_id: uuid.UUID, concept_ids: Set[uuid.UUID]
    ) -> int:
        """Returns the number of concepts in concept_ids where mastery score >= 8000 (80%)."""
        if not concept_ids:
            return 0
        stmt = (
            select(ConceptMastery)
            .where(
                ConceptMastery.user_id == user_id,
                ConceptMastery.concept_id.in_(list(concept_ids)),
                ConceptMastery.mastery_score >= 8000,
            )
        )
        res = await db.execute(stmt)
        return len(res.scalars().all())

    @classmethod
    def compute_application_tier(cls, completed_ratio: float) -> str:
        if completed_ratio >= 1.0:
            return "COMPETENT"
        elif completed_ratio >= 0.5:
            return "DEVELOPING"
        return "BEGINNING"

    @classmethod
    def compute_transfer_tier(cls, mastered_count: int, total_concepts: int) -> str:
        if total_concepts > 0 and (mastered_count / total_concepts) >= 0.8:
            return "COMPETENT"
        elif mastered_count > 0:
            return "DEVELOPING"
        return "BEGINNING"

    @classmethod
    def compute_badge_state(
        cls, module_slug: str, completed_lessons: int, total_lessons: int
    ) -> BadgeContract:
        is_earned = total_lessons > 0 and completed_lessons >= total_lessons
        is_in_progress = completed_lessons > 0 and not is_earned

        return BadgeContract(
            id=f"badge-{module_slug}",
            title="Candlestick Reader" if "candlestick" in module_slug else "Module Practitioner",
            description="Verified capability to explain candle anatomy and interpret price behavior on unfamiliar charts.",
            credential_claim="Demonstrated verified application and active recall across all unit milestones.",
            status="EARNED" if is_earned else ("IN_PROGRESS" if is_in_progress else "LOCKED"),
            awarded_at=None,
        )
