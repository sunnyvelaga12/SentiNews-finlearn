import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

class Domain(Base):
    __tablename__ = "domains"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    worlds = relationship("World", back_populates="domain", cascade="all, delete-orphan")

class World(Base):
    __tablename__ = "worlds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    domain_id = Column(UUID(as_uuid=True), ForeignKey("domains.id", ondelete="CASCADE"), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    domain = relationship("Domain", back_populates="worlds")
    series = relationship("Series", back_populates="world", cascade="all, delete-orphan")

class Series(Base):
    __tablename__ = "series"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    world_id = Column(UUID(as_uuid=True), ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    world = relationship("World", back_populates="series")
    modules = relationship("Module", back_populates="series", cascade="all, delete-orphan")

class Module(Base):
    """
    Curriculum Module entity.
    Hierarchy: Domain → World → Series → Module → Unit

    Module-level pedagogical metadata (learner_goal, why_this_matters, learning_outcomes,
    completion_criteria) is stored as DB columns so that the application layer never
    contains curriculum-specific logic. Adding a new domain (e.g. Macroeconomics, Options,
    Financial Statements) requires only a DB record — zero Python code changes.

    learning_outcomes is stored as JSONB (ordered array of strings) because:
    - Outcomes belong exclusively to one module (no cross-module sharing).
    - No FK references from other tables are required for outcomes individually.
    - Ordering is intrinsic (array index = display order).
    - If future analytics require outcome-level tracking, a normalized table
      can be introduced via a new migration without altering this column.
    """
    __tablename__ = "modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    series_id = Column(UUID(as_uuid=True), ForeignKey("series.id", ondelete="CASCADE"), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)

    # ── Pedagogical Metadata (DB-backed — never hardcoded in application code) ──
    learner_goal = Column(Text, nullable=True,
        comment="Single authoritative sentence describing what the learner will achieve.")
    why_this_matters = Column(Text, nullable=True,
        comment="Single authoritative sentence explaining the real-world relevance.")
    learning_outcomes = Column(JSONB, nullable=True, server_default='[]',
        comment="Ordered JSON array of strings listing specific measurable learning outcomes.")
    completion_criteria = Column(Text, nullable=True,
        comment="Human-readable completion and certification criteria.")
    estimated_hours = Column(Float, nullable=True, server_default="1.5")
    level = Column(String(20), nullable=True, server_default="BEGINNER",
        comment="Difficulty level: BEGINNER, INTERMEDIATE, or ADVANCED.")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    series = relationship("Series", back_populates="modules")
    units = relationship("Unit", back_populates="module", cascade="all, delete-orphan", order_by="Unit.order_index")

class Unit(Base):
    """
    Curriculum Unit entity.
    Hierarchy: Domain → World → Series → Module → Unit → UnitConcept → Concept
    """
    __tablename__ = "units"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    module = relationship("Module", back_populates="units")
    unit_concepts = relationship("UnitConcept", back_populates="unit", cascade="all, delete-orphan", order_by="UnitConcept.order_index")


class UnitConcept(Base):
    """
    Many-to-Many association between Curriculum Units and Knowledge Graph Concepts.
    Allows canonical knowledge nodes (e.g. 'Inflation') to be mapped and sequenced across
    multiple curriculum tracks without duplicating the underlying concept node or mastery state.
    """
    __tablename__ = "unit_concepts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="CASCADE"), nullable=False)
    concept_id = Column(UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    unit = relationship("Unit", back_populates="unit_concepts")
    concept = relationship("Concept")

    __table_args__ = (
        UniqueConstraint("unit_id", "concept_id", name="uq_unit_concept"),
    )

