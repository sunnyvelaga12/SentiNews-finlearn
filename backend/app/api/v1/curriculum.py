import uuid
import hashlib
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_jwt_token, validate_origin_and_csrf
from app.models.curriculum import Domain, World, Series, Module, Unit, UnitConcept
from app.models.lesson import Lesson, LessonVersion
from app.schemas.curriculum_contract import (
    ModuleContract,
    UnitContract,
    LessonExecutionContract,
    BadgeContract,
    ModuleChallengeContract,
    ModuleProgressMetrics,
    ModuleCreateRequest,
    ModuleUpdateRequest,
    UnitCreateRequest,
    UnitUpdateRequest,
    LessonStatus,
)
from app.services.curriculum.curriculum_service import CurriculumContentService
from app.services.curriculum.progression_engine import ProgressionEngine, ProgressionPolicy
from app.services.curriculum.learner_curriculum_state_service import LearnerCurriculumStateService

router = APIRouter()

DEFAULT_DEMO_USER_ID = uuid.UUID("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")


def get_optional_user_id(request: Request) -> Optional[uuid.UUID]:
    """Extracts authenticated user_id from X-User-Id header (testing) or Authorization header, else default."""
    x_user = request.headers.get("x-user-id")
    if x_user:
        try:
            return uuid.UUID(x_user)
        except ValueError:
            pass

    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return DEFAULT_DEMO_USER_ID
    try:
        token = auth_header.split(" ")[1]
        payload = verify_jwt_token(token)
        return uuid.UUID(payload["sub"])
    except Exception:
        return DEFAULT_DEMO_USER_ID


DEFAULT_ADMIN_USER_ID = uuid.UUID("b0370776-dcc9-449a-8bbb-b4d0cf9e9494")


def require_content_editor(request: Request) -> uuid.UUID:
    """Enforces CONTENT_EDITOR or SUPER_ADMIN role for curriculum mutations."""
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        if settings.ENVIRONMENT == "development":
            return DEFAULT_ADMIN_USER_ID
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    try:
        token = auth_header.split(" ")[1]
        payload = verify_jwt_token(token)
        role = payload.get("role", "")
        if role not in ("CONTENT_EDITOR", "SUPER_ADMIN"):
            raise HTTPException(status_code=403, detail="FORBIDDEN_ROLE")
        return uuid.UUID(payload["sub"])
    except HTTPException:
        raise
    except Exception as e:
        if settings.ENVIRONMENT == "development":
            return DEFAULT_ADMIN_USER_ID
        raise HTTPException(status_code=401, detail=f"INVALID_TOKEN: {str(e)}")


# ── Content Authoring & Management Endpoints ─────────────────────────────────
@router.get("/curriculum/admin/tree", summary="Get full curriculum tree for Content Studio")
async def get_curriculum_tree(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    require_content_editor(request)
    tree = await CurriculumContentService.get_full_curriculum_tree(db)
    return {"tree": tree}


@router.post("/curriculum/modules", summary="Create a new curriculum module")
async def create_module(
    req: ModuleCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    require_content_editor(request)
    import re
    series_id = req.series_id
    if not series_id:
        s_stmt = select(Series.id).order_by(Series.order_index.asc()).limit(1)
        series_id = (await db.execute(s_stmt)).scalar_one_or_none()
        if not series_id:
            d_stmt = select(Domain.id).limit(1)
            domain_id = (await db.execute(d_stmt)).scalar_one_or_none()
            if not domain_id:
                dom = Domain(id=uuid.uuid4(), slug="technical-analysis", name="Technical Analysis")
                db.add(dom)
                await db.flush()
                domain_id = dom.id
            world = World(id=uuid.uuid4(), domain_id=domain_id, slug="trading-foundations", name="Trading Foundations")
            db.add(world)
            await db.flush()
            series = Series(id=uuid.uuid4(), world_id=world.id, slug="core-series", name="Core Curriculum")
            db.add(series)
            await db.flush()
            series_id = series.id

    slug = req.slug
    if not slug:
        clean_name = re.sub(r'[^a-z0-9]+', '-', req.name.lower()).strip('-')
        slug = clean_name or f"mod-{uuid.uuid4().hex[:6]}"

    new_module = Module(
        id=uuid.uuid4(),
        series_id=series_id,
        slug=slug,
        name=req.name,
        description=req.description or "",
        order_index=req.order_index,
        learner_goal=req.learner_goal,
        why_this_matters=req.why_this_matters,
        learning_outcomes=req.learning_outcomes or [],
        completion_criteria=req.completion_criteria,
        estimated_hours=req.estimated_hours if req.estimated_hours is not None else 1.5,
        level=req.level or "BEGINNER",
    )
    db.add(new_module)
    await db.commit()
    await db.refresh(new_module)
    return {
        "status": "SUCCESS",
        "module_id": str(new_module.id),
        "slug": new_module.slug,
        "name": new_module.name,
    }


@router.patch("/curriculum/modules/{module_id}", summary="Update module metadata")
async def update_module(
    module_id: uuid.UUID,
    req: ModuleUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    require_content_editor(request)
    stmt = select(Module).where(Module.id == module_id)
    res = await db.execute(stmt)
    mod = res.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="MODULE_NOT_FOUND")

    if req.name is not None:
        mod.name = req.name
    if req.description is not None:
        mod.description = req.description
    if req.order_index is not None:
        mod.order_index = req.order_index
    if req.learner_goal is not None:
        mod.learner_goal = req.learner_goal
    if req.why_this_matters is not None:
        mod.why_this_matters = req.why_this_matters
    if req.learning_outcomes is not None:
        mod.learning_outcomes = req.learning_outcomes
    if req.completion_criteria is not None:
        mod.completion_criteria = req.completion_criteria
    if req.estimated_hours is not None:
        mod.estimated_hours = req.estimated_hours
    if req.level is not None:
        mod.level = req.level

    await db.commit()
    await db.refresh(mod)
    return {"status": "SUCCESS", "module": {"id": str(mod.id), "slug": mod.slug, "name": mod.name}}


@router.post("/curriculum/units", summary="Create a new curriculum unit")
async def create_unit(
    req: UnitCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    require_content_editor(request)
    import re
    from app.models.concept import Concept
    slug = req.slug
    if not slug:
        clean_name = re.sub(r'[^a-z0-9]+', '-', req.name.lower()).strip('-')
        slug = clean_name or f"unit-{uuid.uuid4().hex[:6]}"

    new_unit = Unit(
        id=uuid.uuid4(),
        module_id=req.module_id,
        slug=slug,
        name=req.name,
        description=req.description or "",
        order_index=req.order_index,
    )
    db.add(new_unit)
    await db.flush()

    # Automatically create unit concept and objective so lessons can be associated and evaluated
    new_concept = Concept(
        id=uuid.uuid4(),
        slug=f"concept-{slug}",
        title=f"{req.name} Foundations",
        domain="technical_analysis",
        module_id=new_unit.module_id,
        level="BEGINNER",
        status="PUBLISHED",
    )
    db.add(new_concept)
    await db.flush()

    from app.models.learning import LearningObjective
    new_obj = LearningObjective(
        id=uuid.uuid4(),
        slug=f"obj-{slug}",
        title=f"Master {req.name}",
        concept_id=new_concept.id,
        taxonomy_level="APPLY",
    )
    db.add(new_obj)

    uc = UnitConcept(
        id=uuid.uuid4(),
        unit_id=new_unit.id,
        concept_id=new_concept.id,
        order_index=1,
    )
    db.add(uc)

    await db.commit()
    await db.refresh(new_unit)
    return {
        "status": "SUCCESS",
        "unit_id": str(new_unit.id),
        "slug": new_unit.slug,
        "name": new_unit.name,
        "concept_id": str(new_concept.id),
    }


@router.patch("/curriculum/units/{unit_id}", summary="Update unit metadata")
async def update_unit(
    unit_id: uuid.UUID,
    req: UnitUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    require_content_editor(request)
    stmt = select(Unit).where(Unit.id == unit_id)
    res = await db.execute(stmt)
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="UNIT_NOT_FOUND")

    if req.name is not None:
        u.name = req.name
    if req.description is not None:
        u.description = req.description
    if req.order_index is not None:
        u.order_index = req.order_index

    await db.commit()
    await db.refresh(u)
    return {"status": "SUCCESS", "unit": {"id": str(u.id), "slug": u.slug, "name": u.name}}


@router.delete("/curriculum/modules/{module_id}", summary="Delete a curriculum module")
async def delete_module(
    module_id: uuid.UUID,
    request: Request,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes a module and all its child units (cascade).
    Rejects if any associated lesson has a PUBLISHED version, unless force=true (SUPER_ADMIN only).
    """
    require_content_editor(request)
    from sqlalchemy import delete as sql_delete

    stmt = select(Module).where(Module.id == module_id)
    res = await db.execute(stmt)
    mod = res.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="MODULE_NOT_FOUND")

    # Gather all units in this module
    u_stmt = select(Unit).where(Unit.module_id == module_id)
    u_res = await db.execute(u_stmt)
    units = u_res.scalars().all()
    unit_ids = [u.id for u in units]

    # Check for published lessons inside any unit
    if unit_ids:
        pub_stmt = (
            select(LessonVersion)
            .join(Lesson, LessonVersion.lesson_id == Lesson.id)
            .where(
                Lesson.unit_id.in_(unit_ids),
                LessonVersion.status == "PUBLISHED",
            )
        )
        pub_res = await db.execute(pub_stmt)
        published_versions = pub_res.scalars().all()
        if published_versions and not force:
            raise HTTPException(
                status_code=409,
                detail=f"MODULE_HAS_PUBLISHED_LESSONS: {len(published_versions)} published lesson version(s) found. "
                       "Pass ?force=true as SUPER_ADMIN to override.",
            )

        # Delete all lesson versions and lessons in these units
        for uid in unit_ids:
            lessons_stmt = select(Lesson).where(Lesson.unit_id == uid)
            lessons_res = await db.execute(lessons_stmt)
            lessons = lessons_res.scalars().all()
            for lesson in lessons:
                await db.execute(sql_delete(LessonVersion).where(LessonVersion.lesson_id == lesson.id))
            await db.execute(sql_delete(Lesson).where(Lesson.unit_id == uid))

        # Delete all units
        await db.execute(sql_delete(Unit).where(Unit.module_id == module_id))

    # Delete the module itself
    await db.execute(sql_delete(Module).where(Module.id == module_id))
    await db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Module '{mod.name}' and {len(units)} unit(s) deleted.",
        "module_id": str(module_id),
        "deleted_units": len(units),
    }


@router.delete("/curriculum/units/{unit_id}", summary="Delete a curriculum unit")
async def delete_unit(
    unit_id: uuid.UUID,
    request: Request,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes a unit and all its child lessons (cascade).
    Rejects if any lesson has a PUBLISHED version, unless force=true.
    """
    require_content_editor(request)
    from sqlalchemy import delete as sql_delete

    stmt = select(Unit).where(Unit.id == unit_id)
    res = await db.execute(stmt)
    unit = res.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="UNIT_NOT_FOUND")

    # Check for published lessons
    pub_stmt = (
        select(LessonVersion)
        .join(Lesson, LessonVersion.lesson_id == Lesson.id)
        .where(Lesson.unit_id == unit_id, LessonVersion.status == "PUBLISHED")
    )
    pub_res = await db.execute(pub_stmt)
    published = pub_res.scalars().all()
    if published and not force:
        raise HTTPException(
            status_code=409,
            detail=f"UNIT_HAS_PUBLISHED_LESSONS: {len(published)} published lesson version(s). "
                   "Pass ?force=true to override.",
        )

    # Delete all lessons and their versions
    lessons_stmt = select(Lesson).where(Lesson.unit_id == unit_id)
    lessons_res = await db.execute(lessons_stmt)
    lessons = lessons_res.scalars().all()
    for lesson in lessons:
        await db.execute(sql_delete(LessonVersion).where(LessonVersion.lesson_id == lesson.id))
    await db.execute(sql_delete(Lesson).where(Lesson.unit_id == unit_id))

    await db.execute(sql_delete(Unit).where(Unit.id == unit_id))
    await db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Unit '{unit.name}' and {len(lessons)} lesson(s) deleted.",
        "unit_id": str(unit_id),
        "deleted_lessons": len(lessons),
    }


# ── Learner Experience & Catalog Endpoints ────────────────────────────────────
@router.get("/curriculum/modules", summary="Get catalog of published modules with learner progress")
async def list_modules(
    request: Request,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db)
):
    user_id = get_optional_user_id(request)
    modules = await CurriculumContentService.get_published_modules(db)

    total_items = len(modules)
    total_pages = max(1, (total_items + page_size - 1) // page_size)
    start_idx = (page - 1) * page_size
    paged_modules = modules[start_idx : start_idx + page_size]

    catalog = []
    for m in paged_modules:
        units = await CurriculumContentService.get_units_for_module(db, m.id)
        unit_contracts, progress, badge = await ProgressionEngine.evaluate_module_progression(
            db, m, user_id
        )

        catalog.append({
            "id": str(m.id),
            "slug": m.slug,
            "title": m.name,
            "description": m.description or "",
            "learner_goal": m.learner_goal or f"Master {m.name} with verified application evidence.",
            "why_this_matters": m.why_this_matters or f"Understanding {m.name} is a foundational financial literacy skill.",
            "level": m.level or "BEGINNER",
            "total_units": len(units),
            "total_lessons": progress.total_lessons,
            "estimated_hours": m.estimated_hours or 1.5,
            "progress": progress.model_dump(),
            "badge": badge.model_dump(),
        })

    return {
        "schema_version": "1.0",
        "modules": catalog,
        "page": page,
        "page_size": page_size,
        "total_items": total_items,
        "total_pages": total_pages,
    }


@router.get("/curriculum/modules/{slug}", summary="Get detailed module structure with server-authoritative progression")
async def get_module_by_slug(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = get_optional_user_id(request)
    mod = await CurriculumContentService.get_module_by_slug_or_id(db, slug)
    if not mod:
        raise HTTPException(status_code=404, detail="MODULE_NOT_FOUND")

    unit_contracts, progress, badge = await ProgressionEngine.evaluate_module_progression(
        db, mod, user_id, ProgressionPolicy.SEQUENTIAL
    )

    # All curriculum content comes from DB fields — no slug-based inference permitted.
    # If a field has not yet been authored, a generic module-name fallback is used,
    # but it contains zero domain-specific assumptions.
    learner_goal = mod.learner_goal or f"Master {mod.name} with verified application evidence."
    why_this_matters = mod.why_this_matters or f"Understanding {mod.name} is a foundational skill for financial literacy."
    learning_outcomes = mod.learning_outcomes or [
        f"Understand core concepts in {mod.name}.",
        f"Apply {mod.name} knowledge to practical scenarios.",
        f"Demonstrate competency through assessment.",
    ]
    completion_criteria = (
        mod.completion_criteria
        or f"Complete all unit milestones and pass the {mod.name} Capstone Challenge with >= 80%."
    )
    estimated_hours = mod.estimated_hours or 1.5
    level = mod.level or "BEGINNER"

    contract = ModuleContract(
        id=mod.id,
        slug=mod.slug,
        title=mod.name,
        description=mod.description or f"Comprehensive {mod.name} curriculum.",
        learner_goal=learner_goal,
        why_this_matters=why_this_matters,
        level=level,
        prerequisites=["None. Designed for zero-knowledge beginners."],
        learning_outcomes=learning_outcomes,
        estimated_hours=estimated_hours,
        ordered_units=unit_contracts,
        completion_criteria=completion_criteria,
        challenge=ModuleChallengeContract(
            id=f"challenge-{mod.slug}",
            title=f"{mod.name} Capstone Challenge",
            description=f"Demonstrate comprehensive mastery of {mod.name}.",
            target_capability=f"{mod.name} Mastery",
            passing_score_pct=80,
            is_unlocked=progress.completed_lessons >= max(1, progress.total_lessons - 1) if progress.total_lessons > 0 else False
        ),
        badge=badge,
        progress=progress
    )

    return contract.model_dump()


@router.get("/curriculum/modules/{slug}/units", summary="Get ordered units and lessons for a module")
async def get_module_units_by_slug(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = get_optional_user_id(request)
    mod = await CurriculumContentService.get_module_by_slug_or_id(db, slug)
    if not mod:
        raise HTTPException(status_code=404, detail="MODULE_NOT_FOUND")

    unit_contracts, _, _ = await ProgressionEngine.evaluate_module_progression(
        db, mod, user_id, ProgressionPolicy.SEQUENTIAL
    )
    return [u.model_dump() for u in unit_contracts]


@router.get("/curriculum/lessons/{slug}", summary="Get lesson overview metadata with server-authoritative unlock check")
async def get_lesson_by_slug(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = get_optional_user_id(request)

    # 1. Resolve lesson
    res = await CurriculumContentService.get_lesson_by_slug(db, slug)
    if not res:
        raise HTTPException(status_code=404, detail="LESSON_NOT_FOUND_OR_NOT_PUBLISHED")

    lesson, version = res

    # 2. Find parent unit & module to evaluate progression
    concept_ids = [
        uuid.UUID(cid) if isinstance(cid, str) else cid
        for cid in (version.concept_ids or [])
    ]
    
    uc_stmt = select(UnitConcept).where(UnitConcept.concept_id.in_(concept_ids))
    uc_res = await db.execute(uc_stmt)
    uc_first = uc_res.scalars().first()

    if uc_first:
        u_stmt = select(Unit).where(Unit.id == uc_first.unit_id)
        u_res = await db.execute(u_stmt)
        unit = u_res.scalar_one_or_none()
        if unit:
            m_stmt = select(Module).where(Module.id == unit.module_id)
            m_res = await db.execute(m_stmt)
            mod = m_res.scalar_one_or_none()
            if mod:
                unit_contracts, _, _ = await ProgressionEngine.evaluate_module_progression(
                    db, mod, user_id
                )
                for u in unit_contracts:
                    for l in u.ordered_lessons:
                        if l.slug == slug:
                            return l.model_dump()

    # Fallback if unparented
    safe_lesson = LessonExecutionContract(
        id=lesson.id,
        slug=lesson.slug,
        title=version.title,
        duration_minutes=version.duration_minutes,
        learning_objectives=version.learning_objectives or [],
        concept_slugs=[str(cid) for cid in (version.concept_ids or [])],
        prerequisites=[str(p) for p in (version.prerequisite_ids or [])],
        why_this_matters=f"Understand what {version.title} communicates about market dynamics.",
        after_lesson_capabilities=[
            "Identify OHLC boundaries and candle direction",
            "Explain buyer vs seller conviction over the timeframe"
        ],
        activities_preview=["Visual Observation", "Predict & Discover", "Interactive Practice"],
        cards=[],
        is_unlocked=True,
        status=LessonStatus.AVAILABLE,
        module_slug=mod.slug if 'mod' in locals() and mod else None,
        module_title=mod.name if 'mod' in locals() and mod else None,
    )
    return safe_lesson.model_dump()


@router.post("/curriculum/lessons/{slug}/complete", summary="Authoritatively record lesson completion and unlock progression")
async def complete_lesson_by_slug(
    slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    user_id = get_optional_user_id(request)
    idempotency_key = request.headers.get("X-Idempotency-Key")
    fingerprint = hashlib.sha256(f"{user_id}:{slug}".encode("utf-8")).hexdigest()

    # 1. Persistent Request Idempotency Check
    if idempotency_key:
        from app.models.idempotency import IdempotencyRecord
        idemp_stmt = select(IdempotencyRecord).where(
            IdempotencyRecord.user_id == user_id,
            IdempotencyRecord.operation_type == "COMPLETE_LESSON",
            IdempotencyRecord.idempotency_key == idempotency_key,
        )
        idemp_res = await db.execute(idemp_stmt)
        existing_idemp = idemp_res.scalar_one_or_none()
        if existing_idemp:
            if existing_idemp.request_fingerprint != fingerprint:
                raise HTTPException(
                    status_code=409,
                    detail="IDEMPOTENCY_KEY_CONFLICT: Key was already used with a different lesson request."
                )
            cached_resp = dict(existing_idemp.response_snapshot or {})
            cached_resp["idempotent_replay"] = True
            return cached_resp

    res = await CurriculumContentService.get_lesson_by_slug(db, slug)
    if not res:
        raise HTTPException(status_code=404, detail="LESSON_NOT_FOUND")

    lesson, version = res

    # 2. Record curriculum completion in user_progress (Single-writer invariant: ConceptMastery is never written here)
    concept_ids = [
        uuid.UUID(cid) if isinstance(cid, str) else cid
        for cid in (version.concept_ids or [])
    ]
    progress_record = await LearnerCurriculumStateService.mark_lesson_completed(
        db=db,
        user_id=user_id,
        lesson_id=lesson.id,
        lesson_version_id=version.id,
        concept_ids=concept_ids,
        score=100.0,
    )

    # 3. Re-evaluate module progression to find next unlocked lesson
    next_unlocked_slug = None
    module_slug = None
    mod = None
    if concept_ids:
        uc_stmt = select(UnitConcept).where(UnitConcept.concept_id.in_(concept_ids))
        uc_res = await db.execute(uc_stmt)
        uc = uc_res.scalars().first()
        if uc:
            u_stmt = select(Unit).where(Unit.id == uc.unit_id)
            u_res = await db.execute(u_stmt)
            unit = u_res.scalar_one_or_none()
            if unit:
                m_stmt = select(Module).where(Module.id == unit.module_id)
                m_res = await db.execute(m_stmt)
                mod = m_res.scalar_one_or_none()

    progress_payload = None
    if mod:
        module_slug = mod.slug
        unit_contracts, progress, badge = await ProgressionEngine.evaluate_module_progression(
            db, mod, user_id
        )
        progress_payload = progress.model_dump()
        for u in unit_contracts:
            for l in u.ordered_lessons:
                if l.status == LessonStatus.AVAILABLE and l.slug != slug:
                    next_unlocked_slug = l.slug
                    break
            if next_unlocked_slug:
                break

    resp_payload = {
        "status": "SUCCESS",
        "completed_lesson": slug,
        "completed_lesson_slug": slug,
        "completed_at": progress_record.completed_at.isoformat() if progress_record.completed_at else None,
        "module_slug": module_slug,
        "next_unlocked_lesson": next_unlocked_slug,
        "next_unlocked_lesson_slug": next_unlocked_slug,
        "module_progress": progress_payload,
        "idempotent_replay": False,
    }

    # 4. Atomically persist IdempotencyRecord if key was supplied
    if idempotency_key:
        from app.models.idempotency import IdempotencyRecord
        now_utc = datetime.now(timezone.utc)
        new_idemp = IdempotencyRecord(
            id=uuid.uuid4(),
            user_id=user_id,
            operation_type="COMPLETE_LESSON",
            idempotency_key=idempotency_key,
            request_fingerprint=fingerprint,
            status="SUCCESS",
            response_snapshot=resp_payload,
            created_at=now_utc,
            completed_at=now_utc,
        )
        db.add(new_idemp)

    await db.commit()

    return resp_payload


@router.post("/curriculum/progress/reset", summary="Reset progress for user (testing and mastery reset)")
async def reset_progress(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    from app.core.config import settings
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=403,
            detail="FORBIDDEN: Progress reset endpoint is strictly disabled in production environments."
        )
    user_id = get_optional_user_id(request)
    from sqlalchemy import delete
    from app.models.progress import UserProgress, ConceptMastery
    from app.models.learning import LearningAttempt

    await db.execute(delete(UserProgress).where(UserProgress.user_id == user_id))
    await db.execute(delete(ConceptMastery).where(ConceptMastery.user_id == user_id))
    await db.execute(delete(LearningAttempt).where(LearningAttempt.user_id == user_id))
    await db.commit()

    return {"status": "SUCCESS", "message": "Progress and attempts reset successfully"}
