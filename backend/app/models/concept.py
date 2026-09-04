import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class Concept(Base):
    __tablename__ = "concepts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    learning_objective = Column(Text, nullable=True)
    domain = Column(String(50), nullable=False)  # stocks, markets, fundamentals, personal_finance, technical_analysis
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="SET NULL"), nullable=True)
    level = Column(String(20), default="BEGINNER", nullable=False)  # BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
    tags = Column(JSONB, nullable=False, default=list)
    status = Column(String(20), default="PUBLISHED", nullable=False)  # DRAFT, PUBLISHED, ARCHIVED
    jurisdiction = Column(String(10), server_default="GLOBAL", default="GLOBAL", nullable=False)
    effective_from = Column(DateTime(timezone=True), nullable=True)
    effective_to = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    outgoing_relationships = relationship("ConceptRelationship", foreign_keys="[ConceptRelationship.source_concept_id]", back_populates="source_concept", cascade="all, delete-orphan")
    incoming_relationships = relationship("ConceptRelationship", foreign_keys="[ConceptRelationship.target_concept_id]", back_populates="target_concept", cascade="all, delete-orphan")

class ConceptRelationship(Base):
    __tablename__ = "concept_relationships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    target_concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(50), nullable=False)  # PREREQUISITE, RELATED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    source_concept = relationship("Concept", foreign_keys=[source_concept_id], back_populates="outgoing_relationships")
    target_concept = relationship("Concept", foreign_keys=[target_concept_id], back_populates="incoming_relationships")

    __table_args__ = (
        Index("uq_source_target_rel_type", "source_concept_id", "target_concept_id", "relationship_type", unique=True),
    )
