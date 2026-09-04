from dataclasses import dataclass
from datetime import datetime
from uuid import UUID
from typing import Optional, Mapping, Any


@dataclass(frozen=True)
class AttemptContext:
    attempt_id: UUID
    user_id: UUID
    session_id: UUID
    concept_id: UUID
    objective_id: UUID
    activity_id: UUID
    learning_phase: str
    interaction_type: str
    submitted_at: datetime
    response_time_ms: Optional[int]


@dataclass(frozen=True)
class EvaluationResult:
    """What happened during interaction evaluation. Evaluation only. Zero policy decisions."""
    is_correct: Optional[bool]
    score: Optional[float]
    confidence_rating: Optional[int]
    evaluator_metadata: Mapping[str, Any]


@dataclass(frozen=True)
class LearningContext:
    """DB-resolved context needed for evidence classification."""
    is_review: bool
    days_since_last_correct: Optional[float]
    attempt_number: int
    current_review_stage: int


@dataclass(frozen=True)
class LearningEvidence:
    """Canonical language of the learning engine. Immutable."""
    context: AttemptContext
    result: EvaluationResult
    learning_context: LearningContext
    evidence_type: str
    evidence_weight: int  # Scaled ×100 (FC-5/A17): 150 = 1.50


@dataclass(frozen=True)
class CanonicalProjectionState:
    """
    Semantic snapshot for deterministic rebuild comparison (A7).
    Excludes: updated_at, rebuilt_at, transaction metadata.
    Only domain-meaningful fields that must match between live and rebuilt state.
    All scores are scaled integers (A17).
    """
    mastery_score: int          # Scaled ×100
    mastery_level: str
    correct_count: int
    incorrect_count: int
    lapse_count: int
    active_recall_successes: int
    delayed_recall_successes: int
    review_stage: int
    review_next_at_iso: str     # ISO string from evidence timestamp (not wall clock)
