import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User, UserProfile
from app.models.concept import Concept
from app.models.progress import ReviewItem, ConceptMastery
from app.services.learning.next_action_engine import NextActionEngine

router = APIRouter(prefix="/learner", tags=["Learner Briefing"])


class LearnerSummaryResponse(BaseModel):
    streak_count: int
    xp_total: int
    mastered_concepts_count: int
    in_progress_concepts_count: int


class ReviewSummaryResponse(BaseModel):
    due_count: int
    next_due_at: Optional[datetime] = None


class LearnerBriefingResponse(BaseModel):
    user_id: uuid.UUID
    generated_at: datetime
    primary_action: Dict[str, Any]
    learner_summary: LearnerSummaryResponse
    review_summary: ReviewSummaryResponse


@router.get(
    "/briefing",
    status_code=status.HTTP_200_OK,
    response_model=LearnerBriefingResponse,
    summary="Get consolidated learner briefing (facade over NextActionEngine)",
)
async def get_learner_briefing(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    # 1. Canonical Recommendation: Strictly computed by existing NextActionEngine
    primary_action = await NextActionEngine.recommend_next_action(db, current_user.id)

    # 2. Learner Profile Snapshot
    st_stmt = select(UserProfile).where(UserProfile.user_id == current_user.id)
    st_res = await db.execute(st_stmt)
    profile = st_res.scalar_one_or_none()

    streak = profile.streak_count if profile else 0
    xp_stmt = select(
        func.coalesce(
            func.sum(ConceptMastery.correct_count * 10 + ConceptMastery.attempt_count * 10),
            0
        )
    ).where(ConceptMastery.user_id == current_user.id)
    xp_res = await db.execute(xp_stmt)
    xp = int(xp_res.scalar() or 0)


    # 3. Concept Masteries Counts
    mastered_stmt = select(func.count(ConceptMastery.id)).where(
        ConceptMastery.user_id == current_user.id,
        ConceptMastery.mastery_score >= 8000,
    )
    mastered_res = await db.execute(mastered_stmt)
    mastered_count = mastered_res.scalar() or 0

    progress_stmt = select(func.count(ConceptMastery.id)).where(
        ConceptMastery.user_id == current_user.id,
        ConceptMastery.mastery_score > 0,
        ConceptMastery.mastery_score < 8000,
    )
    progress_res = await db.execute(progress_stmt)
    progress_count = progress_res.scalar() or 0

    # 4. Review Items Due Count & Earliest Due
    due_stmt = select(func.count(ReviewItem.id)).where(
        ReviewItem.user_id == current_user.id,
        ReviewItem.next_review_at <= now,
    )
    due_res = await db.execute(due_stmt)
    due_count = due_res.scalar() or 0

    next_rev_stmt = (
        select(ReviewItem.next_review_at)
        .where(
            ReviewItem.user_id == current_user.id,
            ReviewItem.next_review_at > now,
        )
        .order_by(ReviewItem.next_review_at.asc())
        .limit(1)
    )
    next_rev_res = await db.execute(next_rev_stmt)
    next_due_at = next_rev_res.scalar_one_or_none()

    return LearnerBriefingResponse(
        user_id=current_user.id,
        generated_at=now,
        primary_action=primary_action,
        learner_summary=LearnerSummaryResponse(
            streak_count=streak,
            xp_total=xp,
            mastered_concepts_count=mastered_count,
            in_progress_concepts_count=progress_count,
        ),
        review_summary=ReviewSummaryResponse(
            due_count=due_count,
            next_due_at=next_due_at,
        ),
    )
