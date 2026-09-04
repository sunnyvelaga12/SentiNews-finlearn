import uuid
from typing import Dict, List, Any
from sqlalchemy.ext.asyncio import AsyncSession

class DiagnosticService:
    @classmethod
    async def process_diagnostic_submission(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        answers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Processes diagnostic assessment answers.
        Evaluates concept-level and domain-level baseline mastery.
        Returns domain breakdown scores (0..100).
        """
        domain_correct: Dict[str, int] = {
            "stocks": 0,
            "markets": 0,
            "fundamentals": 0,
            "personal_finance": 0,
            "technical_analysis": 0
        }
        domain_total: Dict[str, int] = {
            "stocks": 0,
            "markets": 0,
            "fundamentals": 0,
            "personal_finance": 0,
            "technical_analysis": 0
        }

        for ans in answers:
            domain = ans.get("domain", "stocks")
            if domain not in domain_total:
                domain = "stocks"
            is_correct = bool(ans.get("is_correct", False))

            domain_total[domain] += 1
            if is_correct:
                domain_correct[domain] += 1

        summary_scores: Dict[str, float] = {}
        for domain, total in domain_total.items():
            if total > 0:
                score_pct = (domain_correct[domain] / total) * 100.0
                summary_scores[domain] = round(score_pct, 1)
            else:
                summary_scores[domain] = 20.0  # Default baseline for unassessed domain

        return summary_scores
