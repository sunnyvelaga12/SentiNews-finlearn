# ADR 006: Learner-First Product Vision & Learning Engine Benchmark Synthesis

* **Status**: APPROVED & LOCKED (Product Vision Benchmark Contract)
* **Date**: 2026-08-17
* **Deciders**: Technical Lead & Product Lead
* **Scope**: Synthesis of Global Benchmarks (Duolingo, Khan Academy, Varsity, Anki, 1% Club, Codecademy) into SentiNews Learn's Core Product & Engine Vision

---

## 1. Context & Executive Summary
SentiNews Learn moves from infrastructure validation into **Product-First Learning Mechanics**. Rather than building a conventional video/article learning management system (LMS), SentiNews Learn synthesizes the proven mechanics of world-class learning products:

* **Duolingo**: Habit loop, daily 5-minute commitment, streaks, XP, bite-sized progression, session generator.
* **Khan Academy**: Mastery progression (`Not Started` $\to$ `Attempted` $\to$ `Familiar` $\to$ `Proficient` $\to$ `Mastered`).
* **Zerodha Varsity**: Deep Indian financial curriculum (basic market concepts to advanced investing).
* **Anki / FSRS**: Spaced repetition memory retention intervals (+1d, +3d, +7d, +14d, +30d).
* **1% Club**: Practical financial decision positioning & community habit formation.
* **Codecademy**: Interactive financial calculations & scenario-based learning.

---

## 2. Learner-First Product Architecture

```
                       SentiNews Learn
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
       Learner App     Learning Engine      Analytics
     (Daily Commitment) (Mastery & Recall)  (Telemetry)
            │                 │                 │
            ▼                 ▼                 ▼
     Home / Path /     Concept Mastery    analytics_events
     Lesson Player     Spaced Scheduler
```

### Core Hierarchy Shift
$$\text{Learner} \longrightarrow \text{Learning Engine} \longrightarrow \text{Concepts} \longrightarrow \text{Lessons / Practice}$$

Production content is authored via Content Studio into PostgreSQL to serve the **Learning Engine**, which evaluates learner mastery and schedules recall items.

---

## 3. Product Phase Roadmap (P1 to P5)

### Phase P1 — Learner Experience (🔵 VERIFIED)
- **Home Screen**: Daily 5-minute commitment hero card, active streak counter, spaced review queue, concept mastery progress bars.
- **Interactive Player**: BlockRenderer (Heading, Story, Text, Comparison, MCQ, Recall, Summary).

### Phase P2 — Learning Engine (🔵 VERIFIED)
- **Concept Mastery Engine** (`mastery_service.py`): Calculates 0–100 mastery combining accuracy, recent performance, and confidence calibration.
- **Spaced Review Scheduler** (`review_scheduler.py`): Stages 1–5 intervals (+1d, +3d, +7d, +14d, +30d).

### Phase P3 — Habit & Engagement (🟡 VALIDATING)
- **Habit Loop**: Streaks (7-day flame badge), daily goal commitment, voluntary lesson continuation CTA.

### Phase P4 — Telemetry & Server Evaluation (🔵 VERIFIED)
- **Telemetry Contract**: Envelope with explicit `session_id`, `lesson_version_id`, and `UNIQUE(event_id)`.
- **Server Evaluation**: `actual_correct` and `calibration_gap` derived server-side.

### Phase P5 — Golden Content & Real Learner Testing (🟡 EXECUTING)
- **Golden Lesson 1**: *What Is Money?* authored through Content Studio into Neon PostgreSQL for real beginner testing.

---

## 4. Competitive Positioning
SentiNews Learn is positioned as a **Financial Learning System** that builds lasting financial understanding and practical decision capability, rather than passive content consumption.
