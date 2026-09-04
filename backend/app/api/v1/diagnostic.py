import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import verify_jwt_token, validate_origin_and_csrf
from app.services.diagnostic_service import DiagnosticService
from app.models.concept import Concept

router = APIRouter()

class DiagnosticSubmissionRequest(BaseModel):
    answers: List[Dict[str, Any]]

@router.get("/diagnostic/questions")
async def get_diagnostic_questions(db: AsyncSession = Depends(get_db)):
    """
    Returns 10-15 sample diagnostic questions across core domains.
    """
    stmt = select(Concept).limit(15)
    res = await db.execute(stmt)
    concepts = res.scalars().all()

    # Pre-built diagnostic questions pool mapped to concept IDs
    sample_questions = [
        {
            "id": str(uuid.uuid4()),
            "concept_id": str(c.id),
            "concept_slug": c.slug,
            "domain": c.domain,
            "question": f"What is the core principle behind {c.title}?",
            "options": ["Ownership in asset", "Bank debt loan", "Guaranteed profit return", "Tax exemption"],
            "correct_option": 0
        }
        for c in concepts
    ]
    return {"questions": sample_questions}


@router.post("/diagnostic/submit", summary="Submit diagnostic assessment and receive baseline mastery scores")
async def submit_diagnostic(
    req: DiagnosticSubmissionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    validate_origin_and_csrf(request)
    auth_header = request.headers.get("authorization")
    user_id = uuid.uuid4()
    if auth_header and auth_header.startswith("Bearer "):
        try:
            payload = verify_jwt_token(auth_header.split(" ")[1])
            user_id = uuid.UUID(payload["sub"])
        except Exception:
            pass

    scores = await DiagnosticService.process_diagnostic_submission(db, user_id, req.answers)
    return {
        "status": "COMPLETED",
        "scores": scores,
    }


