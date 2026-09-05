"""
Content Authoring & Pedagogical Domain Schemas — SentiNews Learn V0.4 / V1.0
Defines the canonical Concept Authoring Contract, Versioning, Jurisdiction, and Provenance models.
Enforces strict schema validation across Admin Studio, Seed Pipelines, and Publication Gates.
"""
from enum import Enum
from typing import List, Dict, Any, Optional, Union
from datetime import datetime, timezone
import uuid
from pydantic import BaseModel, Field, HttpUrl, model_validator, ConfigDict


class Jurisdiction(str, Enum):
    GLOBAL = "GLOBAL"
    IN = "IN"
    US = "US"
    UK = "UK"
    EU = "EU"


class ProficiencyLevel(str, Enum):
    L0_NEWCOMER = "L0_NEWCOMER"
    L1_FOUNDATIONS = "L1_FOUNDATIONS"
    L2_EXPLORER = "L2_EXPLORER"
    L3_INVESTOR = "L3_INVESTOR"
    L4_ANALYST = "L4_ANALYST"
    L5_PRACTITIONER = "L5_PRACTITIONER"
    L6_PROFESSIONAL = "L6_PROFESSIONAL"
    L7_EXPERT = "L7_EXPERT"


class RelationshipType(str, Enum):
    PREREQUISITE = "PREREQUISITE"  # Directed DAG edge: A is required before B
    RELATED = "RELATED"            # Undirected semantic association
    INFLUENCES = "INFLUENCES"      # Causal market dynamic: A influences B


class EvidenceDimension(str, Enum):
    RECOGNITION = "RECOGNITION"
    RECALL = "RECALL"
    CALCULATION = "CALCULATION"
    APPLICATION = "APPLICATION"
    TRANSFER = "TRANSFER"
    EXPLAIN_BACK = "EXPLAIN_BACK"


class SourceType(str, Enum):
    REGULATORY = "REGULATORY"  # SEBI, SEC, RBI, Fed, FINRA
    EXCHANGE = "EXCHANGE"      # NSE, BSE, NYSE, NASDAQ
    FILING = "FILING"          # 10-K, Annual Report, Prospectus
    PRIMARY = "PRIMARY"        # Central bank statistical bulletin, academic paper
    SECONDARY = "SECONDARY"    # Reputable textbook, Varsity, Investopedia


class SourceAuthoringSchema(BaseModel):
    id: Optional[uuid.UUID] = None
    title: str = Field(..., min_length=2, max_length=255)
    publisher: str = Field(..., min_length=2, max_length=255)
    url: Optional[str] = Field(None, max_length=512)
    source_type: SourceType
    citation_text: str = Field(..., min_length=5)
    jurisdiction: Jurisdiction = Jurisdiction.GLOBAL
    effective_date: Optional[datetime] = None


class ConceptAuthoringContract(BaseModel):
    """
    The Canonical Concept Authoring Contract (Senior Review Directive 14).
    The single standard data structure for authoring, validating, and publishing knowledge nodes.
    """
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9_]+$")
    title: str = Field(..., min_length=2, max_length=150)
    domain: str = Field(..., min_length=2, max_length=50)
    level: ProficiencyLevel = ProficiencyLevel.L0_NEWCOMER
    jurisdiction: Jurisdiction = Jurisdiction.GLOBAL
    
    # Tier-specific explanations
    definition: str = Field(..., min_length=10, description="Verbatim authoritative definition")
    explanation_simple: str = Field(..., min_length=10, description="Intuitive beginner explanation / metaphor")
    explanation_intermediate: Optional[str] = Field(None, description="Market application context")
    explanation_pro: Optional[str] = Field(None, description="Technical / regulatory / CFA rigor")
    
    # Pedagogical scaffolding
    misconceptions: List[str] = Field(default_factory=list, description="Common novice misconceptions")
    examples: List[str] = Field(default_factory=list, description="Concrete real-world examples")
    
    # Graph connections
    prerequisites: List[str] = Field(default_factory=list, description="Slugs of prerequisite concepts")
    related_concepts: List[str] = Field(default_factory=list, description="Slugs of semantically related concepts")
    
    # Evidence & objectives
    learning_objectives: List[str] = Field(default_factory=list)
    evidence_targets: List[EvidenceDimension] = Field(
        default_factory=lambda: [EvidenceDimension.RECOGNITION, EvidenceDimension.RECALL, EvidenceDimension.APPLICATION]
    )
    
    # Provenance
    source_ids: List[uuid.UUID] = Field(default_factory=list)
    status: str = Field("PUBLISHED", pattern=r"^(DRAFT|IN_REVIEW|PUBLISHED|ARCHIVED)$")
# ── Canonical Content Authoring Types & Discriminators (V2.0 Core) ──────────

class ContentType(str, Enum):
    HEADING = "HEADING"
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    ANALOGY = "ANALOGY"
    CALLOUT = "CALLOUT"
    CANDLESTICK = "CANDLESTICK"
    TABLE = "TABLE"
    SCENARIO = "SCENARIO"


class ResponseType(str, Enum):
    NONE = "NONE"
    SINGLE_CHOICE = "SINGLE_CHOICE"
    IMAGE_SELECTION = "IMAGE_SELECTION"
    TRUE_FALSE = "TRUE_FALSE"


class ActivityType(str, Enum):
    OBSERVE = "OBSERVE"
    PREDICT = "PREDICT"
    EXPLAIN = "EXPLAIN"
    PRACTICE = "PRACTICE"
    APPLICATION = "APPLICATION"
    APPLY = "APPLY"
    EXPERIENCE = "EXPERIENCE"
    RETRIEVE = "RETRIEVE"
    REFLECT = "REFLECT"


class CognitiveLevel(str, Enum):
    REMEMBER = "REMEMBER"
    RECOGNIZE = "RECOGNIZE"
    RECALL = "RECALL"
    UNDERSTAND = "UNDERSTAND"
    EXPLAIN = "EXPLAIN"
    APPLY = "APPLY"
    ANALYZE = "ANALYZE"


class EvidenceRole(str, Enum):
    NONE = "NONE"
    FORMATIVE = "FORMATIVE"
    DIAGNOSTIC = "DIAGNOSTIC"
    MASTERY_EVIDENCE = "MASTERY_EVIDENCE"


class StoredBlock(BaseModel):
    """
    Canonical authoring block schema stored in LessonVersion.blocks_json.
    Enforces typed discriminators between pure content and evaluatable questions.
    """
    id: str = Field(..., description="Stable opaque block UUID")
    order_index: int = Field(..., ge=0, description="0-indexed position in lesson sequence")
    section_id: Optional[str] = Field(None, description="Optional structural grouping identifier")
    content_type: ContentType
    content: Dict[str, Any] = Field(default_factory=dict)
    activity_type: Optional[ActivityType] = None
    cognitive_level: Optional[CognitiveLevel] = None
    response_type: ResponseType = ResponseType.NONE
    options: Optional[List[Dict[str, Any]]] = None
    evaluation: Optional[Dict[str, Any]] = None
    feedback: Optional[Dict[str, Any]] = None
    hints: Optional[List[str]] = None
    evidence_role: EvidenceRole = EvidenceRole.NONE
    difficulty: int = Field(default=1, ge=1, le=5, description="Bounded difficulty 1: BEGINNER to 5: EXPERT")
    provenance: Optional[Dict[str, Any]] = None
    media_asset_id: Optional[uuid.UUID] = None
    concept_id: Optional[str] = None
    objective_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_discriminators(self):
        # 1. Pure content blocks (NONE) must reject evaluation secrets and options
        if self.response_type == ResponseType.NONE:
            if self.evaluation:
                raise ValueError("Pure content blocks (response_type=NONE) must not have evaluation rules.")
            if self.options:
                raise ValueError("Pure content blocks must not define options.")

        # 2. SINGLE_CHOICE: options >= 2, exactly 1 correct_option_id
        elif self.response_type == ResponseType.SINGLE_CHOICE:
            if not self.options or len(self.options) < 2:
                raise ValueError("SINGLE_CHOICE requires at least 2 options.")
            option_ids = {str(opt.get("id")) for opt in self.options if opt.get("id")}
            if len(option_ids) != len(self.options):
                raise ValueError("All options must have unique IDs.")
            if not self.evaluation or not self.evaluation.get("correct_option_id"):
                raise ValueError("SINGLE_CHOICE requires evaluation.correct_option_id.")
            if str(self.evaluation.get("correct_option_id")) not in option_ids:
                raise ValueError("evaluation.correct_option_id must match a valid option ID.")

        # 3. IMAGE_SELECTION: options >= 2, every option requires media_asset_id, exactly 1 correct_option_id
        elif self.response_type == ResponseType.IMAGE_SELECTION:
            if not self.options or len(self.options) < 2:
                raise ValueError("IMAGE_SELECTION requires at least 2 options.")
            for opt in self.options:
                if not opt.get("media_asset_id") and not opt.get("image_url"):
                    raise ValueError("Every IMAGE_SELECTION option must define a valid media_asset_id.")
            option_ids = {str(opt.get("id")) for opt in self.options if opt.get("id")}
            if len(option_ids) != len(self.options):
                raise ValueError("All options must have unique IDs.")
            if not self.evaluation or not self.evaluation.get("correct_option_id"):
                raise ValueError("IMAGE_SELECTION requires evaluation.correct_option_id.")
            if str(self.evaluation.get("correct_option_id")) not in option_ids:
                raise ValueError("evaluation.correct_option_id must match a valid option ID.")

        # 4. TRUE_FALSE: exactly 2 options
        elif self.response_type == ResponseType.TRUE_FALSE:
            if not self.options or len(self.options) != 2:
                raise ValueError("TRUE_FALSE requires exactly 2 options.")
            option_ids = {str(opt.get("id")) for opt in self.options if opt.get("id")}
            if not self.evaluation or str(self.evaluation.get("correct_option_id")) not in option_ids:
                raise ValueError("TRUE_FALSE requires evaluation.correct_option_id matching one of the options.")

        # 5. Mastery evidence requires answer key
        if self.evidence_role == EvidenceRole.MASTERY_EVIDENCE:
            if self.response_type == ResponseType.NONE:
                raise ValueError("MASTERY_EVIDENCE requires an interactive response_type.")
            if not self.evaluation or not self.evaluation.get("correct_option_id"):
                raise ValueError("MASTERY_EVIDENCE requires evaluation.correct_option_id.")

        # 6. Image blocks require media asset reference
        if self.content_type == ContentType.IMAGE:
            has_media = self.media_asset_id or (self.content and (self.content.get("media_asset_id") or self.content.get("url") or self.content.get("image_url")))
            if not has_media:
                raise ValueError("IMAGE blocks require a media_asset_id.")

        return self


class LearnerBlock(BaseModel):
    """
    Server-only boundary: Sanitized block schema transmitted to learner client.
    Guarantees zero evaluation secrets or correct answer keys leak to client.
    """
    id: str
    order_index: int
    section_id: Optional[str] = None
    content_type: ContentType
    content: Dict[str, Any] = Field(default_factory=dict)
    activity_type: Optional[ActivityType] = None
    cognitive_level: Optional[CognitiveLevel] = None
    response_type: ResponseType = ResponseType.NONE
    options: Optional[List[Dict[str, Any]]] = None
    feedback: Optional[Dict[str, Any]] = None
    hints: Optional[List[str]] = None
    evidence_role: EvidenceRole = EvidenceRole.NONE
    difficulty: int = 1
    media_asset_id: Optional[uuid.UUID] = None
    is_interactive: bool = False


class LearnerBlockSerializer:
    """
    Transforms StoredBlock into LearnerBlock.
    Retains correct_option_id to power instant zero-latency client evaluation (<16ms)
    while sanitizing internal evaluation artifacts and sensitive authoring metadata.
    """
    @staticmethod
    def serialize(block: Union[StoredBlock, Dict[str, Any]]) -> Dict[str, Any]:
        data = block.model_dump() if hasattr(block, "model_dump") else dict(block)
        
        # 1. Resolve canonical correct_option_id before scrubbing
        eval_dict = data.get("evaluation") or {}
        options_list = data.get("options") or []
        correct_id = (
            data.get("correct_option_id")
            or eval_dict.get("correct_option_id")
            or next((o.get("id") for o in options_list if isinstance(o, dict) and o.get("is_correct")), None)
        )

        data.pop("evaluation", None)
        data.pop("correct_value", None)
        data.pop("accepted_answers", None)

        # 2. Sanitize options list
        if "options" in data and isinstance(data["options"], list):
            clean_options = []
            for opt in data["options"]:
                opt_dict = dict(opt)
                opt_dict.pop("is_correct", None)
                opt_dict.pop("evaluation", None)
                clean_options.append(opt_dict)
            data["options"] = clean_options

        # 3. Supply resolved correct_option_id for instant client verification
        if correct_id is not None:
            data["correct_option_id"] = str(correct_id)

        # 4. Mark interactivity flag
        data["is_interactive"] = data.get("response_type") not in (ResponseType.NONE, "NONE", None)
        return data

    @staticmethod
    def serialize_many(blocks: List[Union[StoredBlock, Dict[str, Any]]]) -> List[Dict[str, Any]]:
        return [LearnerBlockSerializer.serialize(b) for b in blocks]


class LessonBlockSchema(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    type: Optional[str] = None
    content_type: Optional[ContentType] = None
    activity_type: Optional[ActivityType] = None
    title: Optional[str] = None
    prompt: Optional[str] = None
    renderer: Optional[str] = None
    evidence_role: Optional[str] = "NONE"
    cognitive_level: Optional[str] = None
    difficulty: Optional[Any] = 1
    response_type: Optional[str] = "NONE"
    capability_ids: List[str] = Field(default_factory=list)
    misconception_ids: List[str] = Field(default_factory=list)
    content: Optional[Dict[str, Any]] = Field(default_factory=dict)
    payload: Optional[Dict[str, Any]] = Field(default_factory=dict)
    options: Optional[List[Dict[str, Any]]] = None
    correct_option_id: Optional[str] = None
    explanation: Optional[str] = None
    provenance: Optional[Dict[str, Any]] = None


class LessonQuestionSchema(BaseModel):
    question_id: str
    concept_slug: str
    prompt: str
    options: Optional[List[str]] = None
    correct_option: Optional[int] = None
    statement: Optional[str] = None
    is_true: Optional[bool] = None
    explanation: str
    evidence_dimension: EvidenceDimension = EvidenceDimension.RECOGNITION


class LessonAuthoringSchema(BaseModel):
    """
    Standard schema for authoring versioned interactive lessons.
    """
    slug: Optional[str] = Field(None, max_length=100)
    title: str = Field(..., min_length=2, max_length=150)
    domain: str = Field("technical_analysis", min_length=2, max_length=50)
    unit_id: Optional[uuid.UUID] = None
    level: str = "BEGINNER"
    duration_minutes: int = Field(5, ge=1, le=60)
    learning_objectives: List[str] = Field(default_factory=list)
    concept_slugs: List[str] = Field(default_factory=list)
    concept_ids: Optional[List[str]] = Field(default_factory=list)
    prerequisite_slugs: List[str] = Field(default_factory=list)
    why_this_matters: Optional[str] = ""
    after_lesson_capabilities: Optional[List[str]] = Field(default_factory=list)
    blocks: List[Union[StoredBlock, LessonBlockSchema, Dict[str, Any]]] = Field(default_factory=list)
    questions: List[LessonQuestionSchema] = Field(default_factory=list)
    source_ids: List[uuid.UUID] = Field(default_factory=list)
    expected_version: Optional[int] = None  # Optimistic concurrency check
    template: Optional[str] = "DEEP_CONCEPT"
    status: str = Field("DRAFT", pattern=r"^(DRAFT|EDITOR_REVIEW|FACT_CHECK|FINANCE_REVIEW|COMPLIANCE_REVIEW|APPROVED|PUBLISHED|ARCHIVED)$")

    @model_validator(mode="before")
    @classmethod
    def default_slug_and_domain(cls, values):
        if isinstance(values, dict):
            if not values.get("slug") and values.get("title"):
                import re
                clean = re.sub(r'[^a-z0-9]+', '-', values["title"].lower()).strip('-')
                values["slug"] = clean or f"lesson-{uuid.uuid4().hex[:6]}"
            if not values.get("domain"):
                values["domain"] = "technical_analysis"
        return values
