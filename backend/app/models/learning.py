import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class LearningObjective(Base):
    __tablename__ = "learning_objectives"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    taxonomy_level = Column(String(50), default="UNDERSTAND", nullable=False)  # REMEMBER, UNDERSTAND, APPLY, ANALYZE
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    concept = relationship("Concept", backref="objectives")
    activities = relationship("LearningActivity", back_populates="objective", cascade="all, delete-orphan")


class LearningActivity(Base):
    __tablename__ = "learning_activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    objective_id = Column(UUID(as_uuid=True), ForeignKey("learning_objectives.id", ondelete="CASCADE"), nullable=False)
    activity_type = Column(String(50), nullable=False)  # EXPERIENCE, PREDICT, EXPLAIN, APPLY, RETRIEVE, REFLECT
    learning_phase = Column(String(50), default="RETRIEVE", nullable=False)
    interaction_type = Column(String(50), default="MCQ", nullable=False)
    title = Column(String(200), nullable=False)
    payload = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    objective = relationship("LearningObjective", back_populates="activities")


class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lesson_version_id = Column(UUID(as_uuid=True), ForeignKey("lesson_versions.id", ondelete="RESTRICT"), nullable=True)
    policy = Column(String(50), default="DEFAULT", nullable=False)  # DEFAULT, CRITICAL_REVIEW, NEW_LEARNER, MASTERY_DRILL, QUICK_3MIN
    status = Column(String(20), default="ACTIVE", nullable=False)  # ACTIVE, COMPLETED, ABANDONED
    estimated_minutes = Column(Integer, default=4, nullable=False)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    current_position = Column(Integer, default=1, nullable=False)

    items = relationship("LearningSessionItem", back_populates="session", cascade="all, delete-orphan", order_by="LearningSessionItem.position", lazy="selectin")


class LearningSessionItem(Base):
    __tablename__ = "learning_session_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="CASCADE"), nullable=False)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    objective_id = Column(UUID(as_uuid=True), ForeignKey("learning_objectives.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False)
    selection_reason = Column(String(100), default="NEXT_CONCEPT", nullable=False)  # REVIEW_DUE, NEXT_CONCEPT, PRACTICE
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING, COMPLETED, SKIPPED
    payload_snapshot = Column(JSONB, default=dict, nullable=False)
    evaluation_spec_snapshot = Column(JSONB, default=dict, nullable=False)
    learning_phase = Column(String(50), default="RETRIEVE", nullable=False)
    interaction_type = Column(String(50), default="MCQ", nullable=False)
    activity_schema_version = Column(Integer, default=1, nullable=False)

    session = relationship("LearningSession", back_populates="items")
    activity = relationship("LearningActivity", lazy="selectin")
    concept = relationship("Concept", lazy="selectin")
    objective = relationship("LearningObjective", lazy="selectin")


class LearningAttempt(Base):
    """
    Canonical Evidence Layer — Immutable record of learner interactions.

    Architecture Contract v3 — Key properties:
    - Immutable after INSERT (A5) — DB trigger rejects UPDATE/DELETE after Migration 4
    - One attempt per session_item (A10/A15) — UNIQUE(session_item_id)
    - One concept per attempt in Phase 2A.1 (A11)
    - Deterministic aggregate ordering (A4/A16) — UNIQUE(user_id, concept_id, aggregate_sequence)
    - Scaled integer score (A17/FC-5) — 0–10000 represents 0.0000–1.0000
    - Evidence envelope consolidation — evidence_snapshot replaces 4 separate JSON columns
    - Response snapshot built BEFORE INSERT, never mutated after
    """
    __tablename__ = "learning_attempts"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_user_idempotency_key"),
        UniqueConstraint("session_item_id", name="uq_one_attempt_per_session_item"),
        UniqueConstraint("user_id", "concept_id", "aggregate_sequence", name="uq_aggregate_sequence"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False)
    session_item_id = Column(UUID(as_uuid=True), ForeignKey("learning_session_items.id", ondelete="CASCADE"), nullable=False)
    activity_id = Column(UUID(as_uuid=True), ForeignKey("learning_activities.id", ondelete="CASCADE"), nullable=False)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    objective_id = Column(UUID(as_uuid=True), ForeignKey("learning_objectives.id", ondelete="CASCADE"), nullable=False)

    # Canonical ordering — monotonic per (user_id, concept_id), assigned inside aggregate lock (A4)
    aggregate_sequence = Column(Integer, nullable=True)  # nullable during Migration 1-2, NOT NULL after Migration 3

    response_json = Column(JSONB, nullable=False)
    evaluation_status = Column(String(20), default="EVALUATED", nullable=False)  # EVALUATED, PENDING
    is_correct = Column(Boolean, nullable=False)
    score = Column(Integer, default=10000, nullable=False)  # Scaled ×10000: 10000 = 1.0 (FC-5/A17)
    confidence_rating = Column(Integer, nullable=True)  # 1 to 5 (optional)
    response_time_ms = Column(Integer, nullable=True)
    idempotency_key = Column(String(128), nullable=True, index=True)
    request_fingerprint = Column(String(64), nullable=True)

    # Consolidated evidence envelope (v3 contract)
    evidence_snapshot = Column(JSONB, nullable=True)  # nullable during Migration 1-2, NOT NULL after Migration 3
    response_snapshot = Column(JSONB, nullable=True)  # nullable during Migration 1-2, NOT NULL after Migration 3

    # Legacy columns — retained for Migration 2 backfill, dropped in Migration 4
    evaluation_json = Column(JSONB, nullable=True)
    context_json = Column(JSONB, nullable=True)
    evidence_json = Column(JSONB, nullable=True)
    versions_json = Column(JSONB, nullable=True)
    attempt_result_snapshot = Column(JSONB, nullable=True)

    # Timestamps
    attempted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    received_at = Column(DateTime(timezone=True), nullable=True)  # Server receipt time, distinct from attempted_at

