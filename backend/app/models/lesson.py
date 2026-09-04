import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    domain = Column(String(50), nullable=False)
    level = Column(String(20), default="BEGINNER", nullable=False)
    current_version_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    versions = relationship("LessonVersion", back_populates="lesson", foreign_keys="[LessonVersion.lesson_id]", cascade="all, delete-orphan")

class LessonVersion(Base):
    __tablename__ = "lesson_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id = Column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    title = Column(String(150), nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=5)
    learning_objectives = Column(JSONB, nullable=False)
    concept_ids = Column(JSONB, nullable=False)
    prerequisite_ids = Column(JSONB, nullable=False)
    blocks_json = Column(JSONB, nullable=False)
    questions_json = Column(JSONB, nullable=False)  # Embedded questions with stable UUID question_ids
    status = Column(String(30), default="DRAFT", nullable=False, index=True)  # DRAFT, EDITOR_REVIEW, FACT_CHECK, FINANCE_REVIEW, COMPLIANCE_REVIEW, APPROVED, PUBLISHED, REJECTED, ARCHIVED
    publish_at = Column(DateTime(timezone=True), nullable=True)
    unpublish_at = Column(DateTime(timezone=True), nullable=True)
    change_reason = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    lesson = relationship("Lesson", back_populates="versions", foreign_keys=[lesson_id])
