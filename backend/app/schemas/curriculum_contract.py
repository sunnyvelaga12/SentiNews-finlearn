"""
Curriculum Domain Contracts — SentiNews Learn V0.4 / V1.0
Canonical Pydantic models for both Authoring and Learner Execution layers.
"""
import uuid
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field


# ── Canonical Publication Lifecycle State Machine ─────────────────────────────
class PublicationState(str, Enum):
    DRAFT = "DRAFT"
    EDITOR_REVIEW = "EDITOR_REVIEW"
    FINANCE_REVIEW = "FINANCE_REVIEW"
    COMPLIANCE_REVIEW = "COMPLIANCE_REVIEW"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


# ── Pedagogical Interaction & Renderer Types ──────────────────────────────────
class InteractionType(str, Enum):
    OBSERVE = "OBSERVE"
    PREDICT = "PREDICT"
    EXPLAIN = "EXPLAIN"
    PRACTICE = "PRACTICE"
    MARKET_EXAMPLE = "MARKET_EXAMPLE"
    MISCONCEPTION_CHECK = "MISCONCEPTION_CHECK"
    APPLICATION = "APPLICATION"
    EXPLAIN_BACK = "EXPLAIN_BACK"
    TRANSFER = "TRANSFER"


class RendererType(str, Enum):
    CANDLESTICK = "CANDLESTICK"
    CHART = "CHART"
    TABLE = "TABLE"
    TEXT = "TEXT"
    CALCULATOR = "CALCULATOR"
    FINANCIAL_STATEMENT = "FINANCIAL_STATEMENT"


class EvidenceRole(str, Enum):
    """
    Explicit evidence role defining how interaction data is treated by the learning engine:
    - NONE: Orientation, passive visual observation, narrative explanation. Zero mastery impact.
    - FORMATIVE: Low-stakes practice / exploration sliders. Provides immediate feedback without diminishing mastery score.
    - DIAGNOSTIC: Detects specific misconceptions or learner baseline state.
    - MASTERY_EVIDENCE: High-fidelity evaluation (Prediction, Application, Transfer) producing verified evidence for concept mastery.
    """
    NONE = "NONE"
    FORMATIVE = "FORMATIVE"
    DIAGNOSTIC = "DIAGNOSTIC"
    MASTERY_EVIDENCE = "MASTERY_EVIDENCE"


class CognitiveLevel(str, Enum):
    RECOGNIZE = "RECOGNIZE"
    RECALL = "RECALL"
    EXPLAIN = "EXPLAIN"
    MANIPULATE = "MANIPULATE"
    APPLY = "APPLY"
    TRANSFER = "TRANSFER"
    TEACH = "TEACH"


class DifficultyLevel(str, Enum):
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"


class ResponseType(str, Enum):
    NONE = "NONE"
    SINGLE_CHOICE = "SINGLE_CHOICE"
    MULTI_CHOICE = "MULTI_CHOICE"
    SLIDER = "SLIDER"
    NUMERIC = "NUMERIC"
    DRAG_DROP = "DRAG_DROP"
    ORDERING = "ORDERING"


class LessonStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    AVAILABLE = "AVAILABLE"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    LOCKED = "LOCKED"


# ── Data Provenance Model ─────────────────────────────────────────────────────
class DataProvenanceLevel(str, Enum):
    EDUCATIONAL_ILLUSTRATION = "EDUCATIONAL_ILLUSTRATION"
    SIMULATED_MARKET_DATA = "SIMULATED_MARKET_DATA"
    HISTORICAL_MARKET_DATA = "HISTORICAL_MARKET_DATA"
    LIVE_MARKET_DATA = "LIVE_MARKET_DATA"


class DataProvenance(BaseModel):
    provenance_level: DataProvenanceLevel = DataProvenanceLevel.SIMULATED_MARKET_DATA
    is_simulated: bool = False
    instrument: Optional[str] = None
    exchange: Optional[str] = None
    timeframe: Optional[str] = None
    historical_date_range: Optional[str] = None
    simulation_method: Optional[str] = None
    source_basis: Optional[str] = None
    source_citation: Optional[str] = None
    disclaimer: str = "For educational market demonstration only. Not investment advice."


# ── Learner Execution Layer (Sanitized: NO answers or evaluation keys) ────────
class SafeActivityCard(BaseModel):
    id: str
    activity_type: InteractionType
    renderer: RendererType
    evidence_role: EvidenceRole = EvidenceRole.NONE
    cognitive_level: Optional[CognitiveLevel] = None
    difficulty: Optional[DifficultyLevel] = DifficultyLevel.BEGINNER
    response_type: Optional[ResponseType] = ResponseType.NONE
    capability_ids: List[str] = Field(default_factory=list)
    title: str
    prompt: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    provenance: Optional[DataProvenance] = None
    options: Optional[List[Dict[str, Any]]] = None  # {id, text, media_asset_id, image_url} - NO correct answers or secrets


class LessonExecutionContract(BaseModel):
    schema_version: str = "1.0"
    content_version: int = 1
    id: uuid.UUID
    slug: str
    title: str
    duration_minutes: int
    learning_objectives: List[str]
    concept_slugs: List[str]
    prerequisites: List[str]
    why_this_matters: str
    after_lesson_capabilities: List[str]
    activities_preview: List[str]
    cards: List[SafeActivityCard] = Field(default_factory=list)
    is_unlocked: bool = True
    status: LessonStatus = LessonStatus.AVAILABLE
    lock_reason: Optional[str] = None
    module_slug: Optional[str] = None
    module_title: Optional[str] = None


class UnitContract(BaseModel):
    schema_version: str = "1.0"
    id: uuid.UUID
    slug: str
    title: str
    description: str
    promised_capability: str
    estimated_minutes: int
    is_unlocked: bool
    status: LessonStatus
    ordered_lessons: List[LessonExecutionContract]


class ModuleProgressMetrics(BaseModel):
    completed_lessons: int
    total_lessons: int
    mastered_concepts: int
    total_concepts: int
    application_tier: str = "BEGINNING"  # BEGINNING, DEVELOPING, COMPETENT, ADVANCED
    transfer_tier: str = "BEGINNING"
    completion_pct: int


class BadgeContract(BaseModel):
    id: str
    title: str
    description: str
    status: str = "LOCKED"  # LOCKED, IN_PROGRESS, EARNED
    credential_claim: str
    awarded_at: Optional[str] = None


class ModuleChallengeContract(BaseModel):
    id: str
    title: str
    description: str
    target_capability: str
    passing_score_pct: int = 80
    is_unlocked: bool = False


class ModuleContract(BaseModel):
    schema_version: str = "1.0"
    id: uuid.UUID
    slug: str
    title: str
    description: str
    learner_goal: str
    why_this_matters: str
    level: str = "BEGINNER"
    prerequisites: List[str]
    learning_outcomes: List[str]
    estimated_hours: float = 1.5
    ordered_units: List[UnitContract]
    completion_criteria: str
    challenge: ModuleChallengeContract
    badge: BadgeContract
    progress: ModuleProgressMetrics


class ModuleSummary(BaseModel):
    schema_version: str = "1.0"
    id: uuid.UUID
    slug: str
    title: str
    description: str
    level: str
    total_units: int
    total_lessons: int
    estimated_hours: float
    progress: ModuleProgressMetrics
    badge: BadgeContract


class ModuleCatalogResponse(BaseModel):
    schema_version: str = "1.0"
    items: List[ModuleSummary]
    page: int = 1
    page_size: int = 20
    total_items: int = 0
    total_pages: int = 1


# ── Authoring Layer (Rich: For Content Studio & Governance) ───────────────────
class AuthoringActivityCard(BaseModel):
    id: str
    activity_type: InteractionType
    renderer: RendererType
    evidence_role: EvidenceRole = EvidenceRole.NONE
    cognitive_level: Optional[CognitiveLevel] = None
    difficulty: Optional[DifficultyLevel] = DifficultyLevel.BEGINNER
    response_type: Optional[ResponseType] = ResponseType.NONE
    capability_ids: List[str] = Field(default_factory=list)
    misconception_ids: List[str] = Field(default_factory=list)
    title: str
    prompt: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    provenance: Optional[DataProvenance] = None
    options: Optional[List[Dict[str, Any]]] = None
    correct_option_id: Optional[str] = None
    explanation: Optional[str] = None
    misconception_remediation: Optional[str] = None


class LessonAuthoringDraft(BaseModel):
    schema_version: str = "1.0"
    lesson_id: Optional[uuid.UUID] = None
    version_id: Optional[uuid.UUID] = None
    version_number: int = 1
    version_etag: Optional[str] = None
    unit_id: Optional[uuid.UUID] = None
    slug: str
    title: str
    duration_minutes: int = 5
    learning_objectives: List[str]
    concept_ids: List[str]
    prerequisite_ids: List[str] = Field(default_factory=list)
    why_this_matters: str = ""
    after_lesson_capabilities: List[str] = Field(default_factory=list)
    cards: List[AuthoringActivityCard] = Field(default_factory=list)
    status: PublicationState = PublicationState.DRAFT
    change_reason: Optional[str] = None
    editorial_notes: Optional[str] = None
    updated_at: Optional[datetime] = None


class DraftUpdateRequest(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    duration_minutes: Optional[int] = None
    learning_objectives: Optional[List[str]] = None
    concept_ids: Optional[List[str]] = None
    prerequisite_ids: Optional[List[str]] = None
    why_this_matters: Optional[str] = None
    after_lesson_capabilities: Optional[List[str]] = None
    cards: Optional[List[AuthoringActivityCard]] = None
    expected_version: Optional[int] = None  # Optimistic concurrency check


class StateTransitionRequest(BaseModel):
    new_status: PublicationState
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None


class ModuleCreateRequest(BaseModel):
    """
    Request schema for creating a new curriculum module.
    All pedagogical metadata fields are optional — they can be filled in at creation
    time or updated later via PATCH. The application layer never infers or hardcodes
    these values from module slug or name.
    """
    domain_id: Optional[uuid.UUID] = None
    series_id: Optional[uuid.UUID] = None
    slug: Optional[str] = None
    name: str
    description: Optional[str] = None
    order_index: int = 0
    # DB-backed pedagogical metadata — replaces all hardcoded slug-based branching
    learner_goal: Optional[str] = None
    why_this_matters: Optional[str] = None
    learning_outcomes: Optional[List[str]] = None
    completion_criteria: Optional[str] = None
    estimated_hours: Optional[float] = None
    level: Optional[str] = "BEGINNER"


class ModuleUpdateRequest(BaseModel):
    """
    Request schema for updating curriculum module metadata.
    All fields are optional; only supplied fields are written.
    """
    domain_id: Optional[uuid.UUID] = None
    series_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None
    learner_goal: Optional[str] = None
    why_this_matters: Optional[str] = None
    learning_outcomes: Optional[List[str]] = None
    completion_criteria: Optional[str] = None
    estimated_hours: Optional[float] = None
    level: Optional[str] = None


class UnitCreateRequest(BaseModel):
    module_id: uuid.UUID
    slug: Optional[str] = None
    name: str
    description: Optional[str] = None
    order_index: int = 0


class UnitUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


class DomainCreateRequest(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0


class DomainUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


class WorldCreateRequest(BaseModel):
    domain_id: uuid.UUID
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0


class WorldUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


class SeriesCreateRequest(BaseModel):
    world_id: uuid.UUID
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0


class SeriesUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None

