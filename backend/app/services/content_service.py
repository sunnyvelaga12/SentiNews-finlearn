import uuid
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.lesson import Lesson, LessonVersion
from app.models.content_review import AuditLog
from app.schemas.content_authoring import LessonAuthoringSchema
from app.services.content.content_integrity_validator import ContentIntegrityValidator
from app.services.content.pedagogical_validator import PedagogicalValidator


class ContentPublicationService:
    """
    Canonical Content Publication Service (Domain Authority).
    Enforces atomic, verified, audited, and IDEMPOTENT publication of curriculum content.
    Used uniformly by HTTP API routes, admin tooling, and CLI/import workers.
    """

    REQUIRED_APPROVAL_ROLES = {"CONTENT_REVIEWER", "FINANCE_REVIEWER", "COMPLIANCE_REVIEWER"}

    @classmethod
    async def publish_lesson_version(
        cls,
        session: AsyncSession,
        lesson_id: uuid.UUID,
        version_id: uuid.UUID,
        actor_id: uuid.UUID,
        actor_role: str,
        notes: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes complete lesson publication within the caller's transaction:
        1. Fetch and verify Lesson and LessonVersion
        2. Verify RBAC permissions (PUBLISHER or SUPER_ADMIN)
        3. Check publication idempotency (return success if already published, conflict if key reused for different target)
        4. Verify required review approvals
        5. Validate graph and concept publish dependencies
        6. Atomically transition state
        7. Append AuditLog
        8. Enqueue OutboxEvent
        """
        if actor_role not in ["PUBLISHER", "SUPER_ADMIN"]:
            raise ValueError("UNAUTHORIZED_PUBLISH_ROLE: Only PUBLISHER or SUPER_ADMIN may publish content.")

        # 1. Fetch Version and Lesson
        v_stmt = select(LessonVersion).where(LessonVersion.id == version_id)
        v_res = await session.execute(v_stmt)
        version = v_res.scalar_one_or_none()

        if not version or version.lesson_id != lesson_id:
            raise ValueError("LESSON_VERSION_NOT_FOUND: Specified version does not exist or does not belong to lesson.")

        # 2. Idempotency Check
        if idempotency_key:
            audit_stmt = select(AuditLog).where(
                AuditLog.action.like(f"PUBLISH_LESSON_VERSION_KEY_{idempotency_key}%")
            )
            a_res = await session.execute(audit_stmt)
            existing_audit = a_res.scalar_one_or_none()
            if existing_audit:
                if existing_audit.resource_id != str(version_id):
                    raise ValueError(f"IDEMPOTENCY_KEY_CONFLICT: Key {idempotency_key} was already used for a different publishing operation.")
                return {
                    "status": "SUCCESS",
                    "message": "Lesson version already published (Idempotent Key Replay).",
                    "lesson_id": str(lesson_id),
                    "version_id": str(version_id),
                    "version_number": version.version_number,
                    "is_idempotent_replay": True,
                }

        if version.status == "PUBLISHED":
            if idempotency_key:
                return {
                    "status": "SUCCESS",
                    "message": "Lesson version already published (Idempotent).",
                    "lesson_id": str(lesson_id),
                    "version_id": str(version_id),
                    "version_number": version.version_number,
                    "is_idempotent_replay": True,
                }
            raise ValueError("LESSON_VERSION_ALREADY_PUBLISHED: This version has already been published.")

        # 3. Check RBAC Review Approvals
        if actor_role != "SUPER_ADMIN" and version.status != "APPROVED":
            rev_stmt = select(AuditLog).where(
                AuditLog.resource_id == str(version.id),
                AuditLog.action == "LESSON_VERSION_APPROVED"
            )
            rev_res = await session.execute(rev_stmt)
            approved_reviews = rev_res.scalars().all()
            approved_roles = {r.reason for r in approved_reviews if r.reason}

            if not cls.REQUIRED_APPROVAL_ROLES.issubset(approved_roles):
                missing = cls.REQUIRED_APPROVAL_ROLES - approved_roles
                raise ValueError(f"MISSING_REQUIRED_APPROVALS: Missing required approvals from {missing}")

        # 4. Strict Publish Dependency Validation
        deps_valid, dep_errors = await ContentIntegrityValidator.validate_publish_dependencies(session, version)
        if not deps_valid:
            raise ValueError(f"PUBLISH_DEPENDENCY_ERROR: {'; '.join(dep_errors)}")

        # 5. State Transitions
        now = datetime.now(timezone.utc)
        version.status = "PUBLISHED"
        version.publish_at = now

        lesson_stmt = select(Lesson).where(Lesson.id == lesson_id)
        l_res = await session.execute(lesson_stmt)
        lesson = l_res.scalar_one()
        lesson.current_version_id = version.id
        lesson.updated_at = now

        # 6. Audit Log
        action_name = f"PUBLISH_LESSON_VERSION_KEY_{idempotency_key}" if idempotency_key else "PUBLISH_LESSON_VERSION"
        audit = AuditLog(
            actor_id=actor_id,
            action=action_name,
            resource_type="LessonVersion",
            resource_id=str(version.id),
            reason=notes,
            new_state={"version_number": version.version_number, "status": "PUBLISHED", "idempotency_key": idempotency_key}
        )
        session.add(audit)

        return {
            "status": "SUCCESS",
            "message": "Lesson version published atomically.",
            "lesson_id": str(lesson.id),
            "version_id": str(version.id),
            "version_number": version.version_number,
            "is_idempotent_replay": False,
        }


class ContentService:
    @classmethod
    def validate_lesson_data(cls, lesson_data: Dict[str, Any]) -> LessonAuthoringSchema:
        """Pure in-memory validation using canonical Pydantic model."""
        return LessonAuthoringSchema(**lesson_data)

    @classmethod
    def validate_content_completeness(cls, version: LessonVersion) -> Tuple[bool, List[str]]:
        """
        Content Completeness Quality Gate:
        Ensures a lesson draft is pedagogically complete before allowing submission for review.
        """
        errors = []
        if not version.title or len(version.title.strip()) < 3:
            errors.append("Lesson title must be at least 3 characters.")
        if not version.learning_objectives or len(version.learning_objectives) == 0:
            errors.append("At least one learning objective is required.")
        if not version.blocks_json or len(version.blocks_json) == 0:
            errors.append("At least one pedagogical activity block is required.")
        
        # Check evidence role completeness
        for idx, b in enumerate(version.blocks_json or []):
            role = b.get("evidence_role", "NONE")
            if role == "MASTERY_EVIDENCE":
                if not b.get("prompt") and not b.get("title"):
                    errors.append(f"Block #{idx+1} has evidence_role=MASTERY_EVIDENCE but lacks a prompt/title.")
                if b.get("type", "").upper() in ["PREDICT", "MISCONCEPTION_CHECK", "APPLICATION", "TRANSFER"]:
                    if not b.get("options") and not b.get("correct_option_id"):
                        # Ensure either options or prompt specification is present
                        if not b.get("prompt"):
                            errors.append(f"Assessment block #{idx+1} must contain valid question options or prompt.")

        return len(errors) == 0, errors

    @classmethod
    async def create_lesson_draft(
        cls,
        session: AsyncSession,
        lesson_data: Dict[str, Any],
        creator_id: uuid.UUID
    ) -> LessonVersion:
        validated = cls.validate_lesson_data(lesson_data)

        slug = validated.slug
        domain = validated.domain
        level = validated.level

        # Check existing lesson
        stmt = select(Lesson).where(Lesson.slug == slug)
        res = await session.execute(stmt)
        lesson = res.scalar_one_or_none()

        if not lesson:
            lesson = Lesson(slug=slug, domain=domain, level=level)
            session.add(lesson)
            await session.flush()

        # Query max version
        v_stmt = select(LessonVersion).where(LessonVersion.lesson_id == lesson.id).order_by(LessonVersion.version_number.desc())
        v_res = await session.execute(v_stmt)
        latest_version = v_res.scalars().first()
        next_version = (latest_version.version_number + 1) if latest_version else 1

        new_version = LessonVersion(
            lesson_id=lesson.id,
            version_number=next_version,
            title=validated.title,
            duration_minutes=validated.duration_minutes,
            learning_objectives=validated.learning_objectives,
            concept_ids=validated.concept_ids or validated.concept_slugs,
            prerequisite_ids=validated.prerequisite_slugs,
            blocks_json=[b.model_dump() for b in validated.blocks],
            questions_json=[q.model_dump() for q in validated.questions],
            status="DRAFT",
            created_by=creator_id
        )
        session.add(new_version)
        await session.flush()
        return new_version

    @classmethod
    async def update_lesson_draft(
        cls,
        session: AsyncSession,
        version_id: uuid.UUID,
        update_data: Dict[str, Any],
        actor_id: uuid.UUID,
        expected_version: Optional[int] = None
    ) -> LessonVersion:
        """
        Updates an existing draft with Optimistic Concurrency Control (OCC).
        Raises ValueError if expected_version does not match the active draft version.
        """
        stmt = select(LessonVersion).where(LessonVersion.id == version_id)
        res = await session.execute(stmt)
        version = res.scalar_one_or_none()

        if not version:
            raise ValueError("LESSON_VERSION_NOT_FOUND")

        if version.status == "PUBLISHED":
            raise ValueError("PUBLISHED_LESSON_IMMUTABLE: Cannot update a published lesson version directly.")

        # Optimistic Concurrency Control Check
        if expected_version is not None and version.version_number != expected_version:
            raise ValueError(f"DRAFT_OCC_CONFLICT: This draft changed while you were editing it. Expected v{expected_version}, found v{version.version_number}.")

        if "title" in update_data and update_data["title"]:
            version.title = update_data["title"]
        if "duration_minutes" in update_data and update_data["duration_minutes"] is not None:
            version.duration_minutes = update_data["duration_minutes"]
        if "learning_objectives" in update_data and update_data["learning_objectives"] is not None:
            version.learning_objectives = update_data["learning_objectives"]
        if "concept_ids" in update_data and update_data["concept_ids"] is not None:
            version.concept_ids = update_data["concept_ids"]
        if "prerequisite_ids" in update_data and update_data["prerequisite_ids"] is not None:
            version.prerequisite_ids = update_data["prerequisite_ids"]
        if "blocks" in update_data and update_data["blocks"] is not None:
            version.blocks_json = [
                b.model_dump() if hasattr(b, "model_dump") else b
                for b in update_data["blocks"]
            ]
        if "questions" in update_data and update_data["questions"] is not None:
            version.questions_json = [
                q.model_dump() if hasattr(q, "model_dump") else q
                for q in update_data["questions"]
            ]

        # Audit Log
        audit = AuditLog(
            actor_id=actor_id,
            action="UPDATE_LESSON_DRAFT",
            resource_type="LessonVersion",
            resource_id=str(version.id),
            reason="Author draft edit",
            new_state={"version_number": version.version_number, "status": version.status}
        )
        session.add(audit)
        await session.flush()
        return version

    @classmethod
    async def transition_version_status(
        cls,
        session: AsyncSession,
        version_id: uuid.UUID,
        new_status: str,
        actor_id: uuid.UUID,
        actor_role: str,
        notes: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> LessonVersion:
        stmt = select(LessonVersion).where(LessonVersion.id == version_id)
        res = await session.execute(stmt)
        version = res.scalar_one_or_none()

        if not version:
            raise ValueError("LESSON_VERSION_NOT_FOUND")

        if version.status == "PUBLISHED" and new_status not in ["ARCHIVED", "PUBLISHED"]:
            raise ValueError("PUBLISHED_LESSON_IMMUTABLE: Published lesson versions cannot change status.")

        # Content Completeness & Pedagogical Gate when submitting for review
        if new_status in ["EDITOR_REVIEW", "FINANCE_REVIEW", "COMPLIANCE_REVIEW"]:
            is_complete, errors = cls.validate_content_completeness(version)
            if not is_complete:
                raise ValueError(f"CONTENT_COMPLETENESS_FAILED: {'; '.join(errors)}")

            pedagogy_valid, ped_errors = PedagogicalValidator.validate_pedagogy(version)
            if not pedagogy_valid:
                raise ValueError(f"PEDAGOGICAL_VALIDATION_FAILED: {'; '.join(ped_errors)}")

        if new_status == "PUBLISHED":
            await ContentPublicationService.publish_lesson_version(
                session=session,
                lesson_id=version.lesson_id,
                version_id=version.id,
                actor_id=actor_id,
                actor_role=actor_role,
                notes=notes,
                idempotency_key=idempotency_key,
            )
            return version

        version.status = new_status

        # Add Audit log
        audit = AuditLog(
            actor_id=actor_id,
            action=f"TRANSITION_STATUS_{new_status}",
            resource_type="LessonVersion",
            resource_id=str(version.id),
            reason=notes,
            new_state={"status": new_status, "version_number": version.version_number, "idempotency_key": idempotency_key}
        )
        session.add(audit)

        return version
