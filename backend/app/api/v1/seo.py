import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.lesson import Lesson, LessonVersion
from app.models.concept import Concept

router = APIRouter()

@router.get("/seo/school")
async def get_school_seo_index(db: AsyncSession = Depends(get_db)):
    stmt = select(Lesson).where(Lesson.current_version_id.isnot(None))
    res = await db.execute(stmt)
    lessons = res.scalars().all()

    articles = []
    for l in lessons:
        v_stmt = select(LessonVersion).where(LessonVersion.id == l.current_version_id)
        v_res = await db.execute(v_stmt)
        v = v_res.scalar_one_or_none()
        if v:
            articles.append({
                "slug": l.slug,
                "title": v.title,
                "domain": l.domain,
                "level": l.level,
                "duration_minutes": v.duration_minutes,
                "canonical_url": f"https://sentinews.com/school/{l.slug}"
            })

    return {
        "title": "SentiNews School — Financial Concepts Explained Simply",
        "description": "Learn financial concepts visually in 5 minutes a day. Free interactive explanations of stocks, market cap, mutual funds, and Nifty 50.",
        "canonical_url": "https://sentinews.com/school",
        "articles": articles
    }

@router.get("/seo/school/{slug}")
async def get_school_article_seo(slug: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Lesson).where(Lesson.slug == slug)
    res = await db.execute(stmt)
    lesson = res.scalar_one_or_none()

    if not lesson or not lesson.current_version_id:
        raise HTTPException(status_code=404, detail="ARTICLE_NOT_FOUND")

    v_stmt = select(LessonVersion).where(LessonVersion.id == lesson.current_version_id)
    v_res = await db.execute(v_stmt)
    v = v_res.scalar_one()

    canonical_url = f"https://sentinews.com/school/{slug}"
    json_ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": v.title,
        "description": f"Understand {v.title} in 5 minutes with visual explanations and interactive recall prompts.",
        "url": canonical_url,
        "author": {
            "@type": "Organization",
            "name": "SentiNews Learn"
        },
        "publisher": {
            "@type": "Organization",
            "name": "SentiNews",
            "logo": {
                "@type": "ImageObject",
                "url": "https://sentinews.com/assets/logo.png"
            }
        }
    }

    return {
        "title": f"{v.title} — SentiNews Learn",
        "description": f"Learn {v.title} visually in 5 minutes. Simple explanations, interactive quizzes, and real-world financial examples.",
        "canonical_url": canonical_url,
        "json_ld": json_ld,
        "lesson_data": {
            "title": v.title,
            "domain": lesson.domain,
            "level": lesson.level,
            "duration_minutes": v.duration_minutes,
            "learning_objectives": v.learning_objectives,
            "blocks": v.blocks_json,
            "questions": v.questions_json
        }
    }
