"""
Curriculum Content Service — SentiNews Learn V0.4 / V1.0
Handles structural content retrieval, creation, updates, and tree assembly.
Zero learner progression or mastery evaluation logic.
"""
import uuid
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
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
