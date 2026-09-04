import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import verify_jwt_token, validate_origin_and_csrf
from app.models.progress import ReviewItem, ReviewAttempt, ConceptMastery
from app.models.concept import Concept
from app.models.idempotency import IdempotencyRecord

router = APIRouter()

class ReviewAnswerRequest(BaseModel):
    concept_id: uuid.UUID
    question_id: uuid.UUID
    is_correct: bool
    confidence_rating: int  # 1 to 5
    lesson_version_id: Optional[uuid.UUID] = None
    response_time_ms: Optional[int] = None

@router.get("/review/today")
async def get_today_reviews(request: Request, db: AsyncSession = Depends(get_db)):
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

    payload = verify_jwt_token(auth_header.split(" ")[1])
    user_id = uuid.UUID(payload["sub"])

    now = datetime.now(timezone.utc)
    stmt = (
        select(ReviewItem, Concept)
        .join(Concept, ReviewItem.concept_id == Concept.id)
        .where(
            ReviewItem.user_id == user_id,
            ReviewItem.next_review_at <= now
        )
    )
    res = await db.execute(stmt)
    rows = res.all()

    due_reviews = []
    for r, c in rows:
        due_reviews.append({
            "review_item_id": str(r.id),
            "concept_id": str(c.id),
            "concept_slug": c.slug,
            "concept_title": c.title,
            "domain": c.domain,
            "review_stage": r.review_stage,
            "stability_days": r.stability_days,
            "next_review_at": r.next_review_at.isoformat() if r.next_review_at else None
        })

    return {"reviews": due_reviews}

@router.post("/review/complete")
async def complete_review(
    req: ReviewAnswerRequest,
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db)
):
    validate_origin_and_csrf(request)
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

    payload = verify_jwt_token(auth_header.split(" ")[1])
    user_id = uuid.UUID(payload["sub"])

    if not idempotency_key:
        idempotency_key = f"rev-{uuid.uuid4().hex}"

    body_bytes = await request.body()
    req_hash = hashlib.sha256(body_bytes).hexdigest()
    operation_type = "COMPLETE_REVIEW"

    # Check Idempotency (A12 / A13 contract)
    idem_stmt = select(IdempotencyRecord).where(
        IdempotencyRecord.user_id == user_id,
        IdempotencyRecord.operation_type == operation_type,
        IdempotencyRecord.idempotency_key == idempotency_key,
    )
    idem_res = await db.execute(idem_stmt)
    existing_idem = idem_res.scalar_one_or_none()

    if existing_idem:
        if existing_idem.request_fingerprint != req_hash:
            raise HTTPException(status_code=409, detail="IDEMPOTENCY_PAYLOAD_MISMATCH")
        if existing_idem.status == "PROCESSING":
            raise HTTPException(status_code=409, headers={"Retry-After": "2"}, detail="IDEMPOTENCY_IN_PROGRESS")
        if existing_idem.status == "SUCCESS":
            return existing_idem.response_snapshot

    now = datetime.now(timezone.utc)
    idem_record = IdempotencyRecord(
        user_id=user_id,
        operation_type=operation_type,
        idempotency_key=idempotency_key,
        request_fingerprint=req_hash,
        status="PROCESSING",
    )
    db.add(idem_record)
    await db.flush()

    try:
        # 1. Fetch or create ReviewItem (single row per (user_id, concept_id))
        r_stmt = select(ReviewItem).where(
            ReviewItem.user_id == user_id,
            ReviewItem.concept_id == req.concept_id,
        )
        r_res = await db.execute(r_stmt)
        item = r_res.scalar_one_or_none()

        stage_intervals = {1: 1, 2: 3, 3: 7, 4: 14, 5: 30}

        if not item:
            new_stage = 2 if req.is_correct else 1
            stability = stage_intervals.get(new_stage, 1)
            item = ReviewItem(
                user_id=user_id,
                concept_id=req.concept_id,
                review_stage=new_stage,
                stability_days=stability,
                lapses=0 if req.is_correct else 1,
                next_review_at=now + timedelta(days=stability),
                correct_count=1 if req.is_correct else 0,
                incorrect_count=0 if req.is_correct else 1,
                last_reviewed_at=now,
                scheduler_version=1,
            )
            db.add(item)
            await db.flush()
        else:
            item.last_reviewed_at = now
            if req.is_correct:
                item.correct_count += 1
                item.review_stage = min(5, item.review_stage + 1)
                stability = stage_intervals.get(item.review_stage, 30)
                item.stability_days = stability
                item.next_review_at = now + timedelta(days=stability)
            else:
                item.incorrect_count += 1
                item.lapses += 1
                item.review_stage = max(1, item.review_stage - 1)
                item.stability_days = 1
                item.next_review_at = now + timedelta(days=1)

        # 2. Log immutable ReviewAttempt
        attempt = ReviewAttempt(
            review_item_id=item.id,
            user_id=user_id,
            concept_id=req.concept_id,
            question_id=req.question_id,
            lesson_version_id=req.lesson_version_id,
            scheduler_version=1,
            is_correct=req.is_correct,
            confidence_rating=req.confidence_rating,
            response_time_ms=req.response_time_ms,
            idempotency_key=idempotency_key,
            attempted_at=now,
        )
        db.add(attempt)

        # 3. Update ConceptMastery with scaled integer (0-10000)
        m_stmt = select(ConceptMastery).where(
            ConceptMastery.user_id == user_id,
            ConceptMastery.concept_id == req.concept_id,
        )
        m_res = await db.execute(m_stmt)
        mastery = m_res.scalar_one_or_none()

        conf_normalized = (max(1, min(5, req.confidence_rating)) - 1) / 4.0

        if not mastery:
            init_score = 7000 if req.is_correct else 0
            mastery = ConceptMastery(
                user_id=user_id,
                concept_id=req.concept_id,
                mastery_score=init_score,
                confidence_level=conf_normalized,
                evidence_count=1,
                correct_count=1 if req.is_correct else 0,
                incorrect_count=0 if req.is_correct else 1,
                attempt_count=1,
                last_evaluated_at=now,
            )
            db.add(mastery)
        else:
            mastery.attempt_count += 1
            mastery.evidence_count += 1
            mastery.confidence_level = round((mastery.confidence_level + conf_normalized) / 2.0, 4)
            if req.is_correct:
                mastery.correct_count += 1
                mastery.mastery_score = min(10000, mastery.mastery_score + 1000)
            else:
                mastery.incorrect_count += 1
                mastery.lapse_count += 1
                mastery.mastery_score = max(0, mastery.mastery_score - 1000)
            mastery.last_evaluated_at = now

        res_payload = {
            "status": "SUCCESS",
            "next_review_stage": item.review_stage,
            "next_review_at": item.next_review_at.isoformat() if item.next_review_at else None,
            "updated_mastery_score": mastery.mastery_score,
        }

        idem_record.status = "SUCCESS"
        idem_record.response_snapshot = res_payload
        idem_record.completed_at = now

        await db.commit()
        return res_payload

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"REVIEW_COMPLETION_FAILED: {str(e)}")

