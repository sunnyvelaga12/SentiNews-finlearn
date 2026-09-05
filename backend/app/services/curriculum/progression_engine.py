"""
Curriculum Progression Engine — SentiNews Learn V0.4 / V1.0
Server-Authoritative Progression, Eligibility, and Module Evaluation.
Outputs sanitized LessonExecutionContract objects with ZERO evaluation keys or answers.
"""
import uuid
from typing import List, Dict, Any, Optional, Tuple, Set
from enum import Enum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.curriculum import Module, Unit, UnitConcept
from app.models.lesson import Lesson, LessonVersion
from app.schemas.curriculum_contract import (
    ModuleContract,
    UnitContract,
    LessonExecutionContract,
    SafeActivityCard,
    BadgeContract,
    ModuleChallengeContract,
    ModuleProgressMetrics,
    LessonStatus,
    InteractionType,
    RendererType,
    EvidenceRole,
    CognitiveLevel,
    DifficultyLevel,
    ResponseType,
    DataProvenance,
)
from app.services.curriculum.learner_curriculum_state_service import LearnerCurriculumStateService
from app.core.config import settings


class ProgressionPolicy(str, Enum):
    SEQUENTIAL = "SEQUENTIAL"
    PREREQUISITE = "PREREQUISITE"
    MASTERY_GATED = "MASTERY_GATED"


class ProgressionEngine:
    @classmethod
    async def evaluate_module_progression(
        cls,
        db: AsyncSession,
        module: Module,
        user_id: Optional[uuid.UUID],
        policy: ProgressionPolicy = ProgressionPolicy.SEQUENTIAL,
    ) -> Tuple[List[UnitContract], ModuleProgressMetrics, BadgeContract]:
        completed_concept_ids: Set[uuid.UUID] = set()
        completed_lesson_ids: Set[uuid.UUID] = set()
        if user_id:
            completed_concept_ids = (
                await LearnerCurriculumStateService.get_verified_completed_concept_ids(
                    db, user_id
                )
            )
            completed_lesson_ids = (
                await LearnerCurriculumStateService.get_completed_lesson_ids(
                    db, user_id
                )
            )

        # 1. Fetch units in order (Bounded Query 1)
        u_stmt = select(Unit).where(Unit.module_id == module.id).order_by(Unit.order_index.asc())
        u_res = await db.execute(u_stmt)
        units = u_res.scalars().all()
        unit_ids = [u.id for u in units]

        # 2. Bounded Query 2: Prefetch all UnitConcept links for these units in one query (NO N+1)
        unit_concepts_by_unit: Dict[uuid.UUID, List[UnitConcept]] = {uid: [] for uid in unit_ids}
        if unit_ids:
            uc_stmt = (
                select(UnitConcept)
                .where(UnitConcept.unit_id.in_(unit_ids))
                .order_by(UnitConcept.order_index.asc())
            )
            uc_res = await db.execute(uc_stmt)
            for uc in uc_res.scalars().all():
                unit_concepts_by_unit[uc.unit_id].append(uc)

        # 3. Bounded Query 3: Prefetch all published lessons once (NO N+1)
        l_stmt = select(Lesson, LessonVersion).join(
            LessonVersion, Lesson.current_version_id == LessonVersion.id
        ).where(
            LessonVersion.status == "PUBLISHED"
        )
        l_res = await db.execute(l_stmt)
        all_published = l_res.all()

        unit_contracts: List[UnitContract] = []
        total_lessons = 0
        completed_lessons = 0
        all_module_concept_ids: Set[uuid.UUID] = set()
        has_found_next_available = False
        prev_lesson_title: Optional[str] = None

        for u_idx, unit in enumerate(units):
            unit_concepts = unit_concepts_by_unit.get(unit.id, [])
            concept_ids = [uc.concept_id for uc in unit_concepts]
            all_module_concept_ids.update(concept_ids)
            lessons_for_unit: List[Tuple[Lesson, LessonVersion]] = []

            if concept_ids:
                concept_order = {cid: idx for idx, cid in enumerate(concept_ids)}
                matched_lessons = []
                for l, lv in all_published:
                    lv_cids = []
                    for cid in (lv.concept_ids or []):
                        if isinstance(cid, uuid.UUID):
                            lv_cids.append(cid)
                        else:
                            try:
                                lv_cids.append(uuid.UUID(str(cid)))
                            except (ValueError, TypeError, AttributeError):
                                pass
                    matching_indices = [concept_order[cid] for cid in lv_cids if cid in concept_order]
                    if matching_indices:
                        # Pedagogical sequence is defined by unit-scoped UnitConcept order_index, with lesson slug as deterministic tie-breaker
                        matched_lessons.append((min(matching_indices), l.slug, l, lv))
                matched_lessons.sort(key=lambda x: (x[0], x[1]))
                lessons_for_unit = [(l, lv) for _, _, l, lv in matched_lessons]

            lesson_contracts: List[LessonExecutionContract] = []

            for l_idx, (lesson, version) in enumerate(lessons_for_unit):
                total_lessons += 1
                lv_cids = []
                for cid in (version.concept_ids or []):
                    if isinstance(cid, uuid.UUID):
                        lv_cids.append(cid)
                    else:
                        try:
                            lv_cids.append(uuid.UUID(str(cid)))
                        except (ValueError, TypeError, AttributeError):
                            pass

                # Evidence & Progress completion check
                is_completed = bool(
                    lesson.id in completed_lesson_ids
                    or (lv_cids and all(cid in completed_concept_ids for cid in lv_cids))
                )

                if is_completed:
                    completed_lessons += 1
                    status = LessonStatus.COMPLETED
                    is_unlocked = True
                    lock_reason = None
                    prev_lesson_title = version.title
                else:
                    if settings.ENVIRONMENT in ("development", "test", "testing"):
                        # Dev & testing phase: unlock all lessons unconditionally without prerequisite gating
                        status = LessonStatus.AVAILABLE
                        is_unlocked = True
                        lock_reason = None
                    else:
                        # Production: sequential & prerequisite gating
                        if not has_found_next_available:
                            status = LessonStatus.AVAILABLE
                            is_unlocked = True
                            lock_reason = None
                            has_found_next_available = True
                        else:
                            status = LessonStatus.LOCKED
                            is_unlocked = False
                            lock_reason = f"Complete {prev_lesson_title or 'previous lesson'} to unlock"
                    prev_lesson_title = version.title

                # Build sanitized SafeActivityCard list (NO answer keys!)
                safe_cards: List[SafeActivityCard] = []
                for b in version.blocks_json or []:
                    b_type = (b.get("type") or "OBSERVE").upper()
                    if b_type not in InteractionType.__members__:
                        b_type = "OBSERVE"

                    renderer = (b.get("renderer") or "CANDLESTICK").upper()
                    if renderer not in RendererType.__members__:
                        renderer = "TEXT"

                    # Sanitize options: drop is_correct or correct_option_id
                    raw_options = b.get("options") or []
                    sanitized_options = [
                        {"id": str(o.get("id", f"opt_{i}")), "text": str(o.get("text", o))}
                        for i, o in enumerate(raw_options)
                    ] if raw_options else None

                    prov = b.get("provenance")
                    safe_prov = (
                        DataProvenance(
                            is_simulated=prov.get("is_simulated", False),
                            instrument=prov.get("instrument"),
                            exchange=prov.get("exchange"),
                            timeframe=prov.get("timeframe"),
                            historical_date_range=prov.get("historical_date_range"),
                            source_citation=prov.get("source_citation"),
                        )
                        if prov
                        else None
                    )

                    b_role = (b.get("evidence_role") or "NONE").upper()
                    if b_role not in EvidenceRole.__members__:
                        b_role = "NONE"

                    cog_str = (b.get("cognitive_level") or "RECOGNIZE").upper()
                    cog_level = CognitiveLevel[cog_str] if cog_str in CognitiveLevel.__members__ else None

                    diff_str = (b.get("difficulty") or "BEGINNER").upper()
                    diff_level = DifficultyLevel[diff_str] if diff_str in DifficultyLevel.__members__ else DifficultyLevel.BEGINNER

                    resp_str = (b.get("response_type") or "NONE").upper()
                    resp_type = ResponseType[resp_str] if resp_str in ResponseType.__members__ else ResponseType.NONE

                    safe_cards.append(
                        SafeActivityCard(
                            id=b.get("id", str(uuid.uuid4())),
                            activity_type=InteractionType(b_type),
                            renderer=RendererType(renderer),
                            evidence_role=EvidenceRole(b_role),
                            cognitive_level=cog_level,
                            difficulty=diff_level,
                            response_type=resp_type,
                            capability_ids=b.get("capability_ids") or [],
                            title=b.get("title", version.title),
                            prompt=b.get("prompt") or b.get("question"),
                            payload=b.get("payload") or b.get("content") or {},
                            provenance=safe_prov,
                            options=sanitized_options,
                        )
                    )

                lesson_contracts.append(
                    LessonExecutionContract(
                        id=lesson.id,
                        slug=lesson.slug,
                        title=version.title,
                        duration_minutes=version.duration_minutes,
                        learning_objectives=version.learning_objectives or [],
                        concept_slugs=[str(cid) for cid in (version.concept_ids or [])],
                        prerequisites=[str(p) for p in (version.prerequisite_ids or [])],
                        why_this_matters=f"Understand what {version.title} signals about period price discovery.",
                        after_lesson_capabilities=[
                            "Identify OHLC boundaries and candle direction",
                            "Explain buyer vs seller conviction over the timeframe",
                        ],
                        activities_preview=[c.title for c in safe_cards] or ["Visual Observation", "Predict & Discover"],
                        cards=safe_cards,
                        is_unlocked=is_unlocked,
                        status=status,
                        lock_reason=lock_reason,
                        module_slug=module.slug,
                        module_title=module.name,
                    )
                )

            unit_status = (
                LessonStatus.COMPLETED
                if all(l.status == LessonStatus.COMPLETED for l in lesson_contracts) and len(lesson_contracts) > 0
                else LessonStatus.AVAILABLE
            )

            unit_contracts.append(
                UnitContract(
                    id=unit.id,
                    slug=unit.slug,
                    title=unit.name,
                    description=unit.description or "Unit overview and structural mechanics.",
                    promised_capability="Understand period price movement and anatomy on any timeframe.",
                    estimated_minutes=sum(l.duration_minutes for l in lesson_contracts) or 20,
                    is_unlocked=True,
                    status=unit_status,
                    ordered_lessons=lesson_contracts,
                )
            )

        # Multi-dimensional progress metrics
        mastered_count = 0
        if user_id and all_module_concept_ids:
            mastered_count = await LearnerCurriculumStateService.get_mastered_concept_count(
                db, user_id, all_module_concept_ids
            )

        total_concepts = len(all_module_concept_ids)
        completed_ratio = (completed_lessons / total_lessons) if total_lessons > 0 else 0.0

        metrics = ModuleProgressMetrics(
            completed_lessons=completed_lessons,
            total_lessons=total_lessons,
            mastered_concepts=mastered_count,
            total_concepts=total_concepts,
            application_tier=LearnerCurriculumStateService.compute_application_tier(completed_ratio),
            transfer_tier=LearnerCurriculumStateService.compute_transfer_tier(mastered_count, total_concepts),
            completion_pct=int(completed_ratio * 100),
        )

        badge = LearnerCurriculumStateService.compute_badge_state(
            module.slug, completed_lessons, total_lessons, module_name=module.name
        )

        return unit_contracts, metrics, badge
