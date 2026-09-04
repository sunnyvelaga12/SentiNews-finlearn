# SentiNews Learn — Executive Architectural, Pedagogical & Technical Review (A–Z)

**Classification:** Strategic Architectural & Pedagogical Review  
**Version:** V1.0 Release Candidate  
**Date:** September 2026  
**System Domain:** Financial Education & Price Action Learning Engine  

---

## Executive Summary

Financial literacy and trading education platforms are overwhelmingly dominated by passive video lectures, high-pressure marketing of indicator "black boxes", and rote memorization of arbitrary geometric chart patterns. Learners spend hundreds of hours watching videos without ever developing the dynamic perceptual skill required to read real-world order books or candlestick price discovery.

**SentiNews Learn** reimagines financial education from first principles:
> **"5 minutes. One concept. One aha moment. Every day."**

It delivers a visual, interactive, constructivist learning engine that transforms passive observers into verified price action practitioners. Through progressive disclosure, supportive misconception remediation, and server-authoritative evidence tracing, learners acquire real market competence that transfers directly to unfamiliar market conditions.

---

## Pedagogical Framework & Cognitive Science Architecture

### 1. Constructivist Active Learning vs. Passive Lecture
Traditional financial education teaches candlestick patterns by presenting static flashcards (e.g. *"This is a Bullish Engulfing candle"*). When real market conditions deviate even slightly from the idealized drawing, the learner experiences cognitive collapse.

SentiNews Learn grounds every lesson in cognitive science:
1. **Notice**: The learner visually isolates the critical anatomical price boundaries (open, high, low, close) without distracting indicators.
2. **Relate**: The learner explains the underlying period price exploration—who was in control (buyers vs sellers) during intraperiod discovery?
3. **Recall & Predict**: The learner predicts future market behavior or reconstructs the candle under varying volatility constraints.

```
       ┌─────────────────────────────────────────────────────────┐
       │                PEDAGOGICAL TRIAD                        │
       ├─────────────────────────────────────────────────────────┤
       │  [Step 1: Notice]  → Identify Anatomical Boundaries     │
       │  [Step 2: Relate]  → Diagnose Buyer vs Seller Control   │
       │  [Step 3: Recall]  → Predict Outcome on Unfamiliar Chart │
       └─────────────────────────────────────────────────────────┘
```

### 2. Non-Punitive Misconception Remediation
In conventional quiz engines, an incorrect answer displays a red $X$ and subtracts points, triggering performance anxiety. In SentiNews Learn:
- An incorrect prediction is treated as an **epistemic discovery opportunity**.
- Specific misconceptions (e.g., confusing upper shadow with bullish momentum instead of buyer exhaustion) are detected through diagnostic response mappings (`misconception_map`).
- The interface provides empathetic, formative feedback and offers progressive 3-tier hints (**Notice $\to$ Relate $\to$ Recall**) before allowing a zero-penalty retry.

### 3. Bayesian Knowledge Tracing & Evidence-Driven Mastery
Every interaction with an evaluative activity card generates a cryptographically fingerprinted attempt in the canonical evidence layer. Concept mastery is computed multi-dimensionally:
- **Application Tier**: Evaluates first-attempt accuracy on visual identification and parameter adjustment.
- **Transfer Tier**: Evaluates whether the learner can apply the concept across varied instruments (equities, indices, commodities) and timeframes (1M, 5M, 1D).
- **Mastery Score**: Continuous scale from 0 to 10,000 (8,000+ indicates verified competence).

---

## System Architecture & Modular Monolith

SentiNews Learn is architected as a modular monolith adhering to strict domain isolation, high cohesion, and low coupling.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FASTAPI CORE                                 │
├───────────────────┬─────────────────────────────────┬───────────────────┤
│ Curriculum Domain │   Frozen Learning Pipeline      │ Telemetry & Auth  │
│ - Progression     │   - Attempt Orchestrator        │ - Session Token   │
│ - Units & Lessons │   - Next Action Engine          │ - Rate Limiter    │
│ - Module Catalog  │   - Learner State Projector     │ - Outbox Worker   │
└─────────┬─────────┴────────────────┬────────────────┴─────────┬─────────┘
          │                          │                          │
          ▼                          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         POSTGRESQL STORAGE                              │
│ - modules, units, lessons, lesson_versions                              │
│ - learning_sessions, learning_attempts, concept_mastery, user_progress  │
│ - idempotency_records, outbox_events, telemetry_events                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1. Technology Stack
- **Backend**: Python 3.11 + FastAPI + SQLAlchemy 2.0 (Asyncio) + Pydantic v2 + PostgreSQL.
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion + Lucide Icons.
- **Testing & Invariants**: Pytest (Asyncio) + Vitest + Playwright E2E.
- **Reliability & Idempotency**: PostgreSQL Transactional Outbox pattern (`FOR UPDATE SKIP LOCKED`) and `Idempotency-Key` duplicate execution prevention.

### 2. Frozen Core Anti-Drift Contract
To guarantee mathematical and pedagogical determinism, the core learning pipeline (14 modules) is cryptographically frozen under `FROZEN_CORE_MANIFEST.json`. Every build and CI execution validates that the canonical SHA-256 fingerprints have zero drift.

Key Modules in the Frozen Core:
1. `app/api/v1/learning.py`: Client boundary API for session execution and attempt submission.
2. `app/services/learning/next_action_engine.py`: Single next-best-action recommendation resolver.
3. `app/services/learning/session_generator.py`: Pinned lesson version session generator.
4. `app/services/learning/pipeline/orchestrator.py`: Atomic attempt evaluation orchestrator.
5. `app/services/learning/pipeline/learner_state_projector.py`: Multi-table derived state projector.

### 3. Architecture Contract Guards
Automated AST (Abstract Syntax Tree) tests enforce critical architectural invariants:
- **No Lower-Level Transaction Boundaries**: Sub-modules inside `pipeline/` cannot invoke `commit()` or `rollback()`; only the top-level orchestrator controls the transactional unit of work.
- **No Auth Imports in Core Learning**: Core learning services remain decoupled from user authentication models to allow offline or simulated execution.
- **Middleware Ordering**: `SessionAuthorizationMiddleware` and CORS protections wrap route handlers in strict security sequence.

---

## Server-Authoritative Progression & Dynamic Unlocking

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        PROGRESSION STATE MACHINE                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    Lesson 1                    Lesson 2                    Lesson 3          │
│   ┌───────────────┐           ┌───────────────┐           ┌───────────────┐  │
│   │  AVAILABLE    │           │    LOCKED     │           │    LOCKED     │  │
│   └───────┬───────┘           └───────────────┘           └───────────────┘  │
│           │ [Completes Canvas]                                               │
│           ▼                                                                  │
│   ┌───────────────┐  Unlocks  ┌───────────────┐           ┌───────────────┐  │
│   │   COMPLETED   │ ────────> │   AVAILABLE   │           │    LOCKED     │  │
│   │   (Score 100) │           │ (Start Lesson)│           │               │  │
│   └───────────────┘           └───────────────┘           └───────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1. The Dual-Write Resilience Pattern
Network interruptions or local caching must never result in lost learner momentum. SentiNews Learn employs a resilient dual-write model:
1. **Server-Authoritative Mutation**: When a learner completes the final block of a lesson, `POST /api/v1/curriculum/lessons/{slug}/complete` is dispatched. The server atomically updates `user_progress`, updates `concept_mastery`, recalculates module completion, and returns the newly unlocked next lesson.
2. **Client Offline Cache**: The client caches completed slugs in `localStorage['sentinews_completed_lessons']`. The UI instantly reflects the unlocked state across browser tabs, seamlessly reconciling with server state on next fetch.

### 2. Sequential Unlocking Contract
Lessons within a module adhere to sequential mastery gating:
- Lesson $1$ is unconditionally `AVAILABLE` for all learners.
- Lesson $N+1$ transitions from `LOCKED` to `AVAILABLE` the moment Lesson $N$ is marked `COMPLETED`.
- When all lessons in a unit or module are complete, the Capstone Challenge and capability credential badge are unlocked.

---

## Editorial Design System & User Profile (`/you`)

The user interface rejects the generic dark "crypto terminal" aesthetic in favor of a warm, refined editorial light palette designed for extended readability and focus.

### 1. Palette & Typography Tokens
- **Canvas Base**: `#FBFBFA` (warm off-white eggshell).
- **Primary Typography**: `#17202A` (deep slate carbon).
- **Secondary Text**: `#4B5563` (slate gray).
- **Borders & Dividers**: `#E5E7EB` (neutral hairline border).
- **Accent Blues**: `#2563EB` (focal action) and `#EFF6FF` (subtle badge pill).
- **Verification Green**: `#059669` (verified capability milestone).

### 2. Profile Section (`/you`) Capabilities
- **7-Day Momentum Heatmap**: Visualizes daily practice consistency and streak tracking against the learner's 5-day weekly goal.
- **Dynamic Next Target**: Suggests the single next actionable milestone based on authoritative curriculum evaluation.
- **Verified Capabilities & Badges**: Displays earned micro-credentials (such as *Candlestick Reader*) backed by SEBI Investor Education alignment.
- **Milestone History**: Chronological audit trail of verified concept completions.
- **Developer QA Reset Tool**: Integrated reset action allowing immediate test iteration without clearing cookies or database restarts.

---

## Security, Verification & Quality Assurance Matrix

### 1. Defense-in-Depth Security
- **Strict CSRF & CORS Protection**: Origin validation with credential isolation.
- **No Evaluation Keys Leakage**: `ProgressionEngine` sanitizes all activity blocks before output; correct answer keys and misconception diagnostic mappings never touch client payloads.
- **Bounded Queries (Zero N+1)**: Curriculum tree, units, and lesson versions are prefetched in bounded SQL queries with indexed lookups.

### 2. Deterministic Reproducibility Audit
The codebase has undergone two-pass automated reproducibility verification (`release_reproducibility.log`):
- **Pass 1 & Pass 2 Invariant Parity**: 100% agreement across database migrations, frozen core checksums, architecture AST guards, and frontend Vitest suites.

---

## Conclusion & Production Readiness

SentiNews Learn represents a complete, mathematically grounded, and aesthetically elevated implementation of interactive financial education. By bridging rigorous pedagogical cognitive science with high-throughput distributed systems patterns, it sets a new benchmark for fintech learning platforms.
