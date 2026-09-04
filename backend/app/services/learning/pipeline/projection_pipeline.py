from typing import Optional, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.learning import LearningAttempt
from app.services.learning.pipeline.domain import (
    AttemptContext, EvaluationResult, LearningContext, LearningEvidence
)
from app.services.learning.pipeline.aggregate import LearningConceptAggregate
from app.services.learning.pipeline.mastery_engine import MasteryEngine
from app.services.learning.pipeline.review_scheduler import ReviewScheduler, ReviewSchedulingPolicy
from app.services.learning.pipeline.learner_state_projector import LearnerStateProjector



class ProjectionPipeline:
    """
    Extracted Projection Pipeline — Contracts v3 (Gate 4 & 5).
    Takes a database session and a persisted LearningAttempt instance.
    Applies projections via LearningConceptAggregate ownership boundary.
    Can be called during live attempt orchestration OR background rebuild.
    """

    @staticmethod
    async def apply(
        db: AsyncSession,
        attempt: LearningAttempt,
        aggregate: Optional[LearningConceptAggregate] = None,
        policy: Optional[ReviewSchedulingPolicy] = None,
        project_learner_state: bool = True,
    ) -> Any:
        """
        Applies mastery and review projections for an attempt.

        Contract (A3): If aggregate is not provided, acquires it using
        sorted concept_id order.
        Contract (A4): Advances aggregate version and sequence.
        Contract (A6): Uses evidence_snapshot and attempt.received_at / attempted_at.
        """
        # 1. Acquire aggregate lock if not provided
        if aggregate is None:
            aggs = await LearningConceptAggregate.acquire(
                db, attempt.user_id, [attempt.concept_id]
            )
            aggregate = aggs[attempt.concept_id]

        # 2. Extract LearningEvidence from versioned evidence_snapshot (or legacy fallback)
        evidence = ProjectionPipeline.reconstruct_evidence(attempt)

        # 3. Apply concept_mastery projection (pre-locked)
        await MasteryEngine.apply(db, evidence, aggregate.concept_mastery)

        # 4. Apply review_item projection (pre-locked)
        await ReviewScheduler.apply(db, evidence, aggregate.review_item, policy=policy)

        # 5. Advance aggregate version and sequence (A4)
        aggregate.advance()

        # 6. Project learner_state read model (optional for bulk rebuilds)
        if project_learner_state:
            return await LearnerStateProjector.project(
                db, attempt.user_id, as_of=attempt.received_at or attempt.attempted_at
            )
        return None

    @staticmethod
    def reconstruct_evidence(attempt: LearningAttempt) -> LearningEvidence:
        """Reconstructs LearningEvidence from attempt.evidence_snapshot (v3) or legacy JSON fields."""
        snap = attempt.evidence_snapshot or {}

        if snap and "schema_version" in snap:
            eval_data = snap.get("evaluation", {})
            ctx_data = snap.get("learning_context", {})
            ev_data = snap.get("evidence", {})

            eval_result = EvaluationResult(
                is_correct=eval_data.get("is_correct", attempt.is_correct),
                score=eval_data.get("score", attempt.score),
                confidence_rating=eval_data.get("confidence_rating", attempt.confidence_rating),
                evaluator_metadata=eval_data.get("evaluator_metadata", {}),
            )

            attempt_context = AttemptContext(
                attempt_id=attempt.id,
                user_id=attempt.user_id,
                session_id=attempt.session_id,
                concept_id=attempt.concept_id,
                objective_id=attempt.objective_id,
                activity_id=attempt.activity_id,
                learning_phase=ctx_data.get("learning_phase", "RETRIEVE"),
                interaction_type=ctx_data.get("interaction_type", "MCQ"),
                submitted_at=attempt.received_at or attempt.attempted_at,
                response_time_ms=attempt.response_time_ms,
            )

            learning_context = LearningContext(
                is_review=ctx_data.get("is_review", False),
                days_since_last_correct=ctx_data.get("days_since_last_correct"),
                attempt_number=ctx_data.get("attempt_number", 1),
                current_review_stage=ctx_data.get("current_review_stage", 1),
            )

            return LearningEvidence(
                context=attempt_context,
                result=eval_result,
                learning_context=learning_context,
                evidence_type=ev_data.get("type", "ACTIVE_RECALL"),
                evidence_weight=int(ev_data.get("weight", 100)),
            )

        # Fallback for historical data during migration
        eval_data = attempt.evaluation_json or {}
        ctx_data = attempt.context_json or {}
        ev_data = attempt.evidence_json or {}

        eval_result = EvaluationResult(
            is_correct=attempt.is_correct,
            score=attempt.score,
            confidence_rating=attempt.confidence_rating,
            evaluator_metadata=eval_data,
        )

        attempt_context = AttemptContext(
            attempt_id=attempt.id,
            user_id=attempt.user_id,
            session_id=attempt.session_id,
            concept_id=attempt.concept_id,
            objective_id=attempt.objective_id,
            activity_id=attempt.activity_id,
            learning_phase=ctx_data.get("learning_phase", "RETRIEVE"),
            interaction_type=ctx_data.get("interaction_type", "MCQ"),
            submitted_at=attempt.attempted_at,
            response_time_ms=attempt.response_time_ms,
        )

        learning_context = LearningContext(
            is_review=ctx_data.get("is_review", False),
            days_since_last_correct=ctx_data.get("days_since_last_correct"),
            attempt_number=ctx_data.get("attempt_number", 1),
            current_review_stage=ctx_data.get("current_review_stage", 1),
        )

        return LearningEvidence(
            context=attempt_context,
            result=eval_result,
            learning_context=learning_context,
            evidence_type=ev_data.get("type", "IMMEDIATE_RECOGNITION"),
            evidence_weight=int(ev_data.get("weight", 100)),
        )

