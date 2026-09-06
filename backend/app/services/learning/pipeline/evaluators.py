from typing import Any, Dict, Optional
from app.services.learning.pipeline.domain import EvaluationResult


class ActivityEvaluator:
    @staticmethod
    def evaluate(
        interaction_type: str,
        evaluation_spec: Dict[str, Any],
        payload_snapshot: Dict[str, Any],
        response_json: Dict[str, Any],
        confidence_rating: Optional[int] = None,
    ) -> EvaluationResult:
        """
        Pure evaluation logic.
        Reads ONLY from immutable evaluation_spec and payload_snapshot stored on session_item.
        Never reads mutable activity tables.
        """
        interaction_type = (interaction_type or "MCQ").upper()

        if interaction_type in ("MCQ", "MULTI_SELECT", "PREDICT", "MISCONCEPTION_CHECK", "APPLICATION", "TRANSFER"):
            return ActivityEvaluator._evaluate_mcq(evaluation_spec, payload_snapshot, response_json, confidence_rating)
        elif interaction_type == "NUMERIC_INPUT":
            return ActivityEvaluator._evaluate_numeric(evaluation_spec, payload_snapshot, response_json, confidence_rating)
        elif interaction_type in ("CALCULATION_SLIDER", "SLIDER"):
            return ActivityEvaluator._evaluate_slider(evaluation_spec, payload_snapshot, response_json, confidence_rating)
        else:
            return ActivityEvaluator._evaluate_generic(evaluation_spec, payload_snapshot, response_json, confidence_rating)

    @staticmethod
    def _evaluate_mcq(
        spec: Dict[str, Any],
        payload: Dict[str, Any],
        response: Dict[str, Any],
        confidence: Optional[int],
    ) -> EvaluationResult:
        selected_ids = response.get("selected_option_ids") or response.get("selected_options")
        selected = response.get("selected_option_id") or response.get("selected_option")

        expected_ids = spec.get("correct_option_ids") or payload.get("correct_option_ids")
        expected = spec.get("correct_option_id") or spec.get("correct_option") or payload.get("correct_option_id") or payload.get("correct_option")
        if not expected and not expected_ids and payload.get("options"):
            found_ids = [opt.get("id") for opt in payload["options"] if isinstance(opt, dict) and opt.get("is_correct")]
            if found_ids:
                expected_ids = found_ids
                expected = found_ids[0]

        # Multi-select evaluation
        if selected_ids is not None or (expected_ids is not None and len(expected_ids) > 1):
            s_set = {str(x) for x in (selected_ids if selected_ids is not None else ([selected] if selected else []))}
            e_set = {str(x) for x in (expected_ids if expected_ids is not None else ([expected] if expected else []))}
            is_correct = (bool(s_set) and s_set == e_set)
        else:
            is_correct = (selected is not None and expected is not None and str(selected) == str(expected))

        score = 1.0 if is_correct else 0.0

        metadata = {
            "selected_option": selected or selected_ids,
            "expected_option": expected or expected_ids,
            "misconception_tag": spec.get("misconception_map", {}).get(str(selected)) if not is_correct and selected else None
        }

        return EvaluationResult(
            is_correct=is_correct,
            score=score,
            confidence_rating=confidence,
            evaluator_metadata=metadata,
        )

    @staticmethod
    def _evaluate_numeric(
        spec: Dict[str, Any],
        payload: Dict[str, Any],
        response: Dict[str, Any],
        confidence: Optional[int],
    ) -> EvaluationResult:
        val = response.get("value")
        expected = spec.get("correct_value") if spec.get("correct_value") is not None else payload.get("correct_value")
        tolerance = spec.get("numeric_tolerance", 0.05)

        is_correct = False
        if val is not None and expected is not None:
            try:
                num_val = float(val)
                num_exp = float(expected)
                is_correct = abs(num_val - num_exp) <= abs(tolerance * num_exp) if num_exp != 0 else abs(num_val - num_exp) <= tolerance
            except (ValueError, TypeError):
                is_correct = False

        score = 1.0 if is_correct else 0.0

        metadata = {
            "submitted_value": val,
            "expected_value": expected,
            "tolerance": tolerance,
        }

        return EvaluationResult(
            is_correct=is_correct,
            score=score,
            confidence_rating=confidence,
            evaluator_metadata=metadata,
        )

    @staticmethod
    def _evaluate_slider(
        spec: Dict[str, Any],
        payload: Dict[str, Any],
        response: Dict[str, Any],
        confidence: Optional[int],
    ) -> EvaluationResult:
        # Check if slider acts as option selection or numeric value
        if "selected_option_id" in response or "selected_option" in response:
            return ActivityEvaluator._evaluate_mcq(spec, payload, response, confidence)
        return ActivityEvaluator._evaluate_numeric(spec, payload, response, confidence)

    @staticmethod
    def _evaluate_generic(
        spec: Dict[str, Any],
        payload: Dict[str, Any],
        response: Dict[str, Any],
        confidence: Optional[int],
    ) -> EvaluationResult:
        # Fallback evaluation checking is_correct or score in response or spec matching
        is_correct = bool(response.get("is_correct", False))
        score = float(response.get("score", 1.0 if is_correct else 0.0))
        return EvaluationResult(
            is_correct=is_correct,
            score=score,
            confidence_rating=confidence,
            evaluator_metadata=response,
        )
