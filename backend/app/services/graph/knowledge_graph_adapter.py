"""
Knowledge Graph Adapter Service — SentiNews Learn V0.4 / CG-01
Resolves candidate concept nodes based on prerequisite satisfaction and learner mastery.
Operates strictly OUTSIDE the frozen learning core (RULE-CG-001 / Senior Review Amendment 3).
"""
import uuid
from typing import List, Dict, Set, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.concept import Concept, ConceptRelationship
from app.models.progress import ConceptMastery


class KnowledgeGraphAdapter:
    """
    Non-invasive DAG resolver for the learning engine.
    Computes eligible next concepts for a learner by verifying prerequisite mastery thresholds.
    """

    MASTERY_THRESHOLD = 7000  # 70.00% scaled mastery required to satisfy a prerequisite

    @classmethod
    async def get_eligible_concepts(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        target_domain: Optional[str] = None,
    ) -> List[Concept]:
        """
        Returns all published concepts where the learner has satisfied 100% of prerequisites.
        """
        # 1. Fetch all published concepts
        c_stmt = select(Concept).where(Concept.status == "PUBLISHED")
        if target_domain:
            c_stmt = c_stmt.where(Concept.domain == target_domain)
        c_res = await session.execute(c_stmt)
        all_concepts = c_res.scalars().all()
        concept_map = {c.id: c for c in all_concepts}

        # 2. Fetch all prerequisite edges
        rel_stmt = select(ConceptRelationship).where(ConceptRelationship.relationship_type == "PREREQUISITE")
        rel_res = await session.execute(rel_stmt)
        prereq_edges = rel_res.scalars().all()

        # Build prerequisite map: target_id -> set of required source_ids
        prereq_map: Dict[uuid.UUID, Set[uuid.UUID]] = {c.id: set() for c in all_concepts}
        for edge in prereq_edges:
            if edge.target_concept_id in prereq_map:
                prereq_map[edge.target_concept_id].add(edge.source_concept_id)

        # 3. Fetch learner's current masteries
        m_stmt = select(ConceptMastery).where(ConceptMastery.user_id == user_id)
        m_res = await session.execute(m_stmt)
        masteries = m_res.scalars().all()
        mastered_concept_ids: Set[uuid.UUID] = {
            m.concept_id for m in masteries if m.mastery_score >= cls.MASTERY_THRESHOLD
        }

        # 4. Filter concepts where all required prerequisites are mastered
        eligible: List[Concept] = []
        for concept in all_concepts:
            required = prereq_map.get(concept.id, set())
            if required.issubset(mastered_concept_ids):
                eligible.append(concept)

        return eligible
