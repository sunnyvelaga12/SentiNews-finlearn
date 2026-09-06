import uuid
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.learning import LearningSession, LearningSessionItem
from app.models.media import MediaAsset
from app.schemas.content_authoring import StoredBlock, ResponseType, LearnerBlockSerializer
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


class SessionProgressRequest(BaseModel):
    position: int = Field(..., ge=1, description="Current 1-indexed position in unified session stream")


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
    lesson = None
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

    resolved_slug = payload.lesson_slug or (lesson.slug if lesson else None)
    return {
        "id": str(session.id),
        "session_id": str(session.id),
        "user_id": str(session.user_id),
        "policy": session.policy,
        "status": session.status,
        "estimated_minutes": session.estimated_minutes,
        "started_at": session.started_at.isoformat(),
        "resume_position": session.current_position,
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

    lesson_slug = None
    lesson_title = None
    version = None
    if session.lesson_version_id:
        from app.models.lesson import LessonVersion, Lesson
        lv_stmt = select(LessonVersion).where(LessonVersion.id == session.lesson_version_id)
        lv_res = await db.execute(lv_stmt)
        version = lv_res.scalar_one_or_none()
        if version:
            lesson_title = version.title
            l_stmt = select(Lesson).where(Lesson.id == version.lesson_id)
            l_res = await db.execute(l_stmt)
            l = l_res.scalar_one_or_none()
            if l:
                lesson_slug = l.slug

    # Option B Unified Stream Reconstruction if version.blocks_json exists
    if version and version.blocks_json:
        items_by_act = {item.activity_id: item for item in session_items}
        items_payload = []
        sorted_blocks = sorted(version.blocks_json, key=lambda b: b.get("order_index", 0))

        # Collect all referenced media_asset_ids for batch resolution
        media_ids = set()
        for b in sorted_blocks:
            if b.get("media_asset_id"):
                media_ids.add(str(b["media_asset_id"]))
            if (b.get("content") or {}).get("media_asset_id"):
                media_ids.add(str(b["content"]["media_asset_id"]))
            for opt in b.get("options") or []:
                if isinstance(opt, dict) and opt.get("media_asset_id"):
                    media_ids.add(str(opt["media_asset_id"]))

        media_url_map = {}
        if media_ids:
            parsed_uuids = []
            for mid in media_ids:
                try:
                    parsed_uuids.append(uuid.UUID(str(mid)))
                except Exception:
                    pass
            if parsed_uuids:
                m_stmt = select(MediaAsset).where(MediaAsset.id.in_(parsed_uuids))
                m_res = await db.execute(m_stmt)
                for m in m_res.scalars().all():
                    media_url_map[str(m.id)] = m.url

        for idx, raw_block in enumerate(sorted_blocks):
            b_id = str(raw_block.get("id"))
            resp_type = raw_block.get("response_type")
            is_interactive = bool(resp_type and resp_type not in ("NONE", ResponseType.NONE))
            stored_block = StoredBlock(**raw_block)
            sanitized_payload = LearnerBlockSerializer.serialize(stored_block)

            # Extract answer keys & feedback
            b_eval = raw_block.get("evaluation") or {}
            b_correct_id = sanitized_payload.get("correct_option_id") or b_eval.get("correct_option_id")
            b_correct_ids = sanitized_payload.get("correct_option_ids") or b_eval.get("correct_option_ids")
            if not b_correct_id and raw_block.get("options"):
                for opt in raw_block["options"]:
                    if isinstance(opt, dict) and opt.get("is_correct"):
                        b_correct_id = str(opt.get("id"))
                        break
            if not b_correct_ids and raw_block.get("options"):
                found_cids = [str(opt.get("id")) for opt in raw_block["options"] if isinstance(opt, dict) and opt.get("is_correct")]
                if found_cids:
                    b_correct_ids = found_cids

            if b_correct_id:
                sanitized_payload["correct_option_id"] = str(b_correct_id)
            if b_correct_ids:
                sanitized_payload["correct_option_ids"] = [str(x) for x in b_correct_ids]

            b_expl = (raw_block.get("feedback") or {}).get("explanation") or b_eval.get("explanation") or raw_block.get("explanation")
            if b_expl:
                sanitized_payload["explanation"] = b_expl

            # Resolve image URLs onto payload and options
            b_mid = raw_block.get("media_asset_id") or (raw_block.get("content") or {}).get("media_asset_id")
            if b_mid and str(b_mid) in media_url_map:
                sanitized_payload["image_url"] = media_url_map[str(b_mid)]
                sanitized_payload["media_asset_id"] = str(b_mid)
            elif (raw_block.get("content") or {}).get("url") or (raw_block.get("content") or {}).get("image_url"):
                sanitized_payload["image_url"] = (raw_block.get("content") or {}).get("url") or (raw_block.get("content") or {}).get("image_url")

            # Resolve option images
            if "options" in sanitized_payload and isinstance(sanitized_payload["options"], list):
                for opt in sanitized_payload["options"]:
                    if isinstance(opt, dict) and opt.get("media_asset_id"):
                        opt_mid = str(opt["media_asset_id"])
                        if opt_mid in media_url_map:
                            opt["image_url"] = media_url_map[opt_mid]

            # Preserve prompt, context, and caption
            raw_content = raw_block.get("content") or {}
            if raw_content.get("context"):
                sanitized_payload["context"] = raw_content["context"]
            if raw_content.get("caption"):
                sanitized_payload["caption"] = raw_content["caption"]
            if raw_content.get("alt_text"):
                sanitized_payload["alt_text"] = raw_content["alt_text"]

            pos = raw_block.get("order_index", idx + 1)
            title = (
                raw_block.get("title")
                or raw_content.get("title")
                or raw_content.get("prompt")
                or raw_content.get("context")
                or f"Block {pos}"
            )
            c_type = raw_block.get("content_type") or raw_block.get("renderer") or "TEXT"

            if is_interactive:
                expected_act_id = uuid.uuid5(version.id, b_id)
                item = items_by_act.get(expected_act_id)
                items_payload.append({
                    "session_item_id": str(item.id) if item else f"item_{b_id}",
                    "activity_id": str(expected_act_id),
                    "activity_type": raw_block.get("activity_type") or "PRACTICE",
                    "content_type": c_type,
                    "renderer": c_type,
                    "interaction_type": resp_type,
                    "response_type": resp_type,
                    "is_interactive": True,
                    "correct_option_id": str(b_correct_id) if b_correct_id else None,
                    "correct_option_ids": [str(x) for x in b_correct_ids] if b_correct_ids else None,
                    "explanation": b_expl,
                    "media_asset_id": str(b_mid) if b_mid else None,
                    "image_url": sanitized_payload.get("image_url"),
                    "learning_phase": item.learning_phase if item else (raw_block.get("activity_type") or "PRACTICE"),
                    "title": title,
                    "position": pos,
                    "selection_reason": item.selection_reason if item else "CURRICULUM_BLOCK",
                    "status": item.status if item else "PENDING",
                    "payload": sanitized_payload,
                })
            else:
                # Pure-content block
                items_payload.append({
                    "session_item_id": f"content_{b_id}",
                    "activity_id": None,
                    "activity_type": raw_block.get("activity_type") or "EXPERIENCE",
                    "content_type": c_type,
                    "renderer": c_type,
                    "interaction_type": "NONE",
                    "response_type": "NONE",
                    "is_interactive": False,
                    "media_asset_id": str(b_mid) if b_mid else None,
                    "image_url": sanitized_payload.get("image_url"),
                    "learning_phase": raw_block.get("activity_type") or "EXPERIENCE",
                    "title": title,
                    "position": pos,
                    "selection_reason": "LESSON_STREAM",
                    "status": "COMPLETED",
                    "payload": sanitized_payload,
                })
    else:
        # Legacy fallback
        items_payload = []
        for item in session_items:
            activity = item.activity
            items_payload.append({
                "session_item_id": str(item.id),
                "activity_id": str(activity.id),
                "activity_type": getattr(activity, "interaction_type", None) or (activity.activity_type if activity else "MCQ"),
                "interaction_type": getattr(activity, "interaction_type", None) or (activity.activity_type if activity else "MCQ"),
                "is_interactive": True,
                "learning_phase": getattr(activity, "learning_phase", None) or (activity.activity_type if activity else "RETRIEVE"),
                "title": activity.title if activity else "Activity",
                "position": item.position,
                "selection_reason": item.selection_reason,
                "status": item.status,
                "payload": item.payload_snapshot or (activity.payload if activity else {})
            })

    return {
        "session_id": str(session.id),
        "user_id": str(session.user_id),
        "policy": session.policy,
        "status": session.status,
        "estimated_minutes": session.estimated_minutes,
        "started_at": session.started_at.isoformat(),
        "resume_position": session.current_position,
        "lesson_slug": lesson_slug,
        "lesson_title": lesson_title,
        "items": items_payload
    }


@router.post(
    "/sessions/{session_id}/progress",
    status_code=status.HTTP_200_OK,
    summary="Update learner position in unified session stream without attempt mutations"
)
async def update_session_progress(
    session_id: uuid.UUID,
    payload: SessionProgressRequest,
    user_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db)
):
    target_user_id = user_id or DEFAULT_DEMO_USER_ID
    stmt = (
        select(LearningSession)
        .where(
            LearningSession.id == session_id,
            LearningSession.user_id == target_user_id
        )
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Learning session not found")
    if session.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Learning session is not active")

    session.current_position = payload.position
    await db.commit()
    return {
        "session_id": str(session.id),
        "current_position": session.current_position,
        "status": session.status,
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


@router.get("/media/{asset_id}", summary="Resolve media asset URL publicly for learners")
async def resolve_media_for_learner(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(MediaAsset).where(MediaAsset.id == asset_id)
    res = await db.execute(stmt)
    asset = res.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="MEDIA_ASSET_NOT_FOUND")
    return {
        "id": str(asset.id),
        "media_asset_id": str(asset.id),
        "filename": asset.filename,
        "url": asset.url,
        "alt_text": asset.alt_text,
        "caption": asset.caption,
    }

