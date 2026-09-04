"""
Pedagogical Validator — SentiNews Learn V0.4 / V1.0
Decoupled domain validator for pedagogical structure, interaction validity, and evidence claims.
"""
from typing import Tuple, List, Dict, Any
from app.models.lesson import LessonVersion


class PedagogicalValidator:
    """
    Validates pedagogical structure without constraining educators:
    1. MASTERY_EVIDENCE rule: If a lesson claims mastery evidence or includes assessment stages
       (APPLICATION, TRANSFER, MISCONCEPTION_CHECK), it must contain at least one activity with evidence_role='MASTERY_EVIDENCE'.
    2. Interactive cards (PREDICT, MISCONCEPTION_CHECK, APPLICATION) must provide at least 2 choice options.
    3. Short orientation/introductory lessons (OBSERVE, EXPLAIN, PRACTICE) remain valid with NONE or FORMATIVE roles.
    """

    @classmethod
    def validate_pedagogy(cls, version: LessonVersion) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        blocks: List[Dict[str, Any]] = version.blocks_json or []
        questions: List[Dict[str, Any]] = version.questions_json or []

        if not blocks and not questions:
            errors.append("Lesson must have at least one pedagogical block or activity.")
            return False, errors

        # Mastery Evidence Rule
        has_assessment_stage = any(
            (b.get("interaction_type") or b.get("type")) in ["APPLICATION", "TRANSFER", "MISCONCEPTION_CHECK"]
            for b in blocks
        )
        if has_assessment_stage:
            has_mastery_role = any(b.get("evidence_role") == "MASTERY_EVIDENCE" for b in blocks)
            if not has_mastery_role:
                errors.append(
                    "Lessons containing assessment stages (APPLICATION, TRANSFER, MISCONCEPTION_CHECK) "
                    "must designate at least one activity as MASTERY_EVIDENCE."
                )

        # Interactive options check
        for idx, block in enumerate(blocks):
            itype = block.get("interaction_type") or block.get("type")
            options = block.get("options")
            if itype in ["PREDICT", "MISCONCEPTION_CHECK", "APPLICATION"]:
                if not options or len(options) < 2:
                    errors.append(
                        f"Interactive card '{block.get('title', f'Block {idx+1}')}' requires at least 2 choice options."
                    )

        return len(errors) == 0, errors
