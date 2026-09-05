import uuid
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_jwt_token, validate_origin_and_csrf
from app.services.content_service import ContentService
from app.models.lesson import Lesson, LessonVersion
from app.models.user import User
from app.models.content_review import AuditLog
from app.schemas.curriculum_contract import (
    LessonExecutionContract,
    SafeActivityCard,
    LessonStatus,
    InteractionType,
    RendererType,
    EvidenceRole,
    DataProvenance,
)

router = APIRouter()

DEFAULT_ADMIN_USER_ID = uuid.UUID("b0370776-dcc9-449a-8bbb-b4d0cf9e9494")


def get_admin_actor(request: Request, allowed_roles: Optional[list] = None) -> tuple[uuid.UUID, str]:
    if allowed_roles is None:
        allowed_roles = ["CONTENT_EDITOR", "SUPER_ADMIN", "ADMIN"]
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        if settings.ENVIRONMENT == "development":
            return DEFAULT_ADMIN_USER_ID, "SUPER_ADMIN"
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    try:
        token = auth_header.split(" ")[1]
        payload = verify_jwt_token(token)
        actor_id = uuid.UUID(payload["sub"])
        role = payload.get("role", "LEARNER")
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"FORBIDDEN_ROLE: Requires one of {allowed_roles}.")
        return actor_id, role
    except HTTPException:
        raise
    except Exception as e:
        if settings.ENVIRONMENT == "development":
            return DEFAULT_ADMIN_USER_ID, "SUPER_ADMIN"
        raise HTTPException(status_code=401, detail=f"INVALID_TOKEN: {str(e)}")

class StatusTransitionRequest(BaseModel):
    new_status: str
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None

class DraftUpdateRequest(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    duration_minutes: Optional[int] = None
    learning_objectives: Optional[list] = None
    concept_ids: Optional[list] = None
    prerequisite_ids: Optional[list] = None
    why_this_matters: Optional[str] = None
    after_lesson_capabilities: Optional[list] = None
    blocks: Optional[list] = None
    blocks_json: Optional[list] = None
    questions: Optional[list] = None
    expected_version: Optional[int] = None

class EmergencyPublishRequest(BaseModel):
    step_up_token: str
    reason: str
    idempotency_key: Optional[str] = None

@router.post("/admin/lessons/draft")
async def create_draft(
    lesson_data: Dict[str, Any],
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    validate_origin_and_csrf(request)
    creator_id, role = get_admin_actor(request, ["CONTENT_EDITOR", "SUPER_ADMIN", "ADMIN"])

    try:
        draft = await ContentService.create_lesson_draft(db, lesson_data, creator_id)
        await db.commit()
        return {
            "status": "SUCCESS",
            "version_id": str(draft.id),
            "lesson_id": str(draft.lesson_id),
            "version_number": draft.version_number,
            "lesson_status": draft.status
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"DRAFT_CREATION_FAILED: {str(e)}")


@router.patch("/admin/lessons/draft/{version_id}")
async def update_draft(
    version_id: uuid.UUID,
    req: DraftUpdateRequest,
    request: Request,
    if_match: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    validate_origin_and_csrf(request)
    actor_id, role = get_admin_actor(request, ["CONTENT_EDITOR", "SUPER_ADMIN", "ADMIN"])

    expected_version = req.expected_version
    if expected_version is None and if_match:
        try:
            expected_version = int(if_match.strip('"').replace("v", "").replace("version-", ""))
        except ValueError:
            pass

    try:
        updated_version = await ContentService.update_lesson_draft(
            session=db,
            version_id=version_id,
            update_data=req.model_dump(exclude_unset=True),
            actor_id=actor_id,
            expected_version=expected_version
        )
        await db.commit()
        return {
            "status": "SUCCESS",
            "version_id": str(updated_version.id),
            "version_number": updated_version.version_number,
            "lesson_status": updated_version.status
        }
    except ValueError as ve:
        await db.rollback()
        err_msg = str(ve)
        if "DRAFT_OCC_CONFLICT" in err_msg:
            raise HTTPException(status_code=409, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"DRAFT_UPDATE_FAILED: {str(e)}")


@router.get("/admin/lessons/draft/{version_id}")
async def get_draft_details(
    version_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns full authoring draft payload, blocks, objectives, concepts, OCC version, and status.
    """
    v_stmt = select(LessonVersion).where(LessonVersion.id == version_id)
    v_res = await db.execute(v_stmt)
    version = v_res.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="LESSON_VERSION_NOT_FOUND")

    l_stmt = select(Lesson).where(Lesson.id == version.lesson_id)
    l_res = await db.execute(l_stmt)
    lesson = l_res.scalar_one()

    # Query reviews for this version from AuditLog
    rev_stmt = (
        select(AuditLog)
        .where(
            AuditLog.resource_id == str(version_id),
            AuditLog.action.startswith("LESSON_VERSION_")
        )
        .order_by(AuditLog.created_at.desc())
    )
    rev_res = await db.execute(rev_stmt)
    reviews = [
        {
            "id": str(r.id),
            "reviewer_id": str(r.actor_id),
            "review_role": r.reason or "CONTENT_REVIEWER",
            "status": "APPROVED" if "APPROVED" in r.action else "REJECTED",
            "notes": (r.new_state or {}).get("notes", ""),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rev_res.scalars().all()
    ]

    return {
        "id": str(lesson.id),
        "lesson_id": str(lesson.id),
        "slug": lesson.slug,
        "domain": lesson.domain,
        "level": lesson.level,
        "version_id": str(version.id),
        "version_number": version.version_number,
        "title": version.title,
        "duration_minutes": version.duration_minutes,
        "learning_objectives": version.learning_objectives or [],
        "concept_ids": version.concept_ids or [],
        "prerequisite_ids": version.prerequisite_ids or [],
        "blocks": version.blocks_json or [],
        "questions": version.questions_json or [],
        "status": version.status,
        "reviews": reviews,
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }


@router.get("/admin/lessons/preview/{version_id}", response_model=LessonExecutionContract)
async def preview_lesson_draft(
    version_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Dedicated read-only preview contract for Content Studio.
    Enforces pure preview context: no mastery mutations, no learner attempts.
    """
    actor_id, role = get_admin_actor(request, ["CONTENT_EDITOR", "SUPER_ADMIN", "CONTENT_REVIEWER", "FINANCE_REVIEWER", "COMPLIANCE_REVIEWER", "ADMIN"])

    v_stmt = select(LessonVersion).where(LessonVersion.id == version_id)
    v_res = await db.execute(v_stmt)
    version = v_res.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="LESSON_VERSION_NOT_FOUND")

    l_stmt = select(Lesson).where(Lesson.id == version.lesson_id)
    l_res = await db.execute(l_stmt)
    lesson = l_res.scalar_one()

    # Convert authoring blocks to SafeActivityCard list for preview
    safe_cards = []
    for idx, b in enumerate(version.blocks_json or []):
        card_id = b.get("id", f"preview-card-{idx+1}")
        act_type_str = b.get("type", "OBSERVE").upper()
        try:
            act_type = InteractionType[act_type_str]
        except KeyError:
            act_type = InteractionType.OBSERVE

        renderer_str = b.get("renderer", "CANDLESTICK").upper()
        try:
            renderer = RendererType[renderer_str]
        except KeyError:
            renderer = RendererType.CANDLESTICK

        ev_role_str = b.get("evidence_role", "NONE").upper()
        try:
            ev_role = EvidenceRole[ev_role_str]
        except KeyError:
            ev_role = EvidenceRole.NONE

        safe_cards.append(SafeActivityCard(
            id=card_id,
            activity_type=act_type,
            renderer=renderer,
            evidence_role=ev_role,
            title=b.get("title", f"Step {idx+1}"),
            prompt=b.get("prompt"),
            payload=b.get("payload") or b.get("content") or {},
            options=[{"id": o["id"], "text": o["text"]} for o in b.get("options", []) if "id" in o and "text" in o] if b.get("options") else None,
            provenance=DataProvenance(**b["provenance"]) if b.get("provenance") else None
        ))

    return LessonExecutionContract(
        schema_version="1.0",
        id=lesson.id,
        slug=lesson.slug,
        title=version.title,
        duration_minutes=version.duration_minutes,
        learning_objectives=version.learning_objectives or [],
        concept_slugs=version.concept_ids or [],
        prerequisites=version.prerequisite_ids or [],
        why_this_matters="Live Admin Preview Context (Zero mutations)",
        after_lesson_capabilities=["Demonstrate understanding in production."],
        activities_preview=[c.title for c in safe_cards],
        cards=safe_cards,
        is_unlocked=True,
        status=LessonStatus.AVAILABLE
    )


@router.post("/admin/lessons/{version_id}/transition")
async def transition_status(
    version_id: uuid.UUID,
    req: StatusTransitionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    validate_origin_and_csrf(request)
    actor_id, actor_role = get_admin_actor(request, ["CONTENT_EDITOR", "SUPER_ADMIN", "ADMIN", "CONTENT_REVIEWER", "FINANCE_REVIEWER", "COMPLIANCE_REVIEWER"])

    try:
        updated_version = await ContentService.transition_version_status(
            session=db,
            version_id=version_id,
            new_status=req.new_status,
            actor_id=actor_id,
            actor_role=actor_role,
            notes=req.notes,
            idempotency_key=req.idempotency_key
        )
        await db.commit()
        return {
            "status": "SUCCESS",
            "version_id": str(updated_version.id),
            "new_status": updated_version.status
        }
    except ValueError as ve:
        await db.rollback()
        err_msg = str(ve)
        if "IDEMPOTENCY_KEY_CONFLICT" in err_msg or "DRAFT_OCC_CONFLICT" in err_msg:
            raise HTTPException(status_code=409, detail=err_msg)
        if "CONTENT_COMPLETENESS_FAILED" in err_msg:
            raise HTTPException(status_code=422, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"TRANSITION_FAILED: {str(e)}")


class LessonReviewRequest(BaseModel):
    review_role: str  # CONTENT_REVIEWER, FINANCE_REVIEWER, COMPLIANCE_REVIEWER
    status: str       # APPROVED, CHANGES_REQUESTED
    notes: Optional[str] = None
    structured_comments: Optional[list] = None
    idempotency_key: Optional[str] = None


@router.post("/admin/lessons/{version_id}/review")
async def submit_lesson_review(
    version_id: uuid.UUID,
    req: LessonReviewRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Submits an authoritative review (approve or request changes with structured comments).
    """
    validate_origin_and_csrf(request)
    reviewer_id, actor_role = get_admin_actor(request, ["CONTENT_REVIEWER", "FINANCE_REVIEWER", "COMPLIANCE_REVIEWER", "SUPER_ADMIN", "ADMIN"])

    effective_role = req.review_role if actor_role == "SUPER_ADMIN" else actor_role

    v_stmt = select(LessonVersion).where(LessonVersion.id == version_id)
    v_res = await db.execute(v_stmt)
    version = v_res.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="LESSON_VERSION_NOT_FOUND")

    action_name = f"LESSON_VERSION_{req.status}"
    review_record = AuditLog(
        id=uuid.uuid4(),
        actor_id=reviewer_id,
        action=action_name,
        resource_type="LessonVersion",
        resource_id=str(version_id),
        reason=effective_role,
        new_state={"status": req.status, "notes": req.notes or (str(req.structured_comments) if req.structured_comments else "Review submitted")},
    )
    db.add(review_record)

    # If approved, transition version to APPROVED
    if req.status == "APPROVED":
        version.status = "APPROVED"

    await db.commit()
    return {
        "status": "SUCCESS",
        "review_id": str(review_record.id),
        "review_role": effective_role,
        "review_status": req.status,
        "version_status": version.status,
    }



@router.get("/admin/reviews/pending")
async def get_pending_reviews(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all lesson drafts awaiting review across Editor, Finance, and Compliance pipelines.
    """
    stmt = select(LessonVersion, Lesson).join(Lesson, LessonVersion.lesson_id == Lesson.id).where(
        LessonVersion.status.in_(["EDITOR_REVIEW", "FINANCE_REVIEW", "COMPLIANCE_REVIEW"])
    ).order_by(LessonVersion.created_at.desc())
    res = await db.execute(stmt)

    pending = []
    for lv, l in res.all():
        pending.append({
            "lesson_id": str(l.id),
            "slug": l.slug,
            "version_id": str(lv.id),
            "version_number": lv.version_number,
            "title": lv.title,
            "status": lv.status,
            "created_at": lv.created_at.isoformat() if lv.created_at else None,
        })
    return {"pending_reviews": pending}


@router.post("/admin/lessons/{version_id}/emergency-publish")
async def emergency_publish(
    version_id: uuid.UUID,
    req: EmergencyPublishRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    validate_origin_and_csrf(request)
    actor_id, actor_role = get_admin_actor(request, ["SUPER_ADMIN"])

    # Verify single-use step-up MFA token
    step_up_payload = verify_jwt_token(req.step_up_token, expected_type="step_up")
    if step_up_payload.get("sub") != str(actor_id):
        raise HTTPException(status_code=401, detail="INVALID_STEP_UP_TOKEN_SUBJECT")

    try:
        updated_version = await ContentService.transition_version_status(
            session=db,
            version_id=version_id,
            new_status="PUBLISHED",
            actor_id=actor_id,
            actor_role="SUPER_ADMIN",
            notes=f"EMERGENCY_OVERRIDE: {req.reason}",
            idempotency_key=req.idempotency_key
        )
        await db.commit()
        return {
            "status": "SUCCESS",
            "message": "Lesson version emergency published successfully.",
            "version_id": str(updated_version.id)
        }
    except ValueError as ve:
        await db.rollback()
        err_msg = str(ve)
        if "IDEMPOTENCY_KEY_CONFLICT" in err_msg:
            raise HTTPException(status_code=409, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"EMERGENCY_PUBLISH_FAILED: {str(e)}")


@router.get("/admin/cohorts/summary", summary="Get aggregated learner & mastery metrics")
async def get_cohort_summary(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

    payload = verify_jwt_token(auth_header.split(" ")[1])
    actor_role = payload.get("role", "LEARNER")

    if actor_role not in ["PILOT_RESEARCHER", "SUPER_ADMIN", "ADMIN"]:
        raise HTTPException(status_code=403, detail="FORBIDDEN: Requires ADMIN role.")

    from app.models.progress import ConceptMastery
    from sqlalchemy import func
    total_learners = (await db.execute(select(func.count(User.id)).where(User.role == "LEARNER"))).scalar() or 0
    active_masteries = (await db.execute(select(func.count(ConceptMastery.id)))).scalar() or 0
    return {
        "total_learners": total_learners,
        "active_masteries": active_masteries,
        "status": "HEALTHY",
    }


import os
import io
import hashlib
from PIL import Image
from fastapi import UploadFile, File, Query
from app.models.media import MediaAsset

@router.post("/admin/media/upload", summary="Upload media asset with security validation and deduplication")
async def upload_media_asset(
    request: Request,
    file: UploadFile = File(...),
    alt_text: Optional[str] = None,
    caption: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    # 1. Role verification
    actor_id, actor_role = get_admin_actor(request, ["CONTENT_EDITOR", "SUPER_ADMIN", "ADMIN", "PUBLISHER"])

    # 2. File size validation (10 MB limit)
    contents = await file.read()
    max_size = 10 * 1024 * 1024
    if len(contents) > max_size:
        raise HTTPException(status_code=413, detail="FILE_TOO_LARGE: Max file size is 10MB.")

    # 3. Explicit rejection of SVG for security
    filename = file.filename or "upload.png"
    clean_ext = os.path.splitext(filename)[1].lower()
    if clean_ext in [".svg", ".svgz"] or file.content_type == "image/svg+xml":
        raise HTTPException(status_code=400, detail="SVG_DISABLED_FOR_SECURITY: SVG uploads are disabled.")

    # 4. Binary magic-byte header validation
    detected_mime = None
    if contents.startswith(b"\x89PNG\r\n\x1a\n"):
        detected_mime = "image/png"
    elif contents.startswith(b"\xff\xd8\xff"):
        detected_mime = "image/jpeg"
    elif contents.startswith(b"RIFF") and len(contents) >= 12 and contents[8:12] == b"WEBP":
        detected_mime = "image/webp"
    else:
        raise HTTPException(status_code=400, detail="INVALID_FILE_SIGNATURE: Only PNG, JPEG, and WebP are allowed.")

    # 5. Image Dimension & Integrity check via Pillow
    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()
        img = Image.open(io.BytesIO(contents))
        width, height = img.size
        if width > 4096 or height > 4096:
            raise HTTPException(status_code=400, detail="IMAGE_DIMENSIONS_TOO_LARGE: Max 4096x4096px.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=400, detail=f"CORRUPT_OR_UNREADABLE_IMAGE: {str(e)}")

    # 6. Checksum deduplication
    checksum = hashlib.sha256(contents).hexdigest()
    stmt = select(MediaAsset).where(MediaAsset.checksum == checksum)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        return {
            "id": str(existing.id),
            "media_asset_id": str(existing.id),
            "filename": existing.filename,
            "url": existing.url,
            "width": existing.width,
            "height": existing.height,
            "file_size_bytes": existing.file_size_bytes,
            "mime_type": existing.mime_type,
            "checksum": existing.checksum,
            "deduplicated": True,
        }

    # 7. Safe storage key & Path traversal protection
    storage_key = f"{uuid.uuid4().hex}{clean_ext}"
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../uploads/media"))
    os.makedirs(base_dir, exist_ok=True)
    target_path = os.path.abspath(os.path.join(base_dir, storage_key))
    if not target_path.startswith(base_dir):
        raise HTTPException(status_code=400, detail="PATH_TRAVERSAL_DETECTED")

    with open(target_path, "wb") as f:
        f.write(contents)

    # 8. Persist MediaAsset record
    valid_uploader_id = None
    if actor_id:
        user_exists = (await db.execute(select(User.id).where(User.id == actor_id))).scalar_one_or_none()
        if user_exists:
            valid_uploader_id = actor_id

    media_url = f"/uploads/media/{storage_key}"
    media_asset = MediaAsset(
        id=uuid.uuid4(),
        filename=filename,
        storage_provider="LOCAL",
        storage_key=storage_key,
        url=media_url,
        mime_type=detected_mime,
        file_size_bytes=len(contents),
        width=width,
        height=height,
        alt_text=alt_text or filename,
        caption=caption,
        checksum=checksum,
        uploaded_by=valid_uploader_id,
    )
    db.add(media_asset)
    await db.commit()
    await db.refresh(media_asset)

    return {
        "id": str(media_asset.id),
        "media_asset_id": str(media_asset.id),
        "filename": media_asset.filename,
        "url": media_asset.url,
        "width": media_asset.width,
        "height": media_asset.height,
        "file_size_bytes": media_asset.file_size_bytes,
        "mime_type": media_asset.mime_type,
        "checksum": media_asset.checksum,
        "deduplicated": False,
    }


@router.get("/admin/media", summary="List uploaded media assets for Media Library picker")
async def list_media_assets(
    request: Request,
    search: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(MediaAsset).order_by(MediaAsset.created_at.desc())
    if search:
        stmt = stmt.where(MediaAsset.filename.ilike(f"%{search}%"))
    stmt = stmt.limit(limit).offset(offset)
    res = await db.execute(stmt)
    assets = res.scalars().all()
    return {
        "media": [
            {
                "id": str(a.id),
                "media_asset_id": str(a.id),
                "filename": a.filename,
                "url": a.url,
                "width": a.width,
                "height": a.height,
                "file_size_bytes": a.file_size_bytes,
                "mime_type": a.mime_type,
                "checksum": a.checksum,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in assets
        ],
        "total": len(assets),
    }


@router.delete("/admin/lessons/{lesson_id}", summary="Delete a lesson and all its draft versions")
async def delete_lesson(
    lesson_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently deletes a lesson and all associated LessonVersion records.
    Rejects if any version has PUBLISHED status (use unpublish flow first).
    """
    validate_origin_and_csrf(request)
    actor_id, actor_role = get_admin_actor(request, ["CONTENT_EDITOR", "SUPER_ADMIN", "ADMIN"])

    l_stmt = select(Lesson).where(Lesson.id == lesson_id)
    l_res = await db.execute(l_stmt)
    lesson = l_res.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="LESSON_NOT_FOUND")

    # Check for published versions
    from sqlalchemy import delete as sql_delete
    v_stmt = select(LessonVersion).where(LessonVersion.lesson_id == lesson_id)
    v_res = await db.execute(v_stmt)
    versions = v_res.scalars().all()

    published = [v for v in versions if v.status == "PUBLISHED"]
    if published and actor_role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=409,
            detail="LESSON_HAS_PUBLISHED_VERSIONS: Cannot delete a lesson with published content. Use SUPER_ADMIN role or unpublish first."
        )

    # Audit log the deletion
    audit = AuditLog(
        id=uuid.uuid4(),
        actor_id=actor_id,
        action="LESSON_DELETED",
        resource_type="Lesson",
        resource_id=str(lesson_id),
        reason=f"Admin deletion by role {actor_role}",
        new_state={"deleted_versions": len(versions), "had_published": bool(published)},
    )
    db.add(audit)

    # Delete all versions then the lesson
    await db.execute(sql_delete(LessonVersion).where(LessonVersion.lesson_id == lesson_id))
    await db.execute(sql_delete(Lesson).where(Lesson.id == lesson_id))
    await db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Lesson '{lesson.title or lesson.slug}' and {len(versions)} version(s) deleted.",
        "lesson_id": str(lesson_id),
        "deleted_versions": len(versions),
    }


@router.delete("/admin/media/{asset_id}", summary="Delete a media asset record")
async def delete_media_asset(
    asset_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    validate_origin_and_csrf(request)
    actor_id, actor_role = get_admin_actor(request, ["CONTENT_EDITOR", "SUPER_ADMIN", "ADMIN"])

    from sqlalchemy import delete as sql_delete
    stmt = select(MediaAsset).where(MediaAsset.id == asset_id)
    res = await db.execute(stmt)
    asset = res.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="MEDIA_ASSET_NOT_FOUND")

    # Try to remove file from disk
    try:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../uploads/media"))
        target_path = os.path.abspath(os.path.join(base_dir, asset.storage_key))
        if target_path.startswith(base_dir) and os.path.exists(target_path):
            os.remove(target_path)
    except Exception:
        pass  # Best-effort file deletion

    await db.execute(sql_delete(MediaAsset).where(MediaAsset.id == asset_id))
    await db.commit()
    return {"status": "SUCCESS", "message": f"Media asset '{asset.filename}' deleted.", "asset_id": str(asset_id)}


@router.get("/admin/media/{asset_id}", summary="Resolve single media asset by canonical UUID")
async def get_media_asset(
    asset_id: uuid.UUID,
    request: Request,
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
        "width": asset.width,
        "height": asset.height,
        "file_size_bytes": asset.file_size_bytes,
        "mime_type": asset.mime_type,
        "checksum": asset.checksum,
        "alt_text": asset.alt_text,
        "caption": asset.caption,
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
    }



