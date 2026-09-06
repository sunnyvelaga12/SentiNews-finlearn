import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.learning import LearningSession, LearningSessionItem, LearningActivity, LearningObjective
from app.models.concept import Concept
from app.models.progress import ConceptMastery
from app.models.lesson import Lesson, LessonVersion
from app.schemas.content_authoring import StoredBlock, ResponseType, LearnerBlockSerializer
from app.services.content.content_projection_service import ContentProjectionService


class SessionGeneratorService:
    """Orchestrates session creation and compiles dynamic activity payloads with immutable snapshots."""

    @staticmethod
    async def create_session(
        db: AsyncSession,
        user_id: uuid.UUID,
        policy: str = "DEFAULT",
        lesson_version_id: Optional[uuid.UUID] = None,
    ) -> tuple[LearningSession, List[Dict[str, Any]]]:
        # 1. Resolve and enforce pinned published lesson version
        if not lesson_version_id:
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
            current_position=1,
            items=[]
        )
        db.add(session)
        await db.flush()

        # 2. Fetch pinned lesson version
        v_res = await db.execute(select(LessonVersion).where(LessonVersion.id == lesson_version_id))
        version = v_res.scalar_one_or_none()

        items_payload: List[Dict[str, Any]] = []

        # Option B: If version has blocks_json (canonical authoring source)
        if version and version.blocks_json:
            # 2a. Fetch or ensure projected activities for interactive blocks
            l_stmt = select(Lesson).where(Lesson.id == version.lesson_id)
            lesson = (await db.execute(l_stmt)).scalar_one_or_none()

            interactive_items: Dict[str, LearningSessionItem] = {}

            for idx, raw_block in enumerate(version.blocks_json):
                resp_type = raw_block.get("response_type")
                if not resp_type or resp_type in ("NONE", ResponseType.NONE):
                    continue

                b_id = str(raw_block.get("id"))
                expected_act_id = uuid.uuid5(version.id, b_id)

                act_stmt = (
                    select(LearningActivity)
                    .options(selectinload(LearningActivity.objective))
                    .where(LearningActivity.id == expected_act_id)
                )
                act_res = await db.execute(act_stmt)
                activity = act_res.scalar_one_or_none()

                if not activity and lesson:
                    # Projection on-the-fly safety net
                    await ContentProjectionService.project_lesson_version(db, version, lesson)
                    act_res = await db.execute(act_stmt)
                    activity = act_res.scalar_one_or_none()

                if not activity or not activity.objective:
                    raise ValueError(f"CANNOT_RESOLVE_ACTIVITY: Activity {expected_act_id} for block {b_id} not found.")

                eval_dict = raw_block.get("evaluation") or {}
                correct_opt_id = eval_dict.get("correct_option_id") or raw_block.get("correct_option_id")
                if not correct_opt_id and raw_block.get("options"):
                    for opt in raw_block["options"]:
                        if isinstance(opt, dict) and opt.get("is_correct"):
                            correct_opt_id = opt.get("id")
                            break

                explanation = (raw_block.get("feedback") or {}).get("explanation") or raw_block.get("explanation")
                eval_spec = {
                    "correct_option_id": correct_opt_id,
                    "correct_value": eval_dict.get("correct_value"),
                    "numeric_tolerance": eval_dict.get("numeric_tolerance", 0.05),
                    "accepted_answers": eval_dict.get("accepted_answers", []),
                    "misconception_map": eval_dict.get("misconception_map", {}),
                    "explanation": explanation,
                }

                stored_block = StoredBlock(**raw_block)
                client_payload = LearnerBlockSerializer.serialize(stored_block)
                # Attach correct_option_id and explanation for practice mode instant feedback
                client_payload["correct_option_id"] = correct_opt_id
                if explanation:
                    client_payload["explanation"] = explanation

                item = LearningSessionItem(
                    id=uuid.uuid4(),
                    session_id=session.id,
                    activity_id=activity.id,
                    concept_id=activity.objective.concept_id,
                    objective_id=activity.objective_id,
                    position=raw_block.get("order_index", idx + 1),
                    selection_reason="CURRICULUM_BLOCK",
                    status="PENDING",
                    payload_snapshot=client_payload,
                    evaluation_spec_snapshot=eval_spec,
                    learning_phase=raw_block.get("activity_type") or "PRACTICE",
                    interaction_type="MCQ",
                    activity_schema_version=1,
                )
                item.activity = activity
                db.add(item)
                interactive_items[b_id] = item

            # 2b. Assemble Option B Unified Stream sorted by order_index
            sorted_blocks = sorted(version.blocks_json, key=lambda b: b.get("order_index", 0))
            for idx, raw_block in enumerate(sorted_blocks):
                b_id = str(raw_block.get("id"))
                resp_type = raw_block.get("response_type")
                is_interactive = bool(resp_type and resp_type not in ("NONE", ResponseType.NONE))
                stored_block = StoredBlock(**raw_block)
                sanitized_payload = LearnerBlockSerializer.serialize(stored_block)

                # Extract correct_option_id for interactive practice blocks
                block_eval = raw_block.get("evaluation") or {}
                b_correct_id = block_eval.get("correct_option_id") or raw_block.get("correct_option_id")
                if not b_correct_id and raw_block.get("options"):
                    for opt in raw_block["options"]:
                        if isinstance(opt, dict) and opt.get("is_correct"):
                            b_correct_id = opt.get("id")
                            break
                if b_correct_id:
                    sanitized_payload["correct_option_id"] = b_correct_id
                b_expl = (raw_block.get("feedback") or {}).get("explanation") or raw_block.get("explanation")
                if b_expl:
                    sanitized_payload["explanation"] = b_expl

                pos = raw_block.get("order_index", idx + 1)
                title = (
                    raw_block.get("title")
                    or raw_block.get("content", {}).get("title")
                    or raw_block.get("content", {}).get("prompt")
                    or f"Block {pos}"
                )

                c_type = raw_block.get("content_type") or raw_block.get("renderer") or "TEXT"
                if is_interactive:
                    item = interactive_items.get(b_id)
                    items_payload.append({
                        "session_item_id": str(item.id) if item else f"item_{b_id}",
                        "activity_id": str(item.activity_id) if item else str(uuid.uuid5(version.id, b_id)),
                        "activity_type": raw_block.get("activity_type") or "PRACTICE",
                        "content_type": c_type,
                        "renderer": c_type,
                        "interaction_type": resp_type,
                        "is_interactive": True,
                        "correct_option_id": b_correct_id,
                        "learning_phase": item.learning_phase if item else (raw_block.get("activity_type") or "PRACTICE"),
                        "title": title,
                        "position": pos,
                        "selection_reason": item.selection_reason if item else "CURRICULUM_BLOCK",
                        "status": item.status if item else "PENDING",
                        "payload": sanitized_payload,
                    })
                else:
                    # Pure-content block
                    items_payload.append({
                        "session_item_id": f"content_{b_id}",
                        "activity_id": None,
                        "activity_type": raw_block.get("activity_type") or "EXPERIENCE",
                        "content_type": c_type,
                        "renderer": c_type,
                        "interaction_type": "NONE",
                        "is_interactive": False,
                        "learning_phase": raw_block.get("activity_type") or "EXPERIENCE",
                        "title": title,
                        "position": pos,
                        "selection_reason": "LESSON_STREAM",
                        "status": "COMPLETED",
                        "payload": sanitized_payload,
                    })

            await db.commit()
            return session, items_payload

        # Legacy fallback (when version has no blocks_json)
        concept_id = None
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

        activities = []
        if concept_id:
            activities_res = await db.execute(
                select(LearningActivity, LearningObjective)
                .join(LearningObjective, LearningActivity.objective_id == LearningObjective.id)
                .where(LearningObjective.concept_id == concept_id)
                .order_by(LearningActivity.created_at.asc())
            )
            activities = activities_res.all()

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
                "interaction_type": item.interaction_type,
                "is_interactive": True,
                "learning_phase": item.learning_phase,
                "title": activity.title if activity else "Activity",
                "position": item.position,
                "selection_reason": item.selection_reason,
                "status": item.status,
                "payload": item.payload_snapshot
            })
            position += 1

        await db.commit()
        return session, items_payload
