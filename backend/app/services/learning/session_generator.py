import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.learning import LearningSession, LearningSessionItem, LearningActivity, LearningObjective
from app.models.concept import Concept
from app.models.progress import ConceptMastery


class SessionGeneratorService:
    """Orchestrates session creation and compiles dynamic activity payloads with immutable snapshots."""

    @staticmethod
    async def create_session(
        db: AsyncSession,
        user_id: uuid.UUID,
        policy: str = "DEFAULT",
        lesson_version_id: Optional[uuid.UUID] = None,
    ) -> LearningSession:
        # 1. Resolve and enforce pinned published lesson version
        if not lesson_version_id:
            from app.models.lesson import LessonVersion
            v_res = await db.execute(
                select(LessonVersion.id).where(LessonVersion.status == "PUBLISHED").order_by(LessonVersion.created_at.desc()).limit(1)
            )
            lesson_version_id = v_res.scalar_one_or_none()
            if not lesson_version_id:
                raise ValueError("LESSON_VERSION_REQUIRED: Cannot create a session without an active published lesson version.")

        session = LearningSession(
            id=uuid.uuid4(),
            user_id=user_id,
            lesson_version_id=lesson_version_id,
            policy=policy,
            status="ACTIVE",
            estimated_minutes=4,
            started_at=datetime.now(timezone.utc),
            items=[]
        )
        db.add(session)
        await db.flush()

        # 2. Fetch candidate concept from pinned version if available
        concept_id = None
        if lesson_version_id:
            from app.models.lesson import LessonVersion
            v_res = await db.execute(select(LessonVersion).where(LessonVersion.id == lesson_version_id))
            version = v_res.scalar_one_or_none()
            if version and version.concept_ids:
                try:
                    concept_id = uuid.UUID(version.concept_ids[0])
                except (ValueError, TypeError):
                    c_res = await db.execute(select(Concept).where(Concept.slug == str(version.concept_ids[0])))
                    c_obj = c_res.scalar_one_or_none()
                    if c_obj:
                        concept_id = c_obj.id

        if not concept_id:
            m_res = await db.execute(
                select(ConceptMastery.concept_id).where(ConceptMastery.user_id == user_id).order_by(ConceptMastery.last_evaluated_at.desc()).limit(1)
            )
            concept_id = m_res.scalar_one_or_none()

        if not concept_id:
            concept_res = await db.execute(
                select(Concept).where(Concept.status == "PUBLISHED").order_by(Concept.created_at.asc()).limit(1)
            )
            concept = concept_res.scalar_one_or_none()
            if concept:
                concept_id = concept.id

        # 3. Fetch activities for concept via objectives
        activities = []
        if concept_id:
            activities_res = await db.execute(
                select(LearningActivity, LearningObjective)
                .join(LearningObjective, LearningActivity.objective_id == LearningObjective.id)
                .where(LearningObjective.concept_id == concept_id)
                .order_by(LearningActivity.created_at.asc())
            )
            activities = activities_res.all()

        # 4. Populate LearningSessionItems with frozen snapshots (Invariant I7 & I17)
        items_payload = []
        position = 1
        for activity, objective in activities:
            raw_payload = dict(activity.payload or {})
            eval_spec = {
                "correct_option_id": raw_payload.get("correct_option_id"),
                "correct_value": raw_payload.get("correct_value"),
                "numeric_tolerance": raw_payload.get("numeric_tolerance", 0.05),
                "accepted_answers": raw_payload.get("accepted_answers", []),
                "misconception_map": raw_payload.get("misconception_map", {}),
                "explanation": raw_payload.get("explanation"),
            }

            # Sanitized payload for client (do not leak answer keys)
            client_payload = {k: v for k, v in raw_payload.items() if k not in ("correct_option_id", "correct_value", "accepted_answers")}
            if "options" in client_payload and isinstance(client_payload["options"], list):
                client_payload["options"] = [
                    {opt_k: opt_v for opt_k, opt_v in opt.items() if opt_k != "is_correct"}
                    for opt in client_payload["options"]
                ]

            item = LearningSessionItem(
                id=uuid.uuid4(),
                session_id=session.id,
                activity_id=activity.id,
                concept_id=concept_id,
                objective_id=objective.id,
                position=position,
                selection_reason="NEXT_CONCEPT",
                status="PENDING",
                payload_snapshot=client_payload,
                evaluation_spec_snapshot=eval_spec,
                learning_phase=getattr(activity, "learning_phase", None) or activity.activity_type or "RETRIEVE",
                interaction_type=getattr(activity, "interaction_type", None) or "MCQ",
                activity_schema_version=1,
            )
            item.activity = activity
            db.add(item)
            items_payload.append({
                "session_item_id": str(item.id),
                "activity_id": str(activity.id),
                "activity_type": item.interaction_type,
                "learning_phase": item.learning_phase,
                "title": activity.title if activity else "Activity",
                "position": item.position,
                "selection_reason": item.selection_reason,
                "payload": item.payload_snapshot
            })
            position += 1

        await db.commit()
        return session, items_payload
