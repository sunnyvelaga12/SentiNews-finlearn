"""
Content Authoring & Pedagogical Domain Schemas — SentiNews Learn V0.4 / V1.0
Defines the canonical Concept Authoring Contract, Versioning, Jurisdiction, and Provenance models.
Enforces strict schema validation across Admin Studio, Seed Pipelines, and Publication Gates.
"""
from enum import Enum
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import uuid
from pydantic import BaseModel, Field, HttpUrl


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


class LessonBlockSchema(BaseModel):
    id: str
    type: str = Field(..., pattern=r"^(heading|text|story|comparison|multiple_choice|true_false|recall|summary|image|observe|predict|explain|practice|market_example|misconception_check|application|explain_back|transfer|OBSERVE|PREDICT|EXPLAIN|PRACTICE|MARKET_EXAMPLE|MISCONCEPTION_CHECK|APPLICATION|EXPLAIN_BACK|TRANSFER)$")
    title: Optional[str] = None
    prompt: Optional[str] = None
    renderer: Optional[str] = None
    evidence_role: Optional[str] = Field("NONE", pattern=r"^(NONE|FORMATIVE|DIAGNOSTIC|MASTERY_EVIDENCE)$")
    cognitive_level: Optional[str] = None
    difficulty: Optional[str] = "BEGINNER"
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
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9-]+$")
    title: str = Field(..., min_length=2, max_length=150)
    domain: str = Field("technical_analysis", min_length=2, max_length=50)
    level: str = "BEGINNER"
    duration_minutes: int = Field(5, ge=1, le=60)
    learning_objectives: List[str] = Field(default_factory=list)
    concept_slugs: List[str] = Field(default_factory=list)
    concept_ids: Optional[List[str]] = Field(default_factory=list)
    prerequisite_slugs: List[str] = Field(default_factory=list)
    why_this_matters: Optional[str] = ""
    after_lesson_capabilities: Optional[List[str]] = Field(default_factory=list)
    blocks: List[LessonBlockSchema] = Field(default_factory=list)
    questions: List[LessonQuestionSchema] = Field(default_factory=list)
    source_ids: List[uuid.UUID] = Field(default_factory=list)
    expected_version: Optional[int] = None  # Optimistic concurrency check
    template: Optional[str] = "DEEP_CONCEPT"
    status: str = Field("DRAFT", pattern=r"^(DRAFT|EDITOR_REVIEW|FACT_CHECK|FINANCE_REVIEW|COMPLIANCE_REVIEW|APPROVED|PUBLISHED|ARCHIVED)$")
