"""
Mastery configuration — Deterministic integer arithmetic (FC-5/A17).

Architecture Contract v3:
- All weights are scaled ×100 (150 = 1.50)
- mastery_score is scaled ×100 (8732 = 87.32%)
- derive_mastery_score returns int 0–10000
- No floating-point in the projection path
- HALF_EVEN rounding where division is needed
"""
from typing import Dict
from app.models.progress import ConceptMastery

MASTERY_ALGORITHM_VERSION: int = 1

# Scaled ×100 — integer weights for deterministic projection (A17)
MASTERY_WEIGHTS: Dict[str, int] = {
    "IMMEDIATE_RECOGNITION": 50,    # 0.50
    "APPLICATION": 100,             # 1.00
    "ACTIVE_RECALL": 150,           # 1.50
    "DELAYED_RECALL_1D": 200,       # 2.00
    "DELAYED_RECALL_7D": 300,       # 3.00
    "DELAYED_RECALL_30D": 400,      # 4.00
    "ERROR_ADJUSTMENT": -100,       # -1.00
}

MASTERY_LEVEL_THRESHOLDS: Dict[str, int] = {
    "NOT_STARTED": 0,
    "EXPOSED": 100,       # 1.00 in original scale
    "PRACTICING": 3000,   # 30.00
    "FAMILIAR": 5000,     # 50.00
    "PROFICIENT": 7000,   # 70.00
}


from decimal import Decimal, ROUND_HALF_EVEN

def half_even_round(numerator: int, denominator: int) -> int:
    """
    Computes (numerator / denominator) using ROUND_HALF_EVEN rounding.
    Guarantees deterministic tie-breaking at exact midpoints across platforms (A17).
    """
    if denominator == 0:
        return 0
    val = Decimal(numerator) / Decimal(denominator)
    return int(val.quantize(Decimal('1'), rounding=ROUND_HALF_EVEN))


def derive_mastery_score(m: ConceptMastery) -> int:
    """
    Returns scaled integer 0–10000 (represents 0.00–100.00).
    Pure integer & Decimal ROUND_HALF_EVEN arithmetic — deterministic for replay (A6/A17).
    """
    total = m.correct_count + m.incorrect_count
    if total == 0:
        return 0
    # accuracy_component: (correct / total) * 5000 with HALF_EVEN rounding
    accuracy_component = half_even_round(m.correct_count * 5000, total)
    recall_bonus = min(3000, m.active_recall_successes * 1000)
    retention_bonus = min(2000, m.delayed_recall_successes * 1000)
    return max(0, min(10000, accuracy_component + recall_bonus + retention_bonus))



def compute_mastery_level(m: ConceptMastery) -> str:
    """
    Determines mastery level from scaled integer score and gating criteria.
    Score is scaled ×100 (7000 = 70.00%).
    """
    score = m.mastery_score  # Already scaled ×100
    total = m.correct_count + m.incorrect_count

    if (score >= 7000
        and m.attempt_count >= 8
        and m.unique_objective_successes >= 2
        and m.delayed_recall_successes >= 2
        and total > 0
        and (m.correct_count * 100) // total >= 80):  # 80% accuracy, integer
        return "PROFICIENT"
    if (score >= 5000
        and m.attempt_count >= 5
        and m.unique_objective_successes >= 2
        and total > 0
        and (m.correct_count * 100) // total >= 60):  # 60% accuracy, integer
        return "FAMILIAR"
    if score >= 3000 and m.attempt_count >= 3:
        return "PRACTICING"
    if score > 0 and m.attempt_count >= 1:
        return "EXPOSED"
    return "NOT_STARTED"


def compute_retention_strength(retention_score_scaled: int) -> str:
    """retention_score_scaled is ×100 (7000 = 70%)."""
    if retention_score_scaled >= 7000:
        return "HIGH"
    elif retention_score_scaled >= 4000:
        return "MEDIUM"
    return "LOW"

