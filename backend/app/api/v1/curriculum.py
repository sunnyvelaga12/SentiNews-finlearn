import uuid
import hashlib
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple, Set
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_jwt_token, validate_origin_and_csrf, resolve_admin_context, DEFAULT_ADMIN_USER_ID
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
    DomainCreateRequest,
    DomainUpdateRequest,
    WorldCreateRequest,
    WorldUpdateRequest,
    SeriesCreateRequest,
    SeriesUpdateRequest,
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
    """Enforces CONTENT_EDITOR, SUPER_ADMIN, or ADMIN role for curriculum mutations."""
    actor_id, role = resolve_admin_context(request, ["CONTENT_EDITOR", "SUPER_ADMIN", "ADMIN"])
    return actor_id


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
    domain_id = req.domain_id
    series_id = req.series_id

    # If domain_id provided, verify domain exists
    if domain_id:
        d_exists = (await db.execute(select(Domain.id).where(Domain.id == domain_id))).scalar_one_or_none()
        if not d_exists:
            raise HTTPException(status_code=404, detail="DOMAIN_NOT_FOUND")
    elif series_id:
        s_exists = (await db.execute(select(Series.id).where(Series.id == series_id))).scalar_one_or_none()
        if not s_exists:
            raise HTTPException(status_code=404, detail="SERIES_NOT_FOUND")
    else:
        # If neither provided, associate with the first available domain or create default domain
        d_stmt = select(Domain.id).order_by(Domain.order_index.asc()).limit(1)
        domain_id = (await db.execute(d_stmt)).scalar_one_or_none()
        if not domain_id:
            dom = Domain(id=uuid.uuid4(), slug="technical-analysis", name="Technical Analysis")
            db.add(dom)
            await db.flush()
            domain_id = dom.id

    slug = req.slug
    if not slug:
        clean_name = re.sub(r'[^a-z0-9]+', '-', req.name.lower()).strip('-')
        slug = clean_name or f"mod-{uuid.uuid4().hex[:6]}"

    # Ensure slug uniqueness against database
    existing_mod_slug = (await db.execute(select(Module.id).where(Module.slug == slug))).scalar_one_or_none()
    if existing_mod_slug:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

    new_module = Module(
        id=uuid.uuid4(),
        domain_id=domain_id,
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
    CurriculumContentService.clear_catalog_cache()
    return {
        "status": "SUCCESS",
        "module_id": str(new_module.id),
        "domain_id": str(new_module.domain_id) if new_module.domain_id else None,
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

    if req.domain_id is not None:
        mod.domain_id = req.domain_id
    if req.series_id is not None:
        mod.series_id = req.series_id
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
    CurriculumContentService.clear_catalog_cache()
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

    # Ensure slug uniqueness against database
    existing_unit_slug = (await db.execute(select(Unit.id).where(Unit.slug == slug))).scalar_one_or_none()
    if existing_unit_slug:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"

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
    concept_slug = f"concept-{slug}"
    existing_concept_slug = (await db.execute(select(Concept.id).where(Concept.slug == concept_slug))).scalar_one_or_none()
    if existing_concept_slug:
        concept_slug = f"{concept_slug}-{uuid.uuid4().hex[:6]}"

    new_concept = Concept(
        id=uuid.uuid4(),
        slug=concept_slug,
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
    force: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently deletes an entire module at a time, including:
    - All child units
    - All child lessons and their versions (both draft and published)
    - All associated unit concept mappings
    - All associated learning sessions
    """
    require_content_editor(request)
    from sqlalchemy import delete as sql_delete, update
    from app.models.concept import Concept
    from app.models.learning import LearningSession, LearningSessionItem

    stmt = select(Module).where(Module.id == module_id)
    res = await db.execute(stmt)
    mod = res.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="MODULE_NOT_FOUND")

    # 1. Gather all units in this module
    u_stmt = select(Unit).where(Unit.module_id == module_id)
    u_res = await db.execute(u_stmt)
    units = u_res.scalars().all()
    unit_ids = [u.id for u in units]

    # 2. Gather concepts associated with these units or module
    unit_cids: Set[uuid.UUID] = set()
    if unit_ids:
        uc_stmt = select(UnitConcept.concept_id).where(UnitConcept.unit_id.in_(unit_ids))
        unit_cids = set((await db.execute(uc_stmt)).scalars().all())

    mod_c_stmt = select(Concept.id).where(Concept.module_id == module_id)
    mod_cids = set((await db.execute(mod_c_stmt)).scalars().all())
    all_cids = unit_cids | mod_cids
    all_cid_strs = {str(cid) for cid in all_cids}

    # 3. Find all lessons associated with this module's units/concepts
    lesson_ids: Set[uuid.UUID] = set()
    version_ids: Set[uuid.UUID] = set()
    if all_cid_strs:
        l_stmt = (
            select(Lesson.id, LessonVersion.id, LessonVersion.concept_ids)
            .join(LessonVersion, Lesson.id == LessonVersion.lesson_id)
        )
        l_res = await db.execute(l_stmt)
        for lid, vid, cids in l_res.all():
            lv_cids = {str(c) for c in (cids or [])}
            if lv_cids & all_cid_strs:
                lesson_ids.add(lid)
                version_ids.add(vid)

    # 4. Safely clean up learning sessions referencing these versions to prevent RESTRICT constraint failure
    if version_ids:
        sess_stmt = select(LearningSession.id).where(LearningSession.lesson_version_id.in_(list(version_ids)))
        sess_ids = (await db.execute(sess_stmt)).scalars().all()
        if sess_ids:
            await db.execute(sql_delete(LearningSessionItem).where(LearningSessionItem.session_id.in_(sess_ids)))
            await db.execute(sql_delete(LearningSession).where(LearningSession.id.in_(sess_ids)))

    # 5. Delete lessons and versions
    if lesson_ids:
        from sqlalchemy import text
        await db.execute(text("SET LOCAL app.bypass_immutability = 'on'"))
        await db.execute(update(Lesson).where(Lesson.id.in_(list(lesson_ids))).values(current_version_id=None))
        await db.execute(sql_delete(LessonVersion).where(LessonVersion.lesson_id.in_(list(lesson_ids))))
        await db.execute(sql_delete(Lesson).where(Lesson.id.in_(list(lesson_ids))))

    # 6. Cascade delete UnitConcepts and Units
    if unit_ids:
        await db.execute(sql_delete(UnitConcept).where(UnitConcept.unit_id.in_(unit_ids)))
        await db.execute(sql_delete(Unit).where(Unit.id.in_(unit_ids)))

    # 7. Clean up module concepts
    if mod_cids:
        await db.execute(sql_delete(Concept).where(Concept.module_id == module_id))

    # 8. Delete the module itself
    await db.execute(sql_delete(Module).where(Module.id == module_id))
    await db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Module '{mod.name}', {len(units)} unit(s), and {len(lesson_ids)} lesson(s) deleted successfully.",
        "module_id": str(module_id),
        "deleted_units": len(units),
        "deleted_lessons": len(lesson_ids),
    }


@router.delete("/curriculum/units/{unit_id}", summary="Delete a curriculum unit")
async def delete_unit(
    unit_id: uuid.UUID,
    request: Request,
    force: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently deletes an entire unit at a time, including:
    - All child lessons in this unit
    - All associated unit concept mappings
    - All associated learning sessions
    """
    require_content_editor(request)
    from sqlalchemy import delete as sql_delete, update, text
    from app.models.concept import Concept
    from app.models.learning import LearningSession, LearningSessionItem

    stmt = select(Unit).where(Unit.id == unit_id)
    res = await db.execute(stmt)
    unit = res.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="UNIT_NOT_FOUND")

    # 1. Find concepts linked to this unit
    uc_stmt = select(UnitConcept.concept_id).where(UnitConcept.unit_id == unit_id)
    unit_cids = set((await db.execute(uc_stmt)).scalars().all())
    unit_cid_strs = {str(cid) for cid in unit_cids}

    # 2. Find lessons associated with these concepts
    lesson_ids: Set[uuid.UUID] = set()
    version_ids: Set[uuid.UUID] = set()
    if unit_cid_strs:
        l_stmt = (
            select(Lesson.id, LessonVersion.id, LessonVersion.concept_ids)
            .join(LessonVersion, Lesson.id == LessonVersion.lesson_id)
        )
        l_res = await db.execute(l_stmt)
        for lid, vid, cids in l_res.all():
            lv_cids = {str(c) for c in (cids or [])}
            if lv_cids & unit_cid_strs:
                lesson_ids.add(lid)
                version_ids.add(vid)

    # 3. Clean up learning sessions
    if version_ids:
        sess_stmt = select(LearningSession.id).where(LearningSession.lesson_version_id.in_(list(version_ids)))
        sess_ids = (await db.execute(sess_stmt)).scalars().all()
        if sess_ids:
            await db.execute(sql_delete(LearningSessionItem).where(LearningSessionItem.session_id.in_(sess_ids)))
            await db.execute(sql_delete(LearningSession).where(LearningSession.id.in_(sess_ids)))

    # 4. Delete lessons and versions
    if lesson_ids:
        await db.execute(text("SET LOCAL app.bypass_immutability = 'on'"))
        await db.execute(update(Lesson).where(Lesson.id.in_(list(lesson_ids))).values(current_version_id=None))
        await db.execute(sql_delete(LessonVersion).where(LessonVersion.lesson_id.in_(list(lesson_ids))))
        await db.execute(sql_delete(Lesson).where(Lesson.id.in_(list(lesson_ids))))

    # 5. Delete UnitConcept associations
    await db.execute(sql_delete(UnitConcept).where(UnitConcept.unit_id == unit_id))

    # 6. Clean up auto-created concept if no other unit references it
    auto_concept_slug = f"concept-{unit.slug}"
    c_stmt = select(Concept).where(Concept.slug == auto_concept_slug)
    auto_c = (await db.execute(c_stmt)).scalar_one_or_none()
    if auto_c:
        other_uc = (await db.execute(select(UnitConcept).where(UnitConcept.concept_id == auto_c.id))).scalars().first()
        if not other_uc:
            await db.execute(sql_delete(Concept).where(Concept.id == auto_c.id))

    # 7. Delete the unit itself
    await db.execute(sql_delete(Unit).where(Unit.id == unit_id))
    await db.commit()

    return {
        "status": "SUCCESS",
        "message": f"Unit '{unit.name}' and {len(lesson_ids)} lesson(s) deleted successfully.",
        "unit_id": str(unit_id),
        "deleted_lessons": len(lesson_ids),
    }


# ── Domain, World, and Series CRUD & Cascade Deletion ─────────────────────────

async def cascade_delete_module_internal(db: AsyncSession, module_id: uuid.UUID) -> Tuple[int, int]:
    """Helper to cascade delete a module and all its children without committing."""
    from sqlalchemy import delete as sql_delete, update, text
    from app.models.concept import Concept
    from app.models.learning import LearningSession, LearningSessionItem

    u_stmt = select(Unit).where(Unit.module_id == module_id)
    units = (await db.execute(u_stmt)).scalars().all()
    unit_ids = [u.id for u in units]

    unit_cids: Set[uuid.UUID] = set()
    if unit_ids:
        uc_stmt = select(UnitConcept.concept_id).where(UnitConcept.unit_id.in_(unit_ids))
        unit_cids = set((await db.execute(uc_stmt)).scalars().all())

    mod_cids = set((await db.execute(select(Concept.id).where(Concept.module_id == module_id))).scalars().all())
    all_cid_strs = {str(cid) for cid in (unit_cids | mod_cids)}

    lesson_ids: Set[uuid.UUID] = set()
    version_ids: Set[uuid.UUID] = set()
    if all_cid_strs:
        l_stmt = select(Lesson.id, LessonVersion.id, LessonVersion.concept_ids).join(
            LessonVersion, Lesson.id == LessonVersion.lesson_id
        )
        for lid, vid, cids in (await db.execute(l_stmt)).all():
            if {str(c) for c in (cids or [])} & all_cid_strs:
                lesson_ids.add(lid)
                version_ids.add(vid)

    if version_ids:
        sess_ids = (await db.execute(
            select(LearningSession.id).where(LearningSession.lesson_version_id.in_(list(version_ids)))
        )).scalars().all()
        if sess_ids:
            await db.execute(sql_delete(LearningSessionItem).where(LearningSessionItem.session_id.in_(sess_ids)))
            await db.execute(sql_delete(LearningSession).where(LearningSession.id.in_(sess_ids)))

    if lesson_ids:
        await db.execute(text("SET LOCAL app.bypass_immutability = 'on'"))
        await db.execute(update(Lesson).where(Lesson.id.in_(list(lesson_ids))).values(current_version_id=None))
        await db.execute(sql_delete(LessonVersion).where(LessonVersion.lesson_id.in_(list(lesson_ids))))
        await db.execute(sql_delete(Lesson).where(Lesson.id.in_(list(lesson_ids))))

    if unit_ids:
        await db.execute(sql_delete(UnitConcept).where(UnitConcept.unit_id.in_(unit_ids)))
        await db.execute(sql_delete(Unit).where(Unit.id.in_(unit_ids)))

    if mod_cids:
        await db.execute(sql_delete(Concept).where(Concept.module_id == module_id))

    await db.execute(sql_delete(Module).where(Module.id == module_id))
    CurriculumContentService.clear_catalog_cache()
    return len(units), len(lesson_ids)


async def cascade_delete_series_internal(db: AsyncSession, series_id: uuid.UUID):
    """Cascades all modules in series, then deletes series."""
    from sqlalchemy import delete as sql_delete
    mod_ids = (await db.execute(select(Module.id).where(Module.series_id == series_id))).scalars().all()
    for mid in mod_ids:
        await cascade_delete_module_internal(db, mid)
    await db.execute(sql_delete(Series).where(Series.id == series_id))


async def cascade_delete_world_internal(db: AsyncSession, world_id: uuid.UUID):
    """Cascades all series in world, then deletes world."""
    from sqlalchemy import delete as sql_delete
    series_ids = (await db.execute(select(Series.id).where(Series.world_id == world_id))).scalars().all()
    for sid in series_ids:
        await cascade_delete_series_internal(db, sid)
    await db.execute(sql_delete(World).where(World.id == world_id))


async def cascade_delete_domain_internal(db: AsyncSession, domain_id: uuid.UUID):
    """Cascades all worlds in domain, then deletes domain."""
    from sqlalchemy import delete as sql_delete
    world_ids = (await db.execute(select(World.id).where(World.domain_id == domain_id))).scalars().all()
    for wid in world_ids:
        await cascade_delete_world_internal(db, wid)
    await db.execute(sql_delete(Domain).where(Domain.id == domain_id))


@router.post("/curriculum/domains", summary="Create a new curriculum domain")
async def create_domain(req: DomainCreateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    require_content_editor(request)
    import re
    clean_name = re.sub(r'[^a-z0-9]+', '-', req.name.lower()).strip('-')
    slug = req.slug or clean_name or f"domain-{uuid.uuid4().hex[:6]}"
    existing = (await db.execute(select(Domain.id).where(Domain.slug == slug))).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    dom = Domain(
        id=uuid.uuid4(),
        slug=slug,
        name=req.name,
        description=req.description or "",
        order_index=req.order_index,
    )
    db.add(dom)
    await db.commit()
    await db.refresh(dom)
    return {"status": "SUCCESS", "domain": {"id": str(dom.id), "slug": dom.slug, "name": dom.name}}


@router.patch("/curriculum/domains/{domain_id}", summary="Update domain metadata")
async def update_domain(domain_id: uuid.UUID, req: DomainUpdateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    require_content_editor(request)
    dom = (await db.execute(select(Domain).where(Domain.id == domain_id))).scalar_one_or_none()
    if not dom:
        raise HTTPException(status_code=404, detail="DOMAIN_NOT_FOUND")
    if req.name is not None:
        dom.name = req.name
    if req.description is not None:
        dom.description = req.description
    if req.order_index is not None:
        dom.order_index = req.order_index
    await db.commit()
    return {"status": "SUCCESS", "domain": {"id": str(dom.id), "slug": dom.slug, "name": dom.name}}


@router.delete("/curriculum/domains/{domain_id}", summary="Delete a curriculum domain")
async def delete_domain(domain_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    require_content_editor(request)
    dom = (await db.execute(select(Domain).where(Domain.id == domain_id))).scalar_one_or_none()
    if not dom:
        raise HTTPException(status_code=404, detail="DOMAIN_NOT_FOUND")
    await cascade_delete_domain_internal(db, domain_id)
    await db.commit()
    return {"status": "SUCCESS", "message": f"Domain '{dom.name}' and all child worlds/series/modules deleted successfully."}


@router.post("/curriculum/worlds", summary="Create a new curriculum world")
async def create_world(req: WorldCreateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    require_content_editor(request)
    import re
    clean_name = re.sub(r'[^a-z0-9]+', '-', req.name.lower()).strip('-')
    slug = req.slug or clean_name or f"world-{uuid.uuid4().hex[:6]}"
    existing = (await db.execute(select(World.id).where(World.slug == slug))).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    world = World(
        id=uuid.uuid4(),
        domain_id=req.domain_id,
        slug=slug,
        name=req.name,
        description=req.description or "",
        order_index=req.order_index,
    )
    db.add(world)
    await db.commit()
    await db.refresh(world)
    return {"status": "SUCCESS", "world": {"id": str(world.id), "slug": world.slug, "name": world.name}}


@router.patch("/curriculum/worlds/{world_id}", summary="Update world metadata")
async def update_world(world_id: uuid.UUID, req: WorldUpdateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    require_content_editor(request)
    world = (await db.execute(select(World).where(World.id == world_id))).scalar_one_or_none()
    if not world:
        raise HTTPException(status_code=404, detail="WORLD_NOT_FOUND")
    if req.name is not None:
        world.name = req.name
    if req.description is not None:
        world.description = req.description
    if req.order_index is not None:
        world.order_index = req.order_index
    await db.commit()
    return {"status": "SUCCESS", "world": {"id": str(world.id), "slug": world.slug, "name": world.name}}


@router.delete("/curriculum/worlds/{world_id}", summary="Delete a curriculum world")
async def delete_world(world_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    require_content_editor(request)
    world = (await db.execute(select(World).where(World.id == world_id))).scalar_one_or_none()
    if not world:
        raise HTTPException(status_code=404, detail="WORLD_NOT_FOUND")
    await cascade_delete_world_internal(db, world_id)
    await db.commit()
    return {"status": "SUCCESS", "message": f"World '{world.name}' and all child series/modules deleted successfully."}


@router.post("/curriculum/series", summary="Create a new curriculum series")
async def create_series(req: SeriesCreateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    require_content_editor(request)
    import re
    clean_name = re.sub(r'[^a-z0-9]+', '-', req.name.lower()).strip('-')
    slug = req.slug or clean_name or f"series-{uuid.uuid4().hex[:6]}"
    existing = (await db.execute(select(Series.id).where(Series.slug == slug))).scalar_one_or_none()
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    series = Series(
        id=uuid.uuid4(),
        world_id=req.world_id,
        slug=slug,
        name=req.name,
        description=req.description or "",
        order_index=req.order_index,
    )
    db.add(series)
    await db.commit()
    await db.refresh(series)
    return {"status": "SUCCESS", "series": {"id": str(series.id), "slug": series.slug, "name": series.name}}


@router.patch("/curriculum/series/{series_id}", summary="Update series metadata")
async def update_series(series_id: uuid.UUID, req: SeriesUpdateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    require_content_editor(request)
    s = (await db.execute(select(Series).where(Series.id == series_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="SERIES_NOT_FOUND")
    if req.name is not None:
        s.name = req.name
    if req.description is not None:
        s.description = req.description
    if req.order_index is not None:
        s.order_index = req.order_index
    await db.commit()
    return {"status": "SUCCESS", "series": {"id": str(s.id), "slug": s.slug, "name": s.name}}


@router.delete("/curriculum/series/{series_id}", summary="Delete a curriculum series")
async def delete_series(series_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db)):
    require_content_editor(request)
    s = (await db.execute(select(Series).where(Series.id == series_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="SERIES_NOT_FOUND")
    await cascade_delete_series_internal(db, series_id)
    await db.commit()
    return {"status": "SUCCESS", "message": f"Series '{s.name}' and all child modules deleted successfully."}



# ── Learner Experience & Catalog Endpoints ────────────────────────────────────
@router.get("/curriculum/modules", summary="Get catalog of published modules with learner progress")
async def list_modules(
    request: Request,
    domain: Optional[str] = None,
    limit: int = 8,
    offset: int = 0,
    page: int = 1,
    page_size: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    user_id = get_optional_user_id(request)
    actual_limit = page_size if page_size is not None else limit
    actual_offset = offset if offset > 0 else ((page - 1) * actual_limit)

    result = await CurriculumContentService.get_catalog_modules_with_stats(
        db=db,
        user_id=user_id,
        domain_slug=domain,
        limit=actual_limit,
        offset=actual_offset,
    )

    total_pages = max(1, (result["total_items"] + actual_limit - 1) // actual_limit)
    return {
        "schema_version": "1.0",
        "modules": result["modules"],
        "domains": result["domains"],
        "selected_domain": domain or "all",
        "total_items": result["total_items"],
        "has_more": result["has_more"],
        "page": page,
        "page_size": actual_limit,
        "total_pages": total_pages,
        "limit": actual_limit,
        "offset": actual_offset,
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
        # Development / authoring fallback: find latest version regardless of status
        l_stmt = select(Lesson, LessonVersion).join(
            LessonVersion, Lesson.id == LessonVersion.lesson_id
        ).where(Lesson.slug == slug).order_by(LessonVersion.version_number.desc())
        fallback_res = await db.execute(l_stmt)
        res = fallback_res.first()

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
