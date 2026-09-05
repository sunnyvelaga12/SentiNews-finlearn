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


class CurriculumContentService:
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
        - Defer blocks_json and questions_json to minimize I/O and memory overhead.
        - Computes exact unit and lesson stats using lightweight batch queries.
        - Supports domain category filtering and offset pagination.
        """
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
            return {
                "modules": [],
                "total_items": total_items,
                "domains": domains_list,
                "has_more": False,
                "limit": limit,
                "offset": offset,
            }

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

        return {
            "modules": catalog,
            "total_items": total_items,
            "domains": domains_list,
            "has_more": (offset + len(catalog)) < total_items,
            "limit": limit,
            "offset": offset,
        }

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
        """Returns complete curriculum hierarchy tree for Admin Content Studio."""
        d_stmt = select(Domain).order_by(Domain.order_index.asc())
        d_res = await db.execute(d_stmt)
        domains = d_res.scalars().all()

        tree = []
        for domain in domains:
            w_stmt = select(World).where(World.domain_id == domain.id).order_by(World.order_index.asc())
            w_res = await db.execute(w_stmt)
            worlds = w_res.scalars().all()

            world_nodes = []
            for world in worlds:
                s_stmt = select(Series).where(Series.world_id == world.id).order_by(Series.order_index.asc())
                s_res = await db.execute(s_stmt)
                series_list = s_res.scalars().all()

                series_nodes = []
                for s in series_list:
                    m_stmt = select(Module).where(Module.series_id == s.id).order_by(Module.order_index.asc())
                    m_res = await db.execute(m_stmt)
                    modules = m_res.scalars().all()

                    mod_nodes = []
                    for m in modules:
                        u_stmt = select(Unit).where(Unit.module_id == m.id).order_by(Unit.order_index.asc())
                        u_res = await db.execute(u_stmt)
                        units = u_res.scalars().all()

                        unit_nodes = []
                        for u in units:
                            # Fetch unit concepts (by ID and slug)
                            uc_stmt = (
                                select(Concept)
                                .join(UnitConcept, Concept.id == UnitConcept.concept_id)
                                .where(UnitConcept.unit_id == u.id)
                                .order_by(UnitConcept.order_index.asc())
                            )
                            uc_res = await db.execute(uc_stmt)
                            unit_concepts = uc_res.scalars().all()
                            u_concept_keys = {str(c.id) for c in unit_concepts} | {c.slug for c in unit_concepts}

                            # Find all lessons associated with these concepts
                            u_lessons = []
                            l_stmt = (
                                select(Lesson, LessonVersion)
                                .join(LessonVersion, Lesson.id == LessonVersion.lesson_id)
                                .order_by(LessonVersion.version_number.desc())
                            )
                            l_res = await db.execute(l_stmt)
                            seen_lesson_ids = set()
                            for l, lv in l_res.all():
                                if l.id in seen_lesson_ids:
                                    continue
                                lv_keys = {str(c) for c in (lv.concept_ids or [])}
                                if u_concept_keys and (u_concept_keys & lv_keys):
                                    seen_lesson_ids.add(l.id)
                                    u_lessons.append({
                                        "id": str(l.id),
                                        "slug": l.slug,
                                        "title": lv.title,
                                        "status": lv.status,
                                        "version_id": str(lv.id),
                                        "version_number": lv.version_number,
                                    })

                            unit_nodes.append({
                                "id": str(u.id),
                                "slug": u.slug,
                                "name": u.name,
                                "order_index": u.order_index,
                                "lessons": u_lessons,
                            })

                        mod_nodes.append({
                            "id": str(m.id),
                            "slug": m.slug,
                            "name": m.name,
                            "description": m.description,
                            "units": unit_nodes
                        })
                    series_nodes.append({
                        "id": str(s.id),
                        "slug": s.slug,
                        "name": s.name,
                        "modules": mod_nodes
                    })
                world_nodes.append({
                    "id": str(world.id),
                    "slug": world.slug,
                    "name": world.name,
                    "series": series_nodes
                })
            tree.append({
                "id": str(domain.id),
                "slug": domain.slug,
                "name": domain.name,
                "worlds": world_nodes
            })
        return tree
