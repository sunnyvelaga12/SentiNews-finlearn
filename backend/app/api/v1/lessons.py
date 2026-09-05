import uuid
import hashlib
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Response, status

logger = logging.getLogger("sentinews_learn.content")
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import verify_jwt_token, validate_origin_and_csrf
from app.core.config import settings
from app.models.lesson import Lesson, LessonVersion

router = APIRouter()

class PublishLessonRequest(BaseModel):
    version_id: uuid.UUID
    notes: Optional[str] = None

@router.get("/lessons")
async def get_published_lessons(db: AsyncSession = Depends(get_db)):
    """
    Fetches all published lessons directly from PostgreSQL.
    """
    stmt = select(Lesson).where(Lesson.current_version_id.isnot(None))
    res = await db.execute(stmt)
    lessons = res.scalars().all()

    items = []
    for l in lessons:
        v_stmt = select(LessonVersion).where(LessonVersion.id == l.current_version_id)
        v_res = await db.execute(v_stmt)
        v = v_res.scalar_one_or_none()
        if v and v.status == "PUBLISHED":
            items.append({
                "id": str(l.id),
                "slug": l.slug,
                "domain": l.domain,
                "level": l.level,
                "title": v.title,
                "duration_minutes": v.duration_minutes,
                "concept_ids": v.concept_ids,
                "version_number": v.version_number
            })
    return {"lessons": items}

@router.get("/lessons/by-slug/{slug}")
async def get_published_lesson_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Learner-facing resolution endpoint reading 100% from PostgreSQL.
    """
    stmt = select(Lesson).where(Lesson.slug == slug)
    res = await db.execute(stmt)
    lesson = res.scalar_one_or_none()

    if not lesson or not lesson.current_version_id:
        raise HTTPException(status_code=404, detail="PUBLISHED_LESSON_NOT_FOUND")

    v_stmt = select(LessonVersion).where(LessonVersion.id == lesson.current_version_id)
    v_res = await db.execute(v_stmt)
    v = v_res.scalar_one()

    return {
        "id": str(lesson.id),
        "slug": lesson.slug,
        "domain": lesson.domain,
        "level": lesson.level,
        "version_id": str(v.id),
        "version_number": v.version_number,
        "title": v.title,
        "duration_minutes": v.duration_minutes,
        "learning_objectives": v.learning_objectives,
        "concept_ids": v.concept_ids,
        "blocks": v.blocks_json,
        "questions": v.questions_json
    }

@router.post("/lessons/{lesson_id}/publish")
async def publish_lesson_atomic(
    lesson_id: uuid.UUID,
    req: PublishLessonRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Executes publishing inside a single atomic database transaction.
    """
    validate_origin_and_csrf(request)
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

    payload = verify_jwt_token(auth_header.split(" ")[1])
    actor_id = uuid.UUID(payload["sub"])
    actor_role = payload.get("role", "LEARNER")

    # Environment-scoped role gate
    if settings.ENVIRONMENT in ("development", "test", "testing"):
        allowed_roles = ["PUBLISHER", "SUPER_ADMIN", "CONTENT_EDITOR", "ADMIN", "LEARNER"]
    else:
        allowed_roles = ["PUBLISHER", "SUPER_ADMIN"]
    if actor_role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"FORBIDDEN: Role '{actor_role}' cannot publish lessons in {settings.ENVIRONMENT} environment.")

    from app.services.content_service import ContentPublicationService

    try:
        result = await ContentPublicationService.publish_lesson_version(
            session=db,
            lesson_id=lesson_id,
            version_id=req.version_id,
            actor_id=actor_id,
            actor_role=actor_role,
            notes=req.notes
        )
        await db.commit()
        return result

    except ValueError as ve:
        await db.rollback()
        err_msg = str(ve)
        if "UNAUTHORIZED" in err_msg:
            raise HTTPException(status_code=403, detail=err_msg)
        if "NOT_FOUND" in err_msg:
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"ATOMIC_PUBLISH_FAILED: {str(e)}")

@router.post("/lessons/{lesson_id}/complete")
async def complete_lesson(
    lesson_id: str,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    PERMANENTLY DISABLED (P0 Security Gate):
    Client-authoritative lesson completion has been disabled.
    All interactive learning attempts must use the server-authoritative session pipeline:
    POST /api/v1/learning/sessions/{session_id}/activities/{activity_id}/attempts
    """
    logger.warning(
        "SECURITY_ALERT: Blocked call to disabled legacy endpoint POST /api/v1/lessons/{lesson_id}/complete",
        extra={"lesson_id": lesson_id}
    )
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="DEPRECATED_ENDPOINT_DISABLED: POST /api/v1/lessons/{id}/complete is permanently disabled. "
               "Interactive learning attempts must be submitted via the server-authoritative session pipeline at "
               "/api/v1/learning/sessions/{session_id}/activities/{activity_id}/attempts"
    )

