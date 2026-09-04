import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import verify_jwt_token, validate_origin_and_csrf
from app.models.concept import Concept, ConceptRelationship

router = APIRouter()

class ConceptCreateRequest(BaseModel):
    slug: str
    title: str
    description: Optional[str] = None
    learning_objective: Optional[str] = None
    domain: str
    level: str = "BEGINNER"
    module_id: Optional[uuid.UUID] = None
    tags: List[str] = []

class RelationshipCreateRequest(BaseModel):
    target_concept_id: uuid.UUID
    relationship_type: str  # PREREQUISITE, RELATED

@router.get("/concepts")
async def get_concepts(domain: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    stmt = select(Concept)
    if domain:
        stmt = stmt.where(Concept.domain == domain)
    res = await db.execute(stmt)
    concepts = res.scalars().all()

    items = []
    for c in concepts:
        items.append({
            "id": str(c.id),
            "slug": c.slug,
            "title": c.title,
            "description": c.description,
            "domain": c.domain,
            "level": c.level,
            "tags": c.tags,
            "status": c.status
        })
    return {"concepts": items}

@router.post("/concepts")
async def create_concept(req: ConceptCreateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    validate_origin_and_csrf(request)
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

    payload = verify_jwt_token(auth_header.split(" ")[1])
    actor_id = uuid.UUID(payload["sub"])
    actor_role = payload.get("role", "LEARNER")

    if actor_role not in ["CONTENT_EDITOR", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="FORBIDDEN_ROLE: Only CONTENT_EDITOR or SUPER_ADMIN can create concepts.")

    # Unique slug check
    slug_stmt = select(Concept).where(Concept.slug == req.slug)
    slug_res = await db.execute(slug_stmt)
    if slug_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="CONCEPT_SLUG_ALREADY_EXISTS")

    concept = Concept(
        slug=req.slug,
        title=req.title,
        description=req.description,
        learning_objective=req.learning_objective,
        domain=req.domain,
        level=req.level,
        module_id=req.module_id,
        tags=req.tags,
        created_by=actor_id
    )
    db.add(concept)
    await db.commit()

    return {"status": "SUCCESS", "id": str(concept.id), "slug": concept.slug}

@router.post("/concepts/{concept_id}/relationships")
async def add_relationship(
    concept_id: uuid.UUID,
    req: RelationshipCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    validate_origin_and_csrf(request)
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

    payload = verify_jwt_token(auth_header.split(" ")[1])
    actor_role = payload.get("role", "LEARNER")

    if actor_role not in ["CONTENT_EDITOR", "SUPER_ADMIN"]:
        raise HTTPException(status_code=403, detail="FORBIDDEN_ROLE: Only CONTENT_EDITOR or SUPER_ADMIN can manage concept relationships.")

    # 1. Reject self-references
    if concept_id == req.target_concept_id:
        raise HTTPException(status_code=400, detail="CANNOT_LINK_CONCEPT_TO_ITSELF: Concept cannot depend on itself.")

    # 2. Concurrency-Safe Pre-commit Multi-Node Cycle & DAG Validation (Senior Review Directive 1, 3 & 4)
    if req.relationship_type == "PREREQUISITE":
        from sqlalchemy import func
        from app.services.graph.concept_graph_validator import ConceptGraphValidator
        
        # Acquire transaction-scoped advisory lock to serialize concurrent prerequisite graph writes
        await db.execute(select(func.pg_advisory_xact_lock(42001)))

        # Load existing graph topology from database under active lock
        all_concepts_res = await db.execute(select(Concept.id, Concept.slug))
        all_concepts = [{"id": str(r[0]), "slug": r[1]} for r in all_concepts_res.all()]
        
        all_edges_res = await db.execute(
            select(ConceptRelationship.source_concept_id, ConceptRelationship.target_concept_id)
            .where(ConceptRelationship.relationship_type == "PREREQUISITE")
        )
        existing_edges = [(str(r[0]), str(r[1])) for r in all_edges_res.all()]

        # Validate prospective edge in memory before modifying DB
        is_allowed, error_msg = ConceptGraphValidator.validate_prospective_edge(
            existing_nodes=all_concepts,
            existing_edges=existing_edges,
            new_source=str(concept_id),
            new_target=str(req.target_concept_id),
        )

        if not is_allowed:
            raise HTTPException(status_code=400, detail=error_msg)

    try:
        rel = ConceptRelationship(
            source_concept_id=concept_id,
            target_concept_id=req.target_concept_id,
            relationship_type=req.relationship_type
        )
        db.add(rel)
        await db.commit()
        return {"status": "SUCCESS", "relationship_id": str(rel.id)}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"RELATIONSHIP_CREATION_FAILED: {str(e)}")
