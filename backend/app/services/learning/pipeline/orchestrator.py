import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from uuid import uuid4, UUID
from typing import Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.idempotency import IdempotencyRecord
from app.models.learning import LearningSession, LearningSessionItem, LearningAttempt
from app.models.progress import ConceptMastery
from app.services.learning.mastery_config import compute_mastery_level
from app.services.learning.pipeline.aggregate import LearningConceptAggregate
from app.services.learning.pipeline.domain import AttemptContext
from app.services.learning.pipeline.evaluators import ActivityEvaluator
from app.services.learning.pipeline.context_resolver import LearningContextResolver
from app.services.learning.pipeline.evidence_classifier import EvidenceClassifier
from app.services.learning.pipeline.projection_pipeline import ProjectionPipeline


logger = logging.getLogger(__name__)


def compute_request_fingerprint(
    response_json: Dict[str, Any],
    confidence_rating: Optional[int],
    response_time_ms: Optional[int],
) -> str:
    canonical = json.dumps(
        {
            "response": response_json,
            "confidence_rating": confidence_rating,
            "response_time_ms": response_time_ms,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


class LearningAttemptOrchestrator:
    """
    Single transaction owner for learning attempt processing.

    Architecture Contract v3 (Gate 3):
    1. Idempotency coordination (INSERT ON CONFLICT as sole authority — FC-1/A14)
    2. Session item lock FOR UPDATE & lifecycle/ownership validation (A10/A15)
    3. Aggregate lock acquisition in sorted concept_id order (A3)
    4. Pure evaluation & context resolution & evidence classification
    5. Construct versioned evidence envelope & deterministic response snapshot
    6. INSERT learning_attempt (immutable after insert — A5)
    7. Apply projections & advance aggregate sequence (A4)
    8. Mark session_item.status = COMPLETED
    9. SET idempotency_record.status = SUCCESS (A13)
    10. Single Atomic Commit (A2/A8)
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def process(
        self,
        user_id: UUID,
        session_id: UUID,
        activity_id: UUID,
        response_json: Dict[str, Any],
        confidence_rating: Optional[int] = None,
        response_time_ms: Optional[int] = None,
        idempotency_key: Optional[str] = None,
        request_fingerprint: Optional[str] = None,
    ) -> Dict[str, Any]:
        start_time = time.perf_counter()
        request_id = str(uuid4())
        now = datetime.now(timezone.utc)

        # 1. Compute request fingerprint
        fingerprint = request_fingerprint or compute_request_fingerprint(
            response_json, confidence_rating, response_time_ms
        )

        # 2. Transactional Idempotency Coordination (FC-1 / A12 / A14)
        idemp_record: Optional[IdempotencyRecord] = None
        if idempotency_key:
            # Check if an idempotency record already exists
            stmt_existing = select(IdempotencyRecord).where(
                IdempotencyRecord.user_id == user_id,
                IdempotencyRecord.operation_type == "SUBMIT_ATTEMPT",
                IdempotencyRecord.idempotency_key == idempotency_key,
            )
            existing_res = await self.db.execute(stmt_existing)
            existing = existing_res.scalar_one_or_none()

            if existing:
                if existing.request_fingerprint != fingerprint:
                    raise HTTPException(
                        status_code=409,
                        detail="Idempotency key reused with different request payload",
                    )
                if existing.status == "SUCCESS" and existing.response_snapshot is not None:
                    cached_copy = dict(existing.response_snapshot)
                    cached_copy["idempotent_replay"] = True
                    return cached_copy
                # If existing is still PROCESSING in another transaction, the unique insert below will block or raise IntegrityError

            # Insert PROCESSING record as authority (FC-1)
            idemp_record = IdempotencyRecord(
                id=uuid4(),
                user_id=user_id,
                operation_type="SUBMIT_ATTEMPT",
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                status="PROCESSING",
                created_at=now,
            )
            try:
                async with self.db.begin_nested():
                    self.db.add(idemp_record)
                    await self.db.flush()
            except IntegrityError:
                # Race condition recovery (FC-1 / A14):
                # Another concurrent request with the same key won the insert.
                # Query the winning record.
                stmt_win = select(IdempotencyRecord).where(
                    IdempotencyRecord.user_id == user_id,
                    IdempotencyRecord.operation_type == "SUBMIT_ATTEMPT",
                    IdempotencyRecord.idempotency_key == idempotency_key,
                )
                res_win = await self.db.execute(stmt_win)
                winning_record = res_win.scalar_one_or_none()

                if winning_record:
                    if winning_record.request_fingerprint != fingerprint:
                        raise HTTPException(
                            status_code=409,
                            detail="Idempotency key reused with different request payload",
                        )
                    if winning_record.status == "SUCCESS" and winning_record.response_snapshot is not None:
                        cached_copy = dict(winning_record.response_snapshot)
                        cached_copy["idempotent_replay"] = True
                        return cached_copy

                raise HTTPException(status_code=409, detail="Concurrent request in progress with same idempotency key")

        # 3. Validate Session and Authorization (404 for non-existent/foreign session — enumeration resistance)
        sess_stmt = (
            select(LearningSession)
            .where(
                LearningSession.id == session_id,
                LearningSession.user_id == user_id,
            )
            .with_for_update()
        )
        sess_res = await self.db.execute(sess_stmt)
        session = sess_res.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Learning session not found")

        if session.status != "ACTIVE":
            raise HTTPException(status_code=400, detail="Learning session is no longer active")

        # Lock session_item FOR UPDATE (A10)
        item_stmt = (
            select(LearningSessionItem)
            .where(
                LearningSessionItem.session_id == session_id,
                LearningSessionItem.activity_id == activity_id,
            )
            .with_for_update()
        )
        item_res = await self.db.execute(item_stmt)
        item = item_res.scalar_one_or_none()

        if not item:
            raise HTTPException(status_code=404, detail="Activity not found in active session")

        if item.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Activity already completed")

        # 4. Acquire Learning Aggregate Lock in sorted concept_id order (A3 / A11)
        aggs = await LearningConceptAggregate.acquire(self.db, user_id, [item.concept_id])
        aggregate = aggs[item.concept_id]

        # 5. Evaluate (reads ONLY frozen snapshots from session_item)
        eval_start = time.perf_counter()
        eval_result = ActivityEvaluator.evaluate(
            interaction_type=item.interaction_type,
            evaluation_spec=item.evaluation_spec_snapshot or {},
            payload_snapshot=item.payload_snapshot or {},
            response_json=response_json,
            confidence_rating=confidence_rating,
        )
        eval_ms = round((time.perf_counter() - eval_start) * 1000, 2)

        # 6. Resolve Context
        ctx_start = time.perf_counter()
        learning_ctx = await LearningContextResolver.resolve(
            self.db, user_id, item.concept_id, item.objective_id
        )
        ctx_ms = round((time.perf_counter() - ctx_start) * 1000, 2)

        # 7. Classify Evidence
        attempt_id = uuid4()
        attempt_ctx = AttemptContext(
            attempt_id=attempt_id,
            user_id=user_id,
            session_id=session_id,
            concept_id=item.concept_id,
            objective_id=item.objective_id,
            activity_id=activity_id,
            learning_phase=item.learning_phase,
            interaction_type=item.interaction_type,
            submitted_at=now,
            response_time_ms=response_time_ms,
        )

        evidence = EvidenceClassifier.classify(
            context=attempt_ctx,
            result=eval_result,
            learning_context=learning_ctx,
        )

        # 8. Build Evidence Envelope & Response Snapshot BEFORE Insert (A5)
        evidence_type_str = (
            evidence.evidence_type.name
            if hasattr(evidence.evidence_type, "name")
            else str(evidence.evidence_type)
        )

        evidence_snapshot = {
            "schema_version": 1,
            "evaluation": {
                "is_correct": eval_result.is_correct,
                "score": int(round((eval_result.score or 0.0) * 10000)),  # Scaled ×10000 (A17)
                "confidence_rating": confidence_rating,
                "evaluator_metadata": dict(eval_result.evaluator_metadata or {}),
            },
            "learning_context": {
                "is_review": learning_ctx.is_review,
                "days_since_last_correct": learning_ctx.days_since_last_correct,
                "attempt_number": learning_ctx.attempt_number,
                "current_review_stage": learning_ctx.current_review_stage,
                "learning_phase": item.learning_phase,
                "interaction_type": item.interaction_type,
            },
            "evidence": {
                "type": evidence_type_str,
                "weight": evidence.evidence_weight,  # Scaled ×100 (A17)
            },
            "versions": {
                "evaluator": "1",
                "classifier": "1",
                "mastery_policy": "1",
                "scheduler_policy": "1",
            },
        }

        # Projected score integer (scaled ×10000: 10000 = 1.0)
        attempt_score_scaled = int(round((eval_result.score or 0.0) * 10000))

        # We construct the response_snapshot upfront so attempt row is complete at INSERT time
        result_snapshot = {
            "attempt_result_schema_version": 1,
            "mastery_algorithm_version": 1,
            "scheduler_algorithm_version": 1,
            "evaluation_schema_version": 1,
            "activity_schema_version": getattr(item, "activity_schema_version", 1),
            "attempt_id": str(attempt_id),
            "session_id": str(session_id),
            "activity_id": str(activity_id),
            "concept_id": str(item.concept_id),
            "is_correct": eval_result.is_correct or False,
            "score": attempt_score_scaled,
            "confidence_rating": confidence_rating,
            "updated_mastery_score": aggregate.concept_mastery.mastery_score,  # Will be updated by projection
            "mastery_level": compute_mastery_level(aggregate.concept_mastery),
            "evidence_type": evidence_type_str,
            "attempted_at": now.isoformat(),
        }

        # 9. INSERT LearningAttempt (Immutable — A5)
        attempt = LearningAttempt(
            id=attempt_id,
            user_id=user_id,
            session_id=session_id,
            session_item_id=item.id,
            activity_id=activity_id,
            concept_id=item.concept_id,
            objective_id=item.objective_id,
            aggregate_sequence=aggregate.next_sequence,  # Monotonic per (user, concept) — A4
            response_json=response_json,
            evaluation_status="EVALUATED",
            is_correct=eval_result.is_correct or False,
            score=attempt_score_scaled,
            confidence_rating=confidence_rating,
            response_time_ms=response_time_ms,
            idempotency_key=idempotency_key,
            request_fingerprint=fingerprint,
            evidence_snapshot=evidence_snapshot,
            response_snapshot=result_snapshot,
            attempted_at=now,
            received_at=now,
        )

        try:
            async with self.db.begin_nested():
                self.db.add(attempt)
                await self.db.flush()
        except IntegrityError as exc:
            # Check if this is a duplicate session_item attempt (A10 / A15)
            if "uq_one_attempt_per_session_item" in str(exc):
                raise HTTPException(status_code=400, detail="Activity already completed")
            raise

        # 10. Apply Projection Pipeline (mutates pre-locked aggregate & advances sequence — A4)
        proj_start = time.perf_counter()
        await ProjectionPipeline.apply(self.db, attempt, aggregate=aggregate)
        proj_ms = round((time.perf_counter() - proj_start) * 1000, 2)

        # Update response snapshot with newly calculated mastery score/level
        result_snapshot["updated_mastery_score"] = aggregate.concept_mastery.mastery_score
        result_snapshot["mastery_level"] = compute_mastery_level(aggregate.concept_mastery)

        # 11. Complete Session Item & Mark Idempotency SUCCESS (A13)
        item.status = "COMPLETED"
        self.db.add(item)

        if idemp_record:
            idemp_record.status = "SUCCESS"
            idemp_record.attempt_id = attempt_id
            idemp_record.response_snapshot = result_snapshot
            idemp_record.completed_at = now
            self.db.add(idemp_record)

        # 12. Single Atomic Commit (A2 / A8)
        await self.db.commit()

        total_ms = round((time.perf_counter() - start_time) * 1000, 2)

        # Telemetry & Observability Logging
        idemp_hash = (
            hashlib.sha256(idempotency_key.encode()).hexdigest()[:12]
            if idempotency_key
            else None
        )
        logger.info(
            f"event=attempt_processed request_id={request_id} attempt_id={attempt_id} "
            f"user_id={user_id} session_id={session_id} activity_id={activity_id} "
            f"idempotency_hash={idemp_hash} aggregate_sequence={attempt.aggregate_sequence} "
            f"eval_ms={eval_ms} ctx_ms={ctx_ms} proj_ms={proj_ms} total_pipeline_ms={total_ms} outcome=success"
        )

        return result_snapshot

