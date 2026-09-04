# ADR 005: Canonical Phase C Execution & Server-Side Telemetry Contract

* **Status**: APPROVED & LOCKED (Canonical Phase C Contract — 9.8/10 Verdict)
* **Date**: 2026-08-17
* **Deciders**: Technical Lead & Product Lead
* **Scope**: Phase C Content Production, Telemetry Ingestion, & Learner Validation

---

## 1. Context & Lifecycle Status Model
SentiNews Learn has locked its V1 modular monolith architecture (React 19 + TypeScript + Vite $\to$ FastAPI $\to$ Neon PostgreSQL). 

### Phase C Overall Status
* **Technical Infrastructure**: 🔵 VERIFIED (Complete & Frozen)
* **Phase C-A (Golden Lesson 1 Authoring & Testing)**: 🟡 VALIDATING (Executing)
* **Phase C-B (Golden Lessons 2 & 3 Production)**: 🟡 VALIDATING (Pending Lesson 1 Validation)

### Lifecycle State Definitions
* 🟢 **IMPLEMENTED**: Code written & compiled
* 🔵 **VERIFIED**: Automated/manual verification tests passed
* 🟡 **VALIDATING**: Real human authors/learners currently testing
* 🟣 **PROVEN**: Product behavior & retention repeatedly demonstrated
* 🔴 **BLOCKED**: Progress halted by critical defect

---

## 2. Canonical Application Configuration
* **Backend API Base**: `http://127.0.0.1:8000` (API Docs: `http://127.0.0.1:8000/docs`)
* **Frontend Application Base**: `http://localhost:5174`
* **Admin Content Studio Route**: `http://localhost:5174/admin`
* **Learner Home Route**: `http://localhost:5174/app/home`
* **Learner Player Route**: `http://localhost:5174/app/lesson/{slug}`
* **Telemetry Table**: `analytics_events` (SQLAlchemy `AnalyticsEvent`)
* **Telemetry Endpoint**: `POST /api/v1/analytics/events`

---

## 3. Server-Side Telemetry Evaluation & Interaction Schemas

### Interaction Schema Distinction & Zero Fake Precision

1. **MCQ Event (`mcq_accuracy`)**:
   ```json
   {
     "event_id": "UUID",
     "event_name": "mcq_accuracy",
     "user_id": "UUID",
     "session_id": "UUID",
     "lesson_id": "UUID",
     "lesson_version_id": "UUID",
     "properties": {
       "question_id": "UUID",
       "selected_option": 1,
       "actual_correct": true
     }
   }
   ```
   *`actual_correct` derived server-side against `LessonVersion.questions_json`.*

2. **Deterministic Question Confidence Calibration Event (`confidence_calibration`)**:
   ```json
   {
     "event_id": "UUID",
     "event_name": "confidence_calibration",
     "user_id": "UUID",
     "session_id": "UUID",
     "lesson_id": "UUID",
     "lesson_version_id": "UUID",
     "properties": {
       "question_id": "UUID",
       "confidence_score": 4,
       "actual_correct": true,
       "calibration_gap": -0.2
     }
   }
   ```
   *Applicable strictly to objectively gradable questions (MCQ).*

3. **Active Recall Event (`active_recall`)**:
   ```json
   {
     "event_id": "UUID",
     "event_name": "active_recall",
     "user_id": "UUID",
     "session_id": "UUID",
     "lesson_id": "UUID",
     "lesson_version_id": "UUID",
     "properties": {
       "question_id": "UUID",
       "recall_response": "Money is something people generally accept in exchange for value.",
       "confidence_score": 4
     }
   }
   ```
   *`actual_correct` and `calibration_gap` are strictly omitted for free-text recall to prevent fake precision prior to introducing explicit grading.*

### Core Metric Definitions
1. **Confidence Calibration Gap (Server-Derived for Deterministic Questions)**:
   $$\text{calibration\_gap} = \frac{\text{confidence\_score}}{5.0} - (\text{1.0 if actual\_correct is true else 0.0})$$
2. **Phase C Experiment Metric (Lesson 1 Continuation Rate)**:
   $$\text{Lesson 1 Continuation Rate} = \frac{\text{Learners completing Lesson 1 who explicitly click 'Start Lesson 2'}}{\text{Learners completing Lesson 1}}$$
   *(Auto-advance strictly prohibited; explicit button click required).*
3. **Product North Star Metric (Long-Term)**:
   **Weekly Active Learners (WAL)** completing $\ge 1$ full lesson per week.

---

## 4. Human Content Authoring Quality Standard (10 Rules)
Every lesson authored through Content Studio MUST satisfy:
1. **Single Learning Objective**: One sentence (*"After this lesson, the learner can ______"*).
2. **One Core Idea**: Focus strictly on one central concept per beginner lesson. (Subordinate supporting terms like Medium of Exchange, Store of Value, and Unit of Account to the single core discovery).
3. **Curiosity Hook**: Pique curiosity before offering the explanation.
4. **Visual Metaphor**: Concrete real-world analogy to anchor intuition (must improve comprehension, not decorative).
5. **Technically Accurate Explanation**: Simple language, zero compromise on financial precision.
6. **Meaningful Interaction**: Interactive check embedded midway.
7. **Active Recall**: Force retrieval of key idea, not passive reading.
8. **Confidence Calibration Policy**: For objectively gradable questions, collect a 1–5 confidence rating after the learner answers. Free-text active recall may collect confidence for qualitative research, but must not generate `actual_correct` or `calibration_gap` without a validated grading methodology.
9. **Mental Model Summary**: Conclude with a clear mental model, not a wall of text.
10. **Authoritative Citations**: Every externally verifiable financial, market, regulatory, statistical, or historical claim must have an appropriate primary source attached (RBI, SEBI, NSE, BSE, MCA, official filings). Secondary sources used only when primary is unavailable. Pedagogical analogies do not require citations.

---

## 5. Phase C 20-Point Acceptance Matrix

| Item | Requirement & Source of Truth | Status |
| :--- | :--- | :--- |
| 1. Curriculum Hierarchy | Domain $\to$ World $\to$ Series $\to$ Module persisted in Neon PostgreSQL | 🔵 VERIFIED |
| 2. Concept Creation | Created visually in UI $\to$ persisted in Neon PostgreSQL | 🔵 VERIFIED |
| 3. Concept Relationship | Prerequisite edges $\to$ cycle prevention in Neon PostgreSQL | 🔵 VERIFIED |
| 4. Lesson Creation | Visual builder $\to$ draft `LessonVersion` in Neon PostgreSQL | 🔵 VERIFIED |
| 5. Block Creation | All 9 visual block types saved in `LessonVersion.blocks_json` | 🔵 VERIFIED |
| 6. Question Creation | Stable `question_id` UUID embedded in `LessonVersion.questions_json` | 🔵 VERIFIED |
| 7. Source Attachment | Citations attached with regulatory/exchange URL enforcement | 🔵 VERIFIED |
| 8. Draft Autosave | Draft state survives browser refresh and application restart | 🔵 VERIFIED |
| 9. Live Preview | Shared `BlockRenderer` output matches Learner player UI | 🔵 VERIFIED |
| 10. RBAC Review | `CONTENT_REVIEWER`, `FINANCE_REVIEWER`, `COMPLIANCE_REVIEWER` enforced server-side | 🔵 VERIFIED |
| 11. Atomic Publish | Single transaction (schema check, audit log, status update, outbox event) | 🔵 VERIFIED |
| 12. Learner Fetch | `GET /api/v1/lessons/by-slug/{slug}` queries published version from Neon | 🔵 VERIFIED |
| 13. Versioning | Published `v1` remains immutable when `v2` draft progresses | 🔵 VERIFIED |
| 14. Telemetry Persistence | Ingested via `POST /api/v1/analytics/events` to `analytics_events` table | 🔵 VERIFIED |
| 15. Server-Side Evaluation | `actual_correct` & `calibration_gap` derived server-side for MCQ | 🔵 VERIFIED |
| 16. MCQ Accuracy | `mcq_accuracy` recorded per `question_id` | 🔵 VERIFIED |
| 17. Free-Text Recall | `active_recall` stores text + confidence score without fake precision | 🔵 VERIFIED |
| 18. Explicit Continuation | Triggered only on explicit user click to 'Start Lesson 2' | 🔵 VERIFIED |
| 19. Idempotency Check | `UNIQUE(event_id)` prevents duplicate retry submissions | 🔵 VERIFIED |
| 20. Real Learner Validation | Golden Lesson 1 tested with real beginners for UX feedback | 🟡 VALIDATING |

---

## 6. Architecture Freeze Rule
Zero architectural redesigns, technology stack changes, or new infrastructure components are permitted during Phase C. All production content is authored via Content Studio into Neon PostgreSQL.
