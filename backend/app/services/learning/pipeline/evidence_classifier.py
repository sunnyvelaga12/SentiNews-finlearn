from app.services.learning.mastery_config import MASTERY_WEIGHTS
from app.services.learning.pipeline.domain import (
    AttemptContext,
    EvaluationResult,
    LearningContext,
    LearningEvidence,
)


class EvidenceClassifier:
    @staticmethod
    def classify(
        context: AttemptContext,
        result: EvaluationResult,
        learning_context: LearningContext,
    ) -> LearningEvidence:
        """
        Pure classification function. No DB calls.
        Determines evidence_type and evidence_weight based on context, result, and resolved history.
        Weight is scaled ×100 integer (FC-5/A17).
        """
        if not result.is_correct:
            evidence_type = "ERROR_ADJUSTMENT"
        elif learning_context.is_review or (learning_context.days_since_last_correct is not None and learning_context.days_since_last_correct >= 1.0):
            days = learning_context.days_since_last_correct or 0.0
            if days >= 30.0:
                evidence_type = "DELAYED_RECALL_30D"
            elif days >= 7.0:
                evidence_type = "DELAYED_RECALL_7D"
            elif days >= 1.0:
                evidence_type = "DELAYED_RECALL_1D"
            else:
                evidence_type = "ACTIVE_RECALL"
        else:
            phase = (context.learning_phase or "RETRIEVE").upper()
            if phase in ("EXPERIENCE", "PREDICT", "EXPLAIN"):
                evidence_type = "IMMEDIATE_RECOGNITION"
            elif phase == "APPLY":
                evidence_type = "APPLICATION"
            elif phase == "RETRIEVE":
                evidence_type = "ACTIVE_RECALL"
            else:
                evidence_type = "APPLICATION"

        weight = MASTERY_WEIGHTS.get(evidence_type, 100)  # default 100 = 1.00 scaled

        return LearningEvidence(
            context=context,
            result=result,
            learning_context=learning_context,
            evidence_type=evidence_type,
            evidence_weight=weight,
        )
