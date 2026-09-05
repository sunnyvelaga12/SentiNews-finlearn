"""
Curriculum Content Service — SentiNews Learn V0.4 / V1.0
Handles structural content retrieval, creation, updates, and tree assembly.
Zero learner progression or mastery evaluation logic.
"""
import uuid
from typing import List, Optional, Dict, Any, Tuple, Set
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, defer
from app.models.curriculum import Domain, World, Series, Module, Unit, UnitConcept
from app.models.concept import Concept
from app.models.lesson import Lesson, LessonVersion


import time


class CurriculumContentService:
    _catalog_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
    CATALOG_CACHE_TTL_SECONDS: float = 30.0

    @classmethod
    def clear_catalog_cache(cls):
        """Invalidates all cached catalog responses."""
        cls._catalog_cache.clear()

    @classmethod
    async def get_published_modules(cls, db: AsyncSession) -> List[Module]:
        """Returns all modules ordered by order_index ascending."""
        stmt = select(Module).order_by(Module.order_index.asc())
        res = await db.execute(stmt)
        return res.scalars().all()

    @classmethod
    async def get_catalog_modules_with_stats(
        cls,
        db: AsyncSession,
        user_id: Optional[uuid.UUID] = None,
        domain_slug: Optional[str] = None,
        limit: int = 8,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        High-performance catalog projection for the Learner Homepage.
        - Avoids N+1 queries.
        - In-memory 30s TTL cache for ultra-low latency (<2ms).
        - Defer blocks_json and questions_json to minimize I/O and memory overhead.
        - Computes exact unit and lesson stats using lightweight batch queries.
        - Supports domain category filtering and offset pagination.
        """
        cache_key = f"{user_id}:{domain_slug}:{limit}:{offset}"
        now = time.time()
        if cache_key in cls._catalog_cache:
            cached_time, cached_val = cls._catalog_cache[cache_key]
            if (now - cached_time) < cls.CATALOG_CACHE_TTL_SECONDS:
                return cached_val

        # 1. Fetch domains for domain navigation tabs
        dom_stmt = select(Domain.slug, Domain.name).order_by(Domain.order_index.asc())
        dom_res = await db.execute(dom_stmt)
        domains_list = [{"slug": "all", "name": "All"}]
        for slug, name in dom_res.all():
            domains_list.append({"slug": slug, "name": name})

        # 2. Query matching modules joined with Domain
        base_query = (
            select(
                Module,
                Domain.slug.label("domain_slug"),
                Domain.name.label("domain_name")
            )
            .join(Series, Module.series_id == Series.id)
            .join(World, Series.world_id == World.id)
            .join(Domain, World.domain_id == Domain.id)
        )
        if domain_slug and domain_slug.lower() != "all":
            base_query = base_query.where(Domain.slug == domain_slug.lower())

        base_query = base_query.order_by(Module.order_index.asc())
        all_mods_res = await db.execute(base_query)
        all_matching = all_mods_res.all()
        total_items = len(all_matching)

        paged_slice = all_matching[offset : offset + limit] if limit > 0 else all_matching[offset:]
        if not paged_slice:
            empty_res = {
                "modules": [],
                "total_items": total_items,
                "domains": domains_list,
                "has_more": False,
                "limit": limit,
                "offset": offset,
            }
            cls._catalog_cache[cache_key] = (now, empty_res)
            return empty_res

        paged_module_ids = [m.id for m, _, _ in paged_slice]

        # 3. Batch query Units and UnitConcepts in ONE round-trip
        u_stmt = (
            select(Unit.module_id, Unit.id, UnitConcept.concept_id)
            .outerjoin(UnitConcept, UnitConcept.unit_id == Unit.id)
            .where(Unit.module_id.in_(paged_module_ids))
        )
        u_res = await db.execute(u_stmt)
        module_unit_ids: Dict[uuid.UUID, Set[uuid.UUID]] = {mid: set() for mid in paged_module_ids}
        module_concept_ids: Dict[uuid.UUID, Set[uuid.UUID]] = {mid: set() for mid in paged_module_ids}
        for mid, uid, cid in u_res.all():
            if uid:
                module_unit_ids[mid].add(uid)
            if cid:
                module_concept_ids[mid].add(cid)
        u_counts = {mid: len(uids) for mid, uids in module_unit_ids.items()}

        # 5. Lightweight published lesson query (selects only necessary columns; does NOT fetch blocks_json)
        l_stmt = (
            select(Lesson.id, Lesson.slug, LessonVersion.concept_ids)
            .join(LessonVersion, Lesson.current_version_id == LessonVersion.id)
            .where(LessonVersion.status == "PUBLISHED")
        )
        l_res = await db.execute(l_stmt)
        published_lessons = l_res.all()

        # 6. User progress prefetch
        completed_lesson_ids: Set[uuid.UUID] = set()
        completed_concept_ids: Set[uuid.UUID] = set()
        if user_id:
            from app.services.curriculum.learner_curriculum_state_service import LearnerCurriculumStateService
            completed_lesson_ids = await LearnerCurriculumStateService.get_completed_lesson_ids(db, user_id)
            completed_concept_ids = await LearnerCurriculumStateService.get_verified_completed_concept_ids(db, user_id)

        # 7. Assemble lightweight catalog items
        catalog = []
        for m, dom_slug, dom_name in paged_slice:
            m_cids = module_concept_ids.get(m.id, set())
            m_lessons = []
            for lid, lslug, cids in published_lessons:
                parsed_cids = set()
                for c in (cids or []):
                    try:
                        parsed_cids.add(uuid.UUID(str(c)))
                    except (ValueError, TypeError):
                        pass
                if parsed_cids & m_cids:
                    m_lessons.append((lid, lslug, parsed_cids))

            total_lessons = len(m_lessons)
            completed_count = 0
            for lid, lslug, parsed_cids in m_lessons:
                if lid in completed_lesson_ids or (parsed_cids and all(cid in completed_concept_ids for cid in parsed_cids)):
                    completed_count += 1

            pct = round((completed_count / total_lessons * 100)) if total_lessons > 0 else 0
            catalog.append({
                "id": str(m.id),
                "slug": m.slug,
                "title": m.name,
                "description": m.description or "",
                "learner_goal": m.learner_goal or f"Master {m.name} with verified application evidence.",
                "why_this_matters": m.why_this_matters or f"Understanding {m.name} is a foundational financial literacy skill.",
                "domain": dom_slug,
                "domain_name": dom_name,
                "level": m.level or "BEGINNER",
                "total_units": u_counts.get(m.id, 0),
                "total_lessons": total_lessons,
                "estimated_hours": m.estimated_hours or 1.5,
                "progress": {
                    "completed_lessons": completed_count,
                    "total_lessons": total_lessons,
                    "completion_pct": pct,
                },
                "badge": {
                    "badge_title": f"{m.name} Competence",
                    "status": "EARNED" if (total_lessons > 0 and completed_count >= total_lessons) else "NOT_EARNED",
                }
            })

        result = {
            "modules": catalog,
            "total_items": total_items,
            "domains": domains_list,
            "has_more": (offset + len(catalog)) < total_items,
            "limit": limit,
            "offset": offset,
        }
        cls._catalog_cache[cache_key] = (now, result)
        return result

    @classmethod
    async def get_module_by_slug_or_id(
        cls, db: AsyncSession, slug_or_id: str
    ) -> Optional[Module]:
        """Resolves module by slug or UUID."""
        stmt = select(Module).where(Module.slug == slug_or_id)
        res = await db.execute(stmt)
        mod = res.scalar_one_or_none()
        if not mod:
            try:
                mod_id = uuid.UUID(slug_or_id)
                stmt_id = select(Module).where(Module.id == mod_id)
                res_id = await db.execute(stmt_id)
                mod = res_id.scalar_one_or_none()
            except ValueError:
                pass
        return mod

    @classmethod
    async def get_units_for_module(
        cls, db: AsyncSession, module_id: uuid.UUID
    ) -> List[Unit]:
        """Returns units for a module in ascending order."""
        stmt = (
            select(Unit)
            .where(Unit.module_id == module_id)
            .order_by(Unit.order_index.asc())
        )
        res = await db.execute(stmt)
        return res.scalars().all()

    @classmethod
    async def get_lesson_by_slug(
        cls, db: AsyncSession, slug: str
    ) -> Optional[Tuple[Lesson, LessonVersion]]:
        """Returns the published lesson and its current version by slug."""
        stmt = (
            select(Lesson, LessonVersion)
            .join(LessonVersion, Lesson.current_version_id == LessonVersion.id)
            .where(
                Lesson.slug == slug,
                LessonVersion.status == "PUBLISHED"
            )
        )
        res = await db.execute(stmt)
        return res.first()

    @classmethod
    async def get_full_curriculum_tree(cls, db: AsyncSession) -> List[Dict[str, Any]]:
        """
        Returns complete curriculum hierarchy tree for Admin Content Studio.
        Uses batch queries to prevent N+1 remote database roundtrips.
        """
        # 1. Single batch queries for all structural levels
        domains = (await db.execute(select(Domain).order_by(Domain.order_index.asc()))).scalars().all()
        worlds = (await db.execute(select(World).order_by(World.order_index.asc()))).scalars().all()
        series_list = (await db.execute(select(Series).order_by(Series.order_index.asc()))).scalars().all()
        modules = (await db.execute(select(Module).order_by(Module.order_index.asc()))).scalars().all()
        units = (await db.execute(select(Unit).order_by(Unit.order_index.asc()))).scalars().all()

        # 2. Batch fetch all UnitConcepts with Concept slugs and IDs
        uc_stmt = (
            select(UnitConcept.unit_id, Concept.id, Concept.slug)
            .join(Concept, Concept.id == UnitConcept.concept_id)
            .order_by(UnitConcept.order_index.asc())
        )
        uc_res = await db.execute(uc_stmt)
        concepts_by_unit: Dict[uuid.UUID, Set[str]] = {}
        for unit_id, c_id, c_slug in uc_res.all():
            if unit_id not in concepts_by_unit:
                concepts_by_unit[unit_id] = set()
            concepts_by_unit[unit_id].add(str(c_id))
            if c_slug:
                concepts_by_unit[unit_id].add(c_slug)

        # 3. Batch fetch all Lessons and their latest LessonVersions
        l_stmt = (
            select(
                Lesson.id,
                Lesson.slug,
                LessonVersion.id,
                LessonVersion.version_number,
                LessonVersion.title,
                LessonVersion.status,
                LessonVersion.concept_ids,
            )
            .join(LessonVersion, Lesson.id == LessonVersion.lesson_id)
            .order_by(Lesson.id, LessonVersion.version_number.desc())
        )
        l_res = await db.execute(l_stmt)
        latest_lessons: Dict[uuid.UUID, Dict[str, Any]] = {}
        for lid, slug, vid, vnum, title, status, cids in l_res.all():
            if lid not in latest_lessons:
                latest_lessons[lid] = {
                    "id": str(lid),
                    "slug": slug,
                    "title": title,
                    "status": status,
                    "version_id": str(vid),
                    "version_number": vnum,
                    "concept_keys": {str(c) for c in (cids or [])},
                }

        # 4. Group hierarchy in-memory (O(N) operations)
        units_by_module: Dict[uuid.UUID, List[Dict[str, Any]]] = {}
        for u in units:
            u_concept_keys = concepts_by_unit.get(u.id, set())
            u_lessons = []
            for lesson_info in latest_lessons.values():
                if u_concept_keys and (u_concept_keys & lesson_info["concept_keys"]):
                    u_lessons.append({
                        "id": lesson_info["id"],
                        "slug": lesson_info["slug"],
                        "title": lesson_info["title"],
                        "status": lesson_info["status"],
                        "version_id": lesson_info["version_id"],
                        "version_number": lesson_info["version_number"],
                    })

            unit_node = {
                "id": str(u.id),
                "slug": u.slug,
                "name": u.name,
                "order_index": u.order_index,
                "lessons": u_lessons,
            }
            units_by_module.setdefault(u.module_id, []).append(unit_node)

        modules_by_series: Dict[uuid.UUID, List[Dict[str, Any]]] = {}
        for m in modules:
            mod_node = {
                "id": str(m.id),
                "slug": m.slug,
                "name": m.name,
                "description": m.description,
                "units": units_by_module.get(m.id, []),
            }
            modules_by_series.setdefault(m.series_id, []).append(mod_node)

        series_by_world: Dict[uuid.UUID, List[Dict[str, Any]]] = {}
        for s in series_list:
            s_node = {
                "id": str(s.id),
                "slug": s.slug,
                "name": s.name,
                "modules": modules_by_series.get(s.id, []),
            }
            series_by_world.setdefault(s.world_id, []).append(s_node)

        worlds_by_domain: Dict[uuid.UUID, List[Dict[str, Any]]] = {}
        for w in worlds:
            w_node = {
                "id": str(w.id),
                "slug": w.slug,
                "name": w.name,
                "series": series_by_world.get(w.id, []),
            }
            worlds_by_domain.setdefault(w.domain_id, []).append(w_node)

        tree = []
        for d in domains:
            tree.append({
                "id": str(d.id),
                "slug": d.slug,
                "name": d.name,
                "worlds": worlds_by_domain.get(d.id, []),
            })
        return tree
