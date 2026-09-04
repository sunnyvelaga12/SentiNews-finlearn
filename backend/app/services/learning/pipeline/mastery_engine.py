"""
Mastery Engine — Projection mutator for concept-level mastery (Gate 5).

Architecture Contract v3:
- Does NOT independently acquire locks — expects pre-locked mastery from aggregate (A3)
- No datetime.now() in projection path (A6) — uses evidence timestamps
- Integer arithmetic for mastery_score (FC-5/A17)
- Deterministic: same evidence + same initial state → same result
"""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.progress import ConceptMastery
from app.services.learning.mastery_config import (
    MASTERY_ALGORITHM_VERSION,
    derive_mastery_score,
    compute_mastery_level,
)
from app.services.learning.pipeline.domain import LearningEvidence


class MasteryEngine:

    @staticmethod
    async def apply(
        db: AsyncSession,
        evidence: LearningEvidence,
        mastery: ConceptMastery,
    ) -> ConceptMastery:
        """
        Mutates pre-locked concept_mastery based on LearningEvidence.

        Contract (A6): Uses evidence.context.submitted_at for all timestamps.
        Contract (A17): mastery_score is scaled integer ×100.

        The mastery row must already be locked FOR UPDATE via
        LearningConceptAggregate.acquire() before calling this method.

        Flushes to DB but DOES NOT COMMIT (single transaction commit
        owned by orchestrator — A2).
        """
        event_time = evidence.context.submitted_at

        if mastery.first_exposed_at is None:
            mastery.first_exposed_at = event_time

        mastery.attempt_count += 1
        mastery.evidence_count += 1
        mastery.last_attempted_at = event_time

        if evidence.result.is_correct:
            mastery.correct_count += 1
            mastery.last_correct_at = event_time

            ev_type = evidence.evidence_type
            if ev_type in ("ACTIVE_RECALL", "DELAYED_RECALL_1D", "DELAYED_RECALL_7D", "DELAYED_RECALL_30D"):
                mastery.active_recall_successes += 1
                mastery.last_active_recall_at = event_time

            if ev_type in ("DELAYED_RECALL_1D", "DELAYED_RECALL_7D", "DELAYED_RECALL_30D"):
                mastery.delayed_recall_successes += 1
                mastery.last_delayed_recall_at = event_time
        else:
            mastery.incorrect_count += 1
            mastery.error_count += 1

        # Derive score — pure integer arithmetic (A17)
        mastery.mastery_score = derive_mastery_score(mastery)
        mastery.calculated_at = event_time  # NOT datetime.now() — deterministic (A6)
        mastery.mastery_algorithm_version = MASTERY_ALGORITHM_VERSION
        mastery.last_evaluated_at = event_time  # NOT datetime.now() — deterministic (A6)

        db.add(mastery)
        await db.flush()
        return mastery

