"""
Curriculum Seeder — SentiNews Learn V0.4 / V1.0
Seeds the canonical Candlestick Foundations reference module (Unit 1) into PostgreSQL.
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.curriculum import Domain, World, Series, Module, Unit, UnitConcept
from app.models.concept import Concept
from app.models.lesson import Lesson, LessonVersion
from app.models.learning import LearningObjective, LearningActivity


async def seed_candlestick_curriculum(db: AsyncSession):
    # Hard environment guard: prevent accidental execution in production
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env in ["production", "prod"]:
        raise RuntimeError("CRITICAL: seed_curriculum.py is a development/staging fixture and cannot be executed in PRODUCTION!")

    now = datetime.now(timezone.utc)

    # 1. Domain
    d_res = await db.execute(select(Domain).where(Domain.slug == "technical_analysis"))
    domain = d_res.scalar_one_or_none()
    if not domain:
        domain = Domain(
            id=uuid.uuid4(),
            slug="technical_analysis",
            name="Technical Analysis",
            description="Reading charts, market structure, and price discovery.",
            order_index=1,
            created_at=now,
        )
        db.add(domain)
        await db.flush()

    # 2. World
    w_res = await db.execute(select(World).where(World.slug == "price_action_reading"))
    world = w_res.scalar_one_or_none()
    if not world:
        world = World(
            id=uuid.uuid4(),
            domain_id=domain.id,
            slug="price_action_reading",
            name="Price Action Reading",
            description="Deconstructing price behavior without relying solely on lagging indicators.",
            order_index=1,
            created_at=now,
        )
        db.add(world)
        await db.flush()

    # 3. Series
    s_res = await db.execute(select(Series).where(Series.slug == "candlestick_patterns"))
    series = s_res.scalar_one_or_none()
    if not series:
        series = Series(
            id=uuid.uuid4(),
            world_id=world.id,
            slug="candlestick_patterns",
            name="Candlestick Patterns & Anatomy",
            description="Understanding period price compression and multi-bar setups.",
            order_index=1,
            created_at=now,
        )
        db.add(series)
        await db.flush()

    # 4. Module: Candlestick Foundations
    m_res = await db.execute(select(Module).where(Module.slug == "candlestick-foundations"))
    module = m_res.scalar_one_or_none()
    if not module:
        module = Module(
            id=uuid.uuid4(),
            series_id=series.id,
            slug="candlestick-foundations",
            name="Candlestick Foundations",
            description="Learn how Japanese candlesticks represent price movement, how buyers and sellers interact within a timeframe, and how traders interpret candle anatomy in context.",
            order_index=1,
            created_at=now,
        )
        db.add(module)
        await db.flush()

    # 5. Unit 1: Understanding Candle Mechanics
    u_res = await db.execute(select(Unit).where(Unit.slug == "understanding-candles", Unit.module_id == module.id))
    unit = u_res.scalar_one_or_none()
    if not unit:
        unit = Unit(
            id=uuid.uuid4(),
            module_id=module.id,
            slug="understanding-candles",
            name="Unit 1: Understanding Candle Mechanics",
            description="Core anatomy, OHLC price formation, timeframe compression, and range evaluation.",
            order_index=1,
            created_at=now,
        )
        db.add(unit)
        await db.flush()

    # 6. Concepts & UnitConcepts
    concepts_data = [
        ("candlestick_intro", "What is a Candlestick?"),
        ("ohlc_anatomy", "Open, High, Low & Close"),
        ("wick_body_dynamics", "Body & Shadow Dynamics"),
        ("bullish_bearish_sentiment", "Bullish vs Bearish Anatomy"),
    ]

    concept_objs = []
    for idx, (c_slug, c_title) in enumerate(concepts_data):
        c_res = await db.execute(select(Concept).where(Concept.slug == c_slug))
        c_obj = c_res.scalar_one_or_none()
        if not c_obj:
            c_obj = Concept(
                id=uuid.uuid4(),
                slug=c_slug,
                title=c_title,
                domain="technical_analysis",
                level="BEGINNER",
                status="PUBLISHED",
                created_at=now,
            )
            db.add(c_obj)
            await db.flush()
        concept_objs.append(c_obj)

        # Link UnitConcept
        uc_res = await db.execute(
            select(UnitConcept).where(UnitConcept.unit_id == unit.id, UnitConcept.concept_id == c_obj.id)
        )
        if not uc_res.scalar_one_or_none():
            uc = UnitConcept(
                id=uuid.uuid4(),
                unit_id=unit.id,
                concept_id=c_obj.id,
                order_index=idx + 1,
                created_at=now,
            )
            db.add(uc)
            await db.flush()

    # 7. Lessons & Published Versions for Unit 1
    lessons_data = [
        (
            "what-is-a-candlestick",
            "Lesson 1: What is a Candlestick?",
            5,
            concept_objs[0],
            ["Understand the 4 core price points: Open, High, Low, and Close (OHLC)", "Explain timeframe compression"],
            [],
        ),
        (
            "open-high-low-close",
            "Lesson 2: Open, High, Low & Close",
            5,
            concept_objs[1],
            ["Track period price discovery from open to close", "Identify extreme high and low boundaries"],
            [concept_objs[0].id],
        ),
        (
            "body-and-wick",
            "Lesson 3: Body & Shadow (Wick) Dynamics",
            6,
            concept_objs[2],
            ["Distinguish real body conviction from intraperiod shadow exploration", "Calculate body-to-range ratios"],
            [concept_objs[1].id],
        ),
        (
            "bullish-vs-bearish",
            "Lesson 4: Bullish vs Bearish Anatomy",
            6,
            concept_objs[3],
            ["Evaluate buyer vs seller pressure using closing position", "Avoid common color-only misconceptions"],
            [concept_objs[2].id],
        ),
    ]

    for slug, title, duration, concept, objectives, prereqs in lessons_data:
        l_res = await db.execute(select(Lesson).where(Lesson.slug == slug))
        lesson = l_res.scalar_one_or_none()
        if not lesson:
            lesson = Lesson(
                id=uuid.uuid4(),
                slug=slug,
                domain="technical_analysis",
                level="BEGINNER",
                created_at=now,
            )
            db.add(lesson)
            await db.flush()

        lesson_blocks = [
            {
                "id": "step-1",
                "type": "OBSERVE",
                "renderer": "CANDLESTICK",
                "evidence_role": "NONE",
                "difficulty_level": "LEVEL_1_RECOGNIZE",
                "title": "01 — Visual Observation",
                "prompt": "Look carefully at this candlestick. Notice the colored real body and the thin shadows (wicks) extending above and below. What do you notice?",
                "payload": {
                    "ohlc": {"open": 100, "high": 120, "low": 90, "close": 110, "timeframe": "1D"},
                    "interactive": True,
                }
            },
            {
                "id": "step-2",
                "type": "PREDICT",
                "renderer": "CANDLESTICK",
                "evidence_role": "FORMATIVE",
                "difficulty_level": "LEVEL_1_RECOGNIZE",
                "misconception_ids": ["M1_HIGH_EQUALS_CLOSE"],
                "title": "02 — Prediction",
                "prompt": "Which price point represents the highest price reached during this period?",
                "payload": {
                    "ohlc": {"open": 100, "high": 120, "low": 90, "close": 110, "timeframe": "1D"},
                },
                "options": [
                    {"id": "opt_open", "text": "Open (₹100)"},
                    {"id": "opt_high", "text": "High (₹120)"},
                    {"id": "opt_low", "text": "Low (₹90)"},
                    {"id": "opt_close", "text": "Close (₹110)"},
                ],
                "correct_option_id": "opt_high",
                "explanation": "The High is the highest price reached during the period, represented by the top tip of the upper shadow.",
                "misconception_map": {
                    "opt_close": "You chose Close. Close (₹110) is where the period ended. The High (₹120) is the highest price reached during the period. Look at the top tip of the upper shadow. Try again.",
                    "opt_open": "Not quite. Open is where price began the period, not the peak price reached. Look at the top tip of the candle's shadow. Try again.",
                    "opt_low": "Not quite. Low is the lowest price reached during the period. Look at the top tip of the candle's shadow. Try again."
                }
            },
            {
                "id": "step-3",
                "type": "EXPLAIN",
                "renderer": "CANDLESTICK",
                "evidence_role": "NONE",
                "difficulty_level": "LEVEL_3_EXPLAIN",
                "title": "03 — Anatomy & Extreme Exploration",
                "prompt": "High is the highest price reached during this period. The thin lines above and below the body are shadows (wicks). They show the extreme prices explored by buyers and sellers, while the colored real body shows the net difference between Open and Close.",
                "payload": {
                    "ohlc": {"open": 100, "high": 120, "low": 90, "close": 110, "timeframe": "1D"},
                    "highlight_region": "high"
                }
            },
            {
                "id": "step-4",
                "type": "PRACTICE",
                "renderer": "CANDLESTICK",
                "evidence_role": "FORMATIVE",
                "difficulty_level": "LEVEL_4_MANIPULATE",
                "title": "04 — Interactive Manipulation",
                "prompt": "Move the Close price slider upward and downward. Watch how the candle morphs: what happens when Close drops below Open? What happens when Close rises above Open?",
                "payload": {
                    "ohlc": {"open": 100, "high": 120, "low": 90, "close": 110, "timeframe": "1D"},
                }
            },
            {
                "id": "step-5",
                "type": "MARKET_EXAMPLE",
                "renderer": "CANDLESTICK",
                "evidence_role": "NONE",
                "difficulty_level": "LEVEL_2_RECALL",
                "title": "05 — Simulated Market Scenario",
                "prompt": "Here is a simulated daily session inspired by active price discovery. Notice how price opened at ₹19,500, explored a peak high of ₹19,800, and settled to close at ₹19,750.",
                "payload": {
                    "ohlc": {"open": 19500, "high": 19800, "low": 19450, "close": 19750, "timeframe": "1D"},
                },
                "provenance": {
                    "is_simulated": True,
                    "instrument": "SIMULATED EXAMPLE · Inspired by NIFTY 50-style price movement · Not historical market data",
                    "exchange": "SIMULATED",
                    "timeframe": "1D",
                    "historical_date_range": "Educational Simulation",
                    "source_citation": "Educational Market Simulator Feed",
                    "disclaimer": "Simulated market data for educational illustration only. Created to demonstrate realistic multi-participant price discovery without confusing with live exchange data."
                }
            },
            {
                "id": "step-6",
                "type": "MISCONCEPTION_CHECK",
                "renderer": "CANDLESTICK",
                "evidence_role": "MASTERY_EVIDENCE",
                "difficulty_level": "LEVEL_5_APPLY",
                "misconception_ids": ["M2_LONG_WICK_GUARANTEES_REVERSAL"],
                "title": "06 — Common Misconception",
                "prompt": "A fellow learner claims: 'A long upper shadow always means sellers rejected the market and price will definitely crash tomorrow.' How would you evaluate this claim?",
                "payload": {
                    "ohlc": {"open": 100, "high": 140, "low": 95, "close": 105, "timeframe": "1D"},
                },
                "options": [
                    {"id": "mc_a", "text": "True — long upper shadows guarantee sellers took total control and buyers gave up completely."},
                    {"id": "mc_b", "text": "Not necessarily — it shows price was explored higher but couldn't sustain before close; subsequent price action and market context determine conviction."}
                ],
                "correct_option_id": "mc_b",
                "explanation": "A long upper shadow shows intraperiod price exploration that wasn't sustained until the close, but context determines market conviction. It is not an automatic guarantee of a reversal.",
                "misconception_map": {
                    "mc_a": "Not quite. While a long upper wick shows selling pressure near the highs, market context and subsequent candles determine whether price reverses. A long wick alone is not an automatic guarantee of a crash. Try again."
                }
            },
            {
                "id": "step-7",
                "type": "APPLICATION",
                "renderer": "CANDLESTICK",
                "evidence_role": "MASTERY_EVIDENCE",
                "difficulty_level": "LEVEL_6_TRANSFER",
                "title": "07 — Capability Transfer Scenario",
                "prompt": "Look at this unfamiliar candle on a chart: Open = ₹200, High = ₹205, Low = ₹160, Close = ₹198. Which statement accurately explains what happened to price during this period?",
                "payload": {
                    "ohlc": {"open": 200, "high": 205, "low": 160, "close": 198, "timeframe": "1D"},
                },
                "options": [
                    {"id": "app_a", "text": "Price explored deep down to ₹160, but recovered almost all the way back to close near ₹198, leaving a long lower shadow."},
                    {"id": "app_b", "text": "Price collapsed down to ₹160 and stayed there with no buyer response."}
                ],
                "correct_option_id": "app_a",
                "explanation": "Price dipped significantly to Low = ₹160 during the period, but buyers pushed it back up to close at ₹198, right near the Open of ₹200.",
                "misconception_map": {
                    "app_b": "Not quite. Check the Close price (₹198). Even though price reached a low of ₹160, it ended the period back up near ₹198. Look at where the candle closed. Try again."
                }
            }
        ]
        lesson_2_blocks = [
            {
                "id": "l2-step-1",
                "type": "EXPLAIN",
                "renderer": "TABLE",
                "evidence_role": "NONE",
                "cognitive_level": "RECALL",
                "difficulty": "BEGINNER",
                "response_type": "NONE",
                "capability_ids": ["skill_read_candle_anatomy"],
                "title": "01 — Session Price Coordinates",
                "prompt": "Review the 4 primary price coordinates recorded during an Indian market trading session (9:15 AM – 3:30 PM). Compare where price began, where it peaked, where it troughed, and where it settled.",
                "payload": {
                    "headers": ["Price Coordinate", "Executed Price", "Market Significance"],
                    "rows": [
                        ["Open", "₹100.00", "First transaction executed at 9:15 AM opening auction"],
                        ["High", "₹125.00", "Peak price reached during intra-session exploration"],
                        ["Low", "₹95.00", "Deepest intraday pullback during seller counter-attack"],
                        ["Close", "₹120.00", "Final executed transaction at 3:30 PM closing bell"]
                    ],
                    "summary": "Net Period Result: Price closed ₹20.00 above Open (+20.0%), establishing a clear bullish interval."
                }
            },
            {
                "id": "l2-step-2",
                "type": "PREDICT",
                "renderer": "CANDLESTICK",
                "evidence_role": "FORMATIVE",
                "cognitive_level": "RECOGNIZE",
                "difficulty": "BEGINNER",
                "response_type": "SINGLE_CHOICE",
                "capability_ids": ["skill_read_candle_anatomy"],
                "title": "02 — Lower Boundary Recognition",
                "prompt": "Looking at the candle generated from this session data, which price coordinate marks the bottom tip of the lower shadow?",
                "payload": {
                    "ohlc": {"open": 100, "high": 125, "low": 95, "close": 120, "timeframe": "1D"},
                },
                "options": [
                    {"id": "opt_l2_low", "text": "Low (₹95.00)"},
                    {"id": "opt_l2_open", "text": "Open (₹100.00)"},
                    {"id": "opt_l2_close", "text": "Close (₹120.00)"},
                ],
                "correct_option_id": "opt_l2_low",
                "explanation": "The Low (₹95.00) is the absolute lowest price reached during the period, represented by the bottom tip of the lower shadow.",
                "misconception_map": {
                    "opt_l2_open": "Open (₹100.00) is where trading began, but price dipped down to ₹95.00 before closing. The lower shadow's tip marks the Low. Try again.",
                    "opt_l2_close": "Close (₹120.00) marks where trading ended near the top of the body, not the bottom tip. Try again."
                }
            },
            {
                "id": "l2-step-3",
                "type": "PRACTICE",
                "renderer": "CANDLESTICK",
                "evidence_role": "FORMATIVE",
                "cognitive_level": "MANIPULATE",
                "difficulty": "INTERMEDIATE",
                "response_type": "SLIDER",
                "capability_ids": ["skill_evaluate_closing_conviction"],
                "title": "03 — Range & Conviction Manipulation",
                "prompt": "Drag the Close slider down to ₹90. Notice how the candle body morphs from green (bullish) to red (bearish) as Close falls below the ₹100 Open.",
                "payload": {
                    "ohlc": {"open": 100, "high": 125, "low": 85, "close": 120, "timeframe": "1D"},
                }
            },
            {
                "id": "l2-step-4",
                "type": "APPLICATION",
                "renderer": "CANDLESTICK",
                "evidence_role": "MASTERY_EVIDENCE",
                "cognitive_level": "APPLY",
                "difficulty": "INTERMEDIATE",
                "response_type": "SINGLE_CHOICE",
                "capability_ids": ["skill_evaluate_closing_conviction"],
                "title": "04 — Transfer: Comparing Closing Conviction",
                "prompt": "You encounter an unfamiliar candle: Open ₹500, High ₹540, Low ₹495, Close ₹535. Which statement accurately assesses period conviction?",
                "payload": {
                    "ohlc": {"open": 500, "high": 540, "low": 495, "close": 535, "timeframe": "1D"},
                },
                "options": [
                    {"id": "opt_l2_conv_a", "text": "Strong buyer conviction: price finished ₹35 above open and within ₹5 of session highs."},
                    {"id": "opt_l2_conv_b", "text": "Dominant seller conviction: buyers failed to defend the open."}
                ],
                "correct_option_id": "opt_l2_conv_a",
                "explanation": "Close (₹535) is significantly above Open (₹500) and settled right near High (₹540), confirming decisive buyers' conviction into the close.",
                "misconception_map": {
                    "opt_l2_conv_b": "Notice that Close (₹535) is well above Open (₹500). Buyers pushed price up by ₹35 and held almost the entire gain. Try again."
                }
            }
        ]

        if slug == "what-is-a-candlestick":
            blocks_to_use = lesson_blocks
        elif slug == "open-high-low-close":
            blocks_to_use = lesson_2_blocks
        else:
            blocks_to_use = [{"id": "blk-1", "type": "OBSERVE", "renderer": "CANDLESTICK", "title": f"Overview of {title}", "prompt": f"Study {title} mechanics and period price action.", "payload": {"ohlc": {"open": 100, "high": 120, "low": 90, "close": 115, "timeframe": "1D"}}}]

        # Check existing version and respect strict DB immutability trigger
        needs_new_version = False
        next_version_number = 1
        if lesson.current_version_id:
            v_res = await db.execute(select(LessonVersion).where(LessonVersion.id == lesson.current_version_id))
            current_v = v_res.scalar_one_or_none()
            if current_v:
                if len(current_v.blocks_json) != len(blocks_to_use) or current_v.blocks_json != blocks_to_use:
                    needs_new_version = True
                    next_version_number = current_v.version_number + 1
            else:
                needs_new_version = True
        else:
            needs_new_version = True

        if needs_new_version:
            new_v_id = uuid.uuid4()
            new_version = LessonVersion(
                id=new_v_id,
                lesson_id=lesson.id,
                version_number=next_version_number,
                title=title,
                duration_minutes=duration,
                learning_objectives=objectives,
                concept_ids=[str(concept.id)],
                prerequisite_ids=[str(p) for p in prereqs],
                blocks_json=blocks_to_use,
                questions_json=[],
                status="PUBLISHED",
                publish_at=now,
                created_at=now,
            )
            db.add(new_version)
            await db.flush()
            lesson.current_version_id = new_version.id
            await db.flush()

        # Seed Objective
        lo_res = await db.execute(select(LearningObjective).where(LearningObjective.concept_id == concept.id))
        lo = lo_res.scalar_one_or_none()
        if not lo:
            lo = LearningObjective(
                id=uuid.uuid4(),
                slug=f"lo-{slug}",
                title=objectives[0],
                concept_id=concept.id,
                taxonomy_level="UNDERSTAND",
                created_at=now,
            )
            db.add(lo)
            await db.flush()

        # Seed Activities for Lesson 1
        if slug == "what-is-a-candlestick":
            # Remove any legacy activities for this objective to ensure clean 7-step sequence
            existing_acts = (await db.execute(select(LearningActivity).where(LearningActivity.objective_id == lo.id))).scalars().all()
            if len(existing_acts) != 7:
                for a in existing_acts:
                    await db.delete(a)
                await db.flush()

                for b_idx, block in enumerate(lesson_blocks):
                    act = LearningActivity(
                        id=uuid.uuid4(),
                        objective_id=lo.id,
                        activity_type=block["type"],
                        learning_phase=block["type"],
                        interaction_type=block["type"],
                        title=block["title"],
                        payload={
                            "renderer": block["renderer"],
                            "prompt": block["prompt"],
                            "ohlc": block.get("payload", {}).get("ohlc", {"open": 100, "high": 120, "low": 90, "close": 110, "timeframe": "1D"}),
                            "options": block.get("options"),
                            "correct_option_id": block.get("correct_option_id"),
                            "explanation": block.get("explanation"),
                            "misconception_map": block.get("misconception_map", {}),
                            "provenance": block.get("provenance"),
                        },
                        created_at=now,
                    )
                    db.add(act)
                    await db.flush()
        elif slug == "open-high-low-close":
            existing_acts = (await db.execute(select(LearningActivity).where(LearningActivity.objective_id == lo.id))).scalars().all()
            if len(existing_acts) != 4:
                for a in existing_acts:
                    await db.delete(a)
                await db.flush()

                for b_idx, block in enumerate(lesson_2_blocks):
                    act = LearningActivity(
                        id=uuid.uuid4(),
                        objective_id=lo.id,
                        activity_type=block["type"],
                        learning_phase=block["type"],
                        interaction_type=block["type"],
                        title=block["title"],
                        payload={
                            "renderer": block["renderer"],
                            "prompt": block["prompt"],
                            "headers": block.get("payload", {}).get("headers"),
                            "rows": block.get("payload", {}).get("rows"),
                            "summary": block.get("payload", {}).get("summary"),
                            "ohlc": block.get("payload", {}).get("ohlc", {"open": 100, "high": 125, "low": 95, "close": 120, "timeframe": "1D"}),
                            "options": block.get("options"),
                            "correct_option_id": block.get("correct_option_id"),
                            "explanation": block.get("explanation"),
                            "misconception_map": block.get("misconception_map", {}),
                        },
                        created_at=now,
                    )
                    db.add(act)
                    await db.flush()
        else:
            act_res = await db.execute(select(LearningActivity).where(LearningActivity.objective_id == lo.id))
            if not act_res.scalar_one_or_none():
                act = LearningActivity(
                    id=uuid.uuid4(),
                    objective_id=lo.id,
                    activity_type="OBSERVE",
                    learning_phase="OBSERVE",
                    interaction_type="MCQ",
                    title=f"Explore {title}",
                    payload={
                        "renderer": "CANDLESTICK",
                        "prompt": f"Learn the mechanics of {title}.",
                        "ohlc": {"open": 100, "high": 120, "low": 90, "close": 110, "timeframe": "1D"},
                    },
                    created_at=now,
                )
                db.add(act)
                await db.flush()

    await db.commit()
    print("✅ Candlestick Foundations (Unit 1) seeded successfully in PostgreSQL.")


FIXTURE_MODULE_SLUGS = ["candlestick-foundations", "market-basics"]


async def reset_curriculum(db: AsyncSession):
    """
    Deterministically purges ONLY fixture-owned entities.
    Protected by a hard environment guard refusing reset in production.
    """
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env in ["production", "prod"]:
        raise RuntimeError("RESET REFUSED: Cannot reset seeded curriculum in PRODUCTION environment!")

    from sqlalchemy import delete, text
    from app.models.curriculum import Module, Unit, UnitConcept
    from app.models.lesson import Lesson, LessonVersion
    from app.models.learning import LearningSessionItem

    # Temporarily disable immutability trigger on lesson_versions for fixture reset
    await db.execute(text("ALTER TABLE lesson_versions DISABLE TRIGGER trg_lesson_version_immutability;"))

    try:
        m_res = await db.execute(select(Module).where(Module.slug.in_(FIXTURE_MODULE_SLUGS)))
        modules = m_res.scalars().all()

        for m in modules:
            u_res = await db.execute(select(Unit).where(Unit.module_id == m.id))
            units = u_res.scalars().all()
            for u in units:
                uc_res = await db.execute(select(UnitConcept.concept_id).where(UnitConcept.unit_id == u.id))
                c_ids = uc_res.scalars().all()
                for c_id in c_ids:
                    lv_res = await db.execute(select(LessonVersion).where(LessonVersion.concept_ids.contains([str(c_id)])))
                    versions = lv_res.scalars().all()
                    for v in versions:
                        await db.execute(delete(LearningSessionItem).where(LearningSessionItem.concept_id == c_id))
                        l_id = v.lesson_id
                        await db.execute(delete(LessonVersion).where(LessonVersion.id == v.id))
                        await db.execute(delete(Lesson).where(Lesson.id == l_id))
                await db.execute(delete(UnitConcept).where(UnitConcept.unit_id == u.id))
                await db.execute(delete(Unit).where(Unit.id == u.id))
            await db.execute(delete(Module).where(Module.id == m.id))

        await db.commit()
    finally:
        await db.execute(text("ALTER TABLE lesson_versions ENABLE TRIGGER trg_lesson_version_immutability;"))
        await db.commit()

    print("🧹 Fixture modules reset safely without affecting user data.")


async def seed_market_basics_curriculum(db: AsyncSession):
    """
    Seeds Module B: Market Basics (Order Flow & Matching Mechanics).
    Proves true generic rendering with 100% generic TABLE renderer and zero Candlestick strings.
    """
    env = os.getenv("ENVIRONMENT", "development").lower()
    if env in ["production", "prod"]:
        raise RuntimeError("Hard Environment Guard: Cannot run dev seed fixtures in PRODUCTION environment!")

    from datetime import datetime, timezone
    from app.models.curriculum import Domain, World, Series, Module, Unit, UnitConcept
    from app.models.concept import Concept
    from app.models.lesson import Lesson, LessonVersion
    from app.models.learning import LearningObjective, LearningActivity

    now = datetime.now(timezone.utc)

    # 1. World: Market Microstructure
    w_res = await db.execute(select(World).where(World.slug == "market_microstructure"))
    world = w_res.scalar_one_or_none()
    if not world:
        d_res = await db.execute(select(Domain).where(Domain.slug == "technical_analysis"))
        domain = d_res.scalar_one_or_none()
        world = World(
            id=uuid.uuid4(),
            domain_id=domain.id if domain else uuid.uuid4(),
            slug="market_microstructure",
            name="Market Microstructure",
            description="Order book mechanics, price discovery, and matching engines.",
            order_index=2,
            created_at=now,
        )
        db.add(world)
        await db.flush()

    # 2. Series: Market Mechanics
    s_res = await db.execute(select(Series).where(Series.slug == "market_mechanics"))
    series = s_res.scalar_one_or_none()
    if not series:
        series = Series(
            id=uuid.uuid4(),
            world_id=world.id,
            slug="market_mechanics",
            name="Market Mechanics & Order Routing",
            description="How orders are matched, queued, and executed in electronic exchanges.",
            order_index=1,
            created_at=now,
        )
        db.add(series)
        await db.flush()

    # 3. Module: Market Basics
    m_res = await db.execute(select(Module).where(Module.slug == "market-basics"))
    module = m_res.scalar_one_or_none()
    if not module:
        module = Module(
            id=uuid.uuid4(),
            series_id=series.id,
            slug="market-basics",
            name="Market Basics: Order Flow & Execution",
            description="Explore order books, bid-ask spreads, and liquidity matching without technical charts.",
            order_index=2,
            created_at=now,
        )
        db.add(module)
        await db.flush()

    # 4. Unit 1: Order Matching Mechanics
    u_res = await db.execute(select(Unit).where(Unit.slug == "order-matching-mechanics", Unit.module_id == module.id))
    unit = u_res.scalar_one_or_none()
    if not unit:
        unit = Unit(
            id=uuid.uuid4(),
            module_id=module.id,
            slug="order-matching-mechanics",
            name="Unit 1: Order Matching & Liquidity",
            description="How limit orders queue, how market orders cross the spread, and why depth matters.",
            order_index=1,
            created_at=now,
        )
        db.add(unit)
        await db.flush()

    # 5. Concept: concept_bid_ask_spread
    c_res = await db.execute(select(Concept).where(Concept.slug == "concept_bid_ask_spread"))
    concept = c_res.scalar_one_or_none()
    if not concept:
        concept = Concept(
            id=uuid.uuid4(),
            slug="concept_bid_ask_spread",
            title="Bid-Ask Spread & Depth",
            domain="markets",
            level="BEGINNER",
            status="PUBLISHED",
            created_at=now,
        )
        db.add(concept)
        await db.flush()

    uc_res = await db.execute(select(UnitConcept).where(UnitConcept.unit_id == unit.id, UnitConcept.concept_id == concept.id))
    if not uc_res.scalar_one_or_none():
        uc = UnitConcept(id=uuid.uuid4(), unit_id=unit.id, concept_id=concept.id, order_index=1, created_at=now)
        db.add(uc)
        await db.flush()

    # 6. Lesson: bid-ask-spread
    l_res = await db.execute(select(Lesson).where(Lesson.slug == "bid-ask-spread"))
    lesson = l_res.scalar_one_or_none()
    if not lesson:
        lesson = Lesson(
            id=uuid.uuid4(),
            slug="bid-ask-spread",
            domain="markets",
            level="BEGINNER",
            created_at=now,
        )
        db.add(lesson)
        await db.flush()

    # 7. Published LessonVersion with 3 TABLE activities
    v_res = await db.execute(select(LessonVersion).where(LessonVersion.lesson_id == lesson.id, LessonVersion.version_number == 1))
    version = v_res.scalar_one_or_none()
    if not version:
        table_blocks = [
            {
                "id": "mb_block_1",
                "type": "EXPLAIN",
                "title": "Order Book Liquidity Matrix",
                "renderer": "TABLE",
                "prompt": "An order book aggregates pending limit orders. Buyers queue on the Bid side, while sellers queue on the Ask side.",
                "cognitive_level": "REMEMBER",
                "difficulty": "BEGINNER",
                "response_type": "NONE",
                "evidence_role": "NONE",
                "payload": {
                    "headers": ["Bid Quantity", "Bid Price", "Ask Price", "Ask Quantity"],
                    "rows": [
                        ["500", "$100.20", "$100.25", "300"],
                        ["1,200", "$100.15", "$100.30", "800"],
                        ["2,500", "$100.10", "$100.35", "1,500"],
                    ],
                    "summary": "Best Bid is $100.20, Best Ask is $100.25. The Bid-Ask Spread is $0.05 (5 cents).",
                },
            },
            {
                "id": "mb_block_2",
                "type": "PREDICT",
                "title": "Predicting Execution Price",
                "renderer": "TABLE",
                "prompt": "A buyer submits a Market Buy order for 200 shares. Based on the depth matrix above, at what price will this order execute immediately?",
                "cognitive_level": "APPLY",
                "difficulty": "INTERMEDIATE",
                "response_type": "SINGLE_CHOICE",
                "evidence_role": "DIAGNOSTIC",
                "payload": {
                    "headers": ["Bid Quantity", "Bid Price", "Ask Price", "Ask Quantity"],
                    "rows": [
                        ["500", "$100.20", "$100.25", "300"],
                        ["1,200", "$100.15", "$100.30", "800"],
                        ["2,500", "$100.10", "$100.35", "1,500"],
                    ],
                },
                "options": [
                    {"id": "opt_ask", "text": "$100.25 (Best Ask — Lowest Available Seller)"},
                    {"id": "opt_bid", "text": "$100.20 (Best Bid — Highest Willing Buyer)"},
                    {"id": "opt_mid", "text": "$100.225 (Mid-market price)"},
                ],
                "correct_option_id": "opt_ask",
                "misconception_map": {
                    "opt_bid": "A market buyer takes liquidity from sellers on the Ask side; you do not buy from other buyers at the Bid."
                },
                "explanation": "Market buy orders cross the spread and fill against the lowest available ask offer ($100.25).",
            },
            {
                "id": "mb_block_3",
                "type": "APPLICATION",
                "title": "Calculating Spread Cost & Slippage",
                "renderer": "TABLE",
                "prompt": "A stock has a Bid of $50.00 and an Ask of $50.50 ($0.50 spread). If a retail trader buys 100 shares at Market and immediately sells 100 shares at Market, what is their round-trip transaction loss from the spread?",
                "cognitive_level": "APPLY",
                "difficulty": "INTERMEDIATE",
                "response_type": "SINGLE_CHOICE",
                "evidence_role": "MASTERY_EVIDENCE",
                "payload": {
                    "headers": ["Transaction", "Price", "Shares", "Cash Flow"],
                    "rows": [
                        ["Buy at Market", "$50.50 (Ask)", "100", "-$5,050.00"],
                        ["Sell at Market", "$50.00 (Bid)", "100", "+$5,000.00"],
                    ],
                },
                "options": [
                    {"id": "cost_50", "text": "$50.00 loss (100 shares × $0.50 spread)"},
                    {"id": "cost_0", "text": "$0.00 loss (Prices haven't moved yet)"},
                    {"id": "cost_500", "text": "$500.00 loss"},
                ],
                "correct_option_id": "cost_50",
                "explanation": "Buying at the Ask ($50.50) and selling at the Bid ($50.00) loses the entire spread of $0.50 per share = $50.00.",
            },
        ]

        version = LessonVersion(
            id=uuid.uuid4(),
            lesson_id=lesson.id,
            version_number=1,
            title="Lesson 1: How Orders Match: The Bid-Ask Spread",
            duration_minutes=3,
            learning_objectives=["Understand order book depth, market vs limit orders, and the true cost of crossing the spread."],
            concept_ids=[str(concept.id)],
            prerequisite_ids=[],
            blocks_json=table_blocks,
            questions_json=[],
            status="PUBLISHED",
            publish_at=now,
            created_at=now,
        )
        db.add(version)
        await db.flush()
        lesson.current_version_id = version.id
        await db.flush()

    # 8. Seed Objective & Activities for Market Basics
    lo_res = await db.execute(select(LearningObjective).where(LearningObjective.concept_id == concept.id))
    lo = lo_res.scalar_one_or_none()
    if not lo:
        lo = LearningObjective(
            id=uuid.uuid4(),
            slug="lo-bid-ask-spread",
            title="Understand Bid-Ask Spread & Depth",
            concept_id=concept.id,
            taxonomy_level="APPLY",
            created_at=now,
        )
        db.add(lo)
        await db.flush()

    existing_acts = (await db.execute(select(LearningActivity).where(LearningActivity.objective_id == lo.id))).scalars().all()
    if len(existing_acts) != 3:
        for a in existing_acts:
            await db.delete(a)
        await db.flush()

        for b_idx, block in enumerate(table_blocks):
            act = LearningActivity(
                id=uuid.uuid4(),
                objective_id=lo.id,
                activity_type=block["type"],
                learning_phase=block["type"],
                interaction_type="MCQ" if block["response_type"] in ("SINGLE_CHOICE", "NONE") else block["response_type"],
                title=block["title"],
                payload={
                    "renderer": block["renderer"],
                    "prompt": block["prompt"],
                    "headers": block.get("payload", {}).get("headers"),
                    "rows": block.get("payload", {}).get("rows"),
                    "summary": block.get("payload", {}).get("summary"),
                    "options": block.get("options"),
                    "correct_option_id": block.get("correct_option_id"),
                    "explanation": block.get("explanation"),
                    "misconception_map": block.get("misconception_map", {}),
                },
                created_at=now,
            )
            db.add(act)
            await db.flush()

    await db.commit()
    print("✅ Market Basics (Module B) seeded successfully in PostgreSQL.")


async def seed_all_curriculum(db: AsyncSession):
    from app.models.curriculum import Module
    m_res = await db.execute(select(Module).where(Module.slug == "candlestick-foundations"))
    if not m_res.scalars().first():
        await seed_candlestick_curriculum(db)
    else:
        print("ℹ️ Candlestick Foundations already exists.")
    await seed_market_basics_curriculum(db)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Seed or reset curriculum fixtures in PostgreSQL.")
    parser.add_argument("--reset", action="store_true", help="Safely reset fixture modules before seeding")
    args = parser.parse_args()

    async def main():
        async with AsyncSessionLocal() as db:
            if args.reset:
                await reset_curriculum(db)
            await seed_all_curriculum(db)

    asyncio.run(main())

