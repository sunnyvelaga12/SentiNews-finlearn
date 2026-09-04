import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    lesson_version_id = Column(UUID(as_uuid=True), ForeignKey("lesson_versions.id", ondelete="CASCADE"), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    score = Column(Float, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson_progress"),
    )

class ConceptMastery(Base):
    """
    Derived projection of concept-level mastery.

    Architecture Contract v3:
    - aggregate_version incremented on each mutation
    - last_event_sequence tracks latest applied aggregate_sequence
    - mastery_score is scaled integer ×100 (FC-5/A17): 8732 = 87.32%
    - Owned by LearningConceptAggregate — never locked independently
    """
    __tablename__ = "concept_mastery"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    mastery_score = Column(Integer, default=0, nullable=False)  # Scaled ×100: 8732 = 87.32% (FC-5/A17)
    confidence_level = Column(Float, default=0.5, nullable=False)
    evidence_count = Column(Integer, default=0, nullable=False)
    correct_count = Column(Integer, default=0, nullable=False)
    incorrect_count = Column(Integer, default=0, nullable=False)
    attempt_count = Column(Integer, default=0, nullable=False)
    error_count = Column(Integer, default=0, nullable=False)
    lapse_count = Column(Integer, default=0, nullable=False)
    active_recall_successes = Column(Integer, default=0, nullable=False)
    delayed_recall_successes = Column(Integer, default=0, nullable=False)
    unique_objective_successes = Column(Integer, default=0, nullable=False)
    unique_activity_successes = Column(Integer, default=0, nullable=False)
    first_exposed_at = Column(DateTime(timezone=True), nullable=True)
    last_attempted_at = Column(DateTime(timezone=True), nullable=True)
    last_correct_at = Column(DateTime(timezone=True), nullable=True)
    last_active_recall_at = Column(DateTime(timezone=True), nullable=True)
    last_delayed_recall_at = Column(DateTime(timezone=True), nullable=True)
    calculated_at = Column(DateTime(timezone=True), nullable=True)
    mastery_algorithm_version = Column(Integer, default=1, nullable=False)
    last_evaluated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Aggregate coordination (v3 contract — A4)
    aggregate_version = Column(Integer, default=0, nullable=False)
    last_event_sequence = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        Index("uq_mastery_user_concept", "user_id", "concept_id", unique=True),
    )

class ReviewItem(Base):
    __tablename__ = "review_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    review_stage = Column(Integer, default=1, nullable=False)  # 1 to 5
    stability_days = Column(Integer, default=1, nullable=False)
    lapses = Column(Integer, default=0, nullable=False)
    last_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    next_review_at = Column(DateTime(timezone=True), nullable=False)
    correct_count = Column(Integer, default=0, nullable=False)
    incorrect_count = Column(Integer, default=0, nullable=False)
    scheduler_version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("uq_user_concept_review", "user_id", "concept_id", unique=True),
    )

class ReviewAttempt(Base):
    __tablename__ = "review_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_item_id = Column(UUID(as_uuid=True), ForeignKey("review_items.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), nullable=False)  # Stable UUID within immutable LessonVersion JSON
    lesson_version_id = Column(UUID(as_uuid=True), ForeignKey("lesson_versions.id", ondelete="SET NULL"), nullable=True)
    scheduler_version = Column(Integer, default=1, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    confidence_rating = Column(Integer, nullable=False)  # 1 to 5
    response_time_ms = Column(Integer, nullable=True)
    idempotency_key = Column(String(128), nullable=True)
    attempted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
