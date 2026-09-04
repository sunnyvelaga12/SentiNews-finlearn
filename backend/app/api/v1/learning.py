import uuid
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.learning import LearningSession, LearningSessionItem
from app.services.learning.next_action_engine import NextActionEngine
from app.services.learning.session_generator import SessionGeneratorService
from app.services.learning.pipeline.orchestrator import LearningAttemptOrchestrator, compute_request_fingerprint

router = APIRouter()

# Demo user ID for unauthenticated / fast execution mode
DEFAULT_DEMO_USER_ID = uuid.UUID("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")


class SessionCreateRequest(BaseModel):
    mode: str = Field(default="DEFAULT", description="Session policy mode: DEFAULT, CRITICAL_REVIEW, NEW_LEARNER, QUICK_3MIN")
    lesson_version_id: Optional[uuid.UUID] = None
    lesson_slug: Optional[str] = None


class AttemptSubmitRequest(BaseModel):
    response: Dict[str, Any] = Field(..., description="Learner response payload (e.g. selected_option_id, user_value)")
    confidence_rating: Optional[int] = Field(default=None, ge=1, le=5, description="Self-reported confidence rating (1 to 5, optional)")
    response_time_ms: Optional[int] = Field(default=None, description="Client response duration in milliseconds")


@router.get("/next-action", summary="Get single recommended next action without creating session entities")
async def get_next_action(
    user_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    target_user_id = user_id or DEFAULT_DEMO_USER_ID
    return await NextActionEngine.recommend_next_action(db, target_user_id)


@router.post("/sessions", status_code=status.HTTP_201_CREATED, summary="Create immutable dynamic learning session")
async def create_session(
    payload: SessionCreateRequest,
    user_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    target_user_id = user_id or DEFAULT_DEMO_USER_ID
    target_version_id = payload.lesson_version_id
    if not target_version_id and payload.lesson_slug:
        from app.models.lesson import Lesson
        l_stmt = select(Lesson).where(Lesson.slug == payload.lesson_slug)
        l_res = await db.execute(l_stmt)
        lesson = l_res.scalar_one_or_none()
        if lesson and lesson.current_version_id:
            target_version_id = lesson.current_version_id

    session, items_payload = await SessionGeneratorService.create_session(
        db, target_user_id, payload.mode, target_version_id
    )

    resolved_slug = payload.lesson_slug or (lesson.slug if 'lesson' in locals() and lesson else None)
    return {
        "id": str(session.id),
        "session_id": str(session.id),
        "user_id": str(session.user_id),
        "policy": session.policy,
        "status": session.status,
        "estimated_minutes": session.estimated_minutes,
        "started_at": session.started_at.isoformat(),
        "lesson_slug": resolved_slug,
        "items": items_payload
    }


@router.get("/sessions/{session_id}", summary="Get active session details and items")
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(LearningSession)
        .where(LearningSession.id == session_id)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Learning session not found")

    items_stmt = (
        select(LearningSessionItem)
        .options(selectinload(LearningSessionItem.activity))
        .where(LearningSessionItem.session_id == session_id)
        .order_by(LearningSessionItem.position.asc())
    )
    items_res = await db.execute(items_stmt)
    session_items = items_res.scalars().all()

    items_payload = []
    for item in session_items:
        activity = item.activity
        items_payload.append({
            "session_item_id": str(item.id),
            "activity_id": str(activity.id),
            "activity_type": getattr(activity, "interaction_type", None) or (activity.activity_type if activity else "MCQ"),
            "learning_phase": getattr(activity, "learning_phase", None) or (activity.activity_type if activity else "RETRIEVE"),
            "title": activity.title if activity else "Activity",
            "position": item.position,
            "selection_reason": item.selection_reason,
            "payload": item.payload_snapshot or (activity.payload if activity else {})
        })

    lesson_slug = None
    lesson_title = None
    if session.lesson_version_id:
        from app.models.lesson import LessonVersion, Lesson
        lv_stmt = select(LessonVersion).where(LessonVersion.id == session.lesson_version_id)
        lv_res = await db.execute(lv_stmt)
        lv = lv_res.scalar_one_or_none()
        if lv:
            lesson_title = lv.title
            l_stmt = select(Lesson).where(Lesson.id == lv.lesson_id)
            l_res = await db.execute(l_stmt)
            l = l_res.scalar_one_or_none()
            if l:
                lesson_slug = l.slug

    return {
        "session_id": str(session.id),
        "user_id": str(session.user_id),
        "policy": session.policy,
        "status": session.status,
        "estimated_minutes": session.estimated_minutes,
        "started_at": session.started_at.isoformat(),
        "lesson_slug": lesson_slug,
        "lesson_title": lesson_title,
        "items": items_payload
    }


@router.post(
    "/sessions/{session_id}/activities/{activity_id}/attempts",
    status_code=status.HTTP_200_OK,
    summary="Submit attempt evaluation to canonical evidence layer"
)
async def submit_attempt(
    session_id: uuid.UUID,
    activity_id: uuid.UUID,
    payload: AttemptSubmitRequest,
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    user_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    target_user_id = user_id or DEFAULT_DEMO_USER_ID
    orchestrator = LearningAttemptOrchestrator(db)
    fingerprint = compute_request_fingerprint(
        payload.response, payload.confidence_rating, payload.response_time_ms
    )
    return await orchestrator.process(
        user_id=target_user_id,
        session_id=session_id,
        activity_id=activity_id,
        response_json=payload.response,
        confidence_rating=payload.confidence_rating,
        response_time_ms=payload.response_time_ms,
        idempotency_key=x_idempotency_key,
        request_fingerprint=fingerprint,
    )
