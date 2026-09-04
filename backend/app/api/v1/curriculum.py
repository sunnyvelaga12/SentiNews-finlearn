import uuid
import hashlib
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
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


def require_content_editor(request: Request) -> uuid.UUID:
    """Enforces CONTENT_EDITOR or SUPER_ADMIN role for curriculum mutations."""
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    try:
        token = auth_header.split(" ")[1]
        payload = verify_jwt_token(token)
        role = payload.get("role", "LEARNER")
        if role not in ["CONTENT_EDITOR", "SUPER_ADMIN"]:
            raise HTTPException(
                status_code=403,
                detail="FORBIDDEN_ROLE: Only CONTENT_EDITOR or SUPER_ADMIN can modify curriculum structures."
            )
        return uuid.UUID(payload["sub"])
    except HTTPException:
        raise
    except Exception as e:
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
    new_module = Module(
        id=uuid.uuid4(),
        series_id=req.series_id,
        slug=req.slug,
        name=req.name,
        description=req.description or "",
        order_index=req.order_index,
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
    new_unit = Unit(
        id=uuid.uuid4(),
        module_id=req.module_id,
        slug=req.slug,
        name=req.name,
        description=req.description or "",
        order_index=req.order_index,
    )
    db.add(new_unit)
    await db.commit()
    await db.refresh(new_unit)
    return {
        "status": "SUCCESS",
        "unit_id": str(new_unit.id),
        "slug": new_unit.slug,
        "name": new_unit.name,
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
            "learner_goal": f"Master {m.name} with verified application evidence.",
            "why_this_matters": f"Essential market foundation for understanding price discovery.",
            "level": "BEGINNER",
            "total_units": len(units),
            "total_lessons": progress.total_lessons,
            "estimated_hours": 1.5,
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

    is_market_basics = "market" in mod.slug.lower()
    learner_goal = (
        "Master order book depth, liquidity matching, and bid-ask spread mechanics without technical indicators."
        if is_market_basics else
        "Explain single candle anatomy, interpret OHLC behavior, and analyze unfamiliar charts without pattern memorization."
    )
    why_this_matters = (
        "Before executing orders or understanding slippage, you must understand how buy and sell interest match in an electronic order book."
        if is_market_basics else
        "Before reading complex chart patterns, you must understand what each single candle is communicating about the underlying period battle."
    )
    learning_outcomes = (
        [
            "Understand the difference between bids (buyers) and asks (sellers).",
            "Read an order book depth ladder and calculate bid-ask spreads.",
            "Explain market orders vs limit orders and execution price priority.",
            "Calculate round-trip transaction costs caused by the spread.",
            "Analyze market liquidity and slippage risks."
        ]
        if is_market_basics else
        [
            "Identify the four crucial price points (OHLC) on any candle.",
            "Explain what body size tells you about period momentum.",
            "Interpret upper and lower wicks as intraperiod price discovery.",
            "Distinguish bullish conviction from bearish control.",
            "Analyze unfamiliar candles without rigid rule memorization."
        ]
    )
    target_capability = (
        "Order Book & Market Microstructure Analysis"
        if is_market_basics else
        "Candlestick Price Action Reading & Context Analysis"
    )

    contract = ModuleContract(
        id=mod.id,
        slug=mod.slug,
        title=mod.name,
        description=mod.description or "Comprehensive price action reading curriculum.",
        learner_goal=learner_goal,
        why_this_matters=why_this_matters,
        level="BEGINNER",
        prerequisites=["None. Designed for zero-knowledge beginners."],
        learning_outcomes=learning_outcomes,
        estimated_hours=1.5,
        ordered_units=unit_contracts,
        completion_criteria="Complete all unit milestones, pass the Capstone Challenge with >= 80%, and earn verified evidence.",
        challenge=ModuleChallengeContract(
            id=f"challenge-{mod.slug}",
            title=f"{mod.name} Capstone Challenge",
            description=f"Demonstrate comprehensive mastery of {mod.name}.",
            target_capability=target_capability,
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
