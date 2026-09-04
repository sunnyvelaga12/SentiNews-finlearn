"""
Evidence Semantics Adapter — SentiNews Learn V0.5
Operates strictly OUTSIDE the frozen learning core.
Translates curriculum ActivityContract evidence_role into learning pipeline evidence constraints:
- DIAGNOSTIC: Diagnostic observation. Misconception analysis without authoritative mastery contribution (weight = 0).
- FORMATIVE: Formative practice. Low-stakes interaction without authoritative mastery contribution (weight = 0).
- MASTERY_EVIDENCE: Authoritative evidence eligible for concept mastery score mutation.
"""
import uuid
from typing import Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.learning import LearningSessionItem, LearningAttempt
from app.models.progress import ConceptMastery
from app.schemas.curriculum_contract import EvidenceRole
from app.services.learning.pipeline.orchestrator import LearningAttemptOrchestrator, compute_request_fingerprint


class EvaluatedEvidenceResult(BaseModel):
    activity_id: str
    evidence_role: str
    is_correct: bool
    score_scaled: int
    mastery_contribution_eligible: bool
    misconception_tag: Optional[str] = None
    explanation: Optional[str] = None
    mastery_score_before: int
    mastery_score_after: int
    attempt_id: Optional[str] = None


class EvidenceSemanticsAdapter:
    """
    Decouples pedagogical evidence role from the frozen learning engine.
    Ensures DIAGNOSTIC and FORMATIVE attempts never mutate authoritative ConceptMastery.
    """

    @classmethod
    async def process_attempt(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        activity_id: uuid.UUID,
        response_json: Dict[str, Any],
        confidence_rating: Optional[int] = None,
        response_time_ms: Optional[int] = None,
        idempotency_key: Optional[str] = None,
        evidence_role_override: Optional[str] = None,
    ) -> EvaluatedEvidenceResult:
        # 1. Fetch the Session Item to determine evidence_role
        stmt = select(LearningSessionItem).where(
            (LearningSessionItem.id == activity_id) | (LearningSessionItem.activity_id == activity_id),
            LearningSessionItem.session_id == session_id,
        )
        res = await db.execute(stmt)
        item = res.scalar_one_or_none()

        payload = getattr(item, "payload_snapshot", None) or getattr(item, "payload", {}) or {}
        eval_spec = getattr(item, "evaluation_spec_snapshot", None) or {}
        evidence_role = (
            evidence_role_override
            or payload.get("evidence_role")
            or eval_spec.get("evidence_role")
            or "MASTERY_EVIDENCE"
        ).upper()

        # 2. Get current ConceptMastery score before attempt
        concept_id = item.concept_id if item else None
        mastery_score_before = 0
        if concept_id:
            cm_res = await db.execute(
                select(ConceptMastery.mastery_score).where(
                    ConceptMastery.user_id == user_id,
                    ConceptMastery.concept_id == concept_id,
                )
            )
            score_row = cm_res.scalar_one_or_none()
            mastery_score_before = score_row or 0

        # 3. Apply semantic boundary
        if evidence_role in ("DIAGNOSTIC", "FORMATIVE", "NONE"):
            # DIAGNOSTIC / FORMATIVE SEMANTICS:
            # Evaluate correctness and misconception mapping WITHOUT invoking mastery engine projection.
            selected = response_json.get("selected_option_id") or response_json.get("selected_option")
            expected = payload.get("correct_option_id") or payload.get("correct_option")
            misconception_map = payload.get("misconception_map") or {}

            is_correct = (selected is not None and str(selected) == str(expected)) if expected is not None else True
            misconception_tag = misconception_map.get(str(selected)) if not is_correct else None
            explanation = payload.get("explanation") or (misconception_tag if not is_correct else "Correct.")

            # Record attempt in session item status
            if item:
                item.status = "COMPLETED"
                await db.flush()

            return EvaluatedEvidenceResult(
                activity_id=str(activity_id),
                evidence_role=evidence_role,
                is_correct=is_correct,
                score_scaled=10000 if is_correct else 0,
                mastery_contribution_eligible=False,
                misconception_tag=misconception_tag,
                explanation=explanation,
                mastery_score_before=mastery_score_before,
                mastery_score_after=mastery_score_before,  # Strict invariant: 0 mutation
                attempt_id=f"diag-{uuid.uuid4()}",
            )

        # 4. MASTERY_EVIDENCE SEMANTICS:
        # Passes directly through to the frozen LearningAttemptOrchestrator for authoritative projection
        orchestrator = LearningAttemptOrchestrator(db)
        fingerprint = compute_request_fingerprint(response_json, confidence_rating, response_time_ms)

        result = await orchestrator.process(
            user_id=user_id,
            session_id=session_id,
            activity_id=item.activity_id if item else activity_id,
            response_json=response_json,
            confidence_rating=confidence_rating,
            response_time_ms=response_time_ms,
            idempotency_key=idempotency_key,
            request_fingerprint=fingerprint,
        )

        mastery_score_after = result.get("updated_mastery_score", mastery_score_before)

        return EvaluatedEvidenceResult(
            activity_id=str(activity_id),
            evidence_role="MASTERY_EVIDENCE",
            is_correct=result.get("is_correct", False),
            score_scaled=result.get("score", 0),
            mastery_contribution_eligible=True,
            misconception_tag=result.get("evaluator_metadata", {}).get("misconception_tag"),
            explanation=payload.get("explanation"),
            mastery_score_before=mastery_score_before,
            mastery_score_after=mastery_score_after,
            attempt_id=result.get("attempt_id"),
        )
