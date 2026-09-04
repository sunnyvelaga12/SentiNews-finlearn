import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import verify_jwt_token
from app.models.progress import ConceptMastery
from app.models.concept import Concept

router = APIRouter()

@router.get("/mastery")
async def get_user_mastery(request: Request, db: AsyncSession = Depends(get_db)):
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

    payload = verify_jwt_token(auth_header.split(" ")[1])
    user_id = uuid.UUID(payload["sub"])

    stmt = select(ConceptMastery, Concept).join(Concept, ConceptMastery.concept_id == Concept.id).where(ConceptMastery.user_id == user_id)
    res = await db.execute(stmt)
    rows = res.all()

    mastery_list = []
    for m, c in rows:
        mastery_list.append({
            "concept_id": str(c.id),
            "concept_slug": c.slug,
            "concept_title": c.title,
            "domain": c.domain,
            "mastery_score": m.mastery_score,
            "confidence_level": m.confidence_level,
            "evidence_count": m.evidence_count,
            "last_evaluated_at": m.last_evaluated_at
        })

    return {"mastery": mastery_list}
