# SentiNews Learn

> **5 minutes. One concept. One aha moment. Every day.**

SentiNews Learn is a React-first, visual, interactive financial education platform integrated with the SentiNews ecosystem.

## Stack & Architecture

- **Frontend**: React 19 + TypeScript + Vite + React Router v7 (Framework Mode with Static Pre-rendering) + Tailwind CSS + Framer Motion.
- **Backend**: Python FastAPI Modular Monolith + SQLAlchemy 2.0 (Async) + Pydantic v2 + Argon2id Auth + PostgreSQL.
- **Database**: PostgreSQL (Development, Testing, Staging, Production).
- **SEO Architecture**: Public pages under `/school/*` are statically pre-rendered to pure HTML at build time for instant loading and 100% crawlability.
- **Dynamic Lesson Engine**: Lessons are data-driven JSON specifications validated by `content/lesson.schema.json` and rendered dynamically via generic block components.
- **Reliability & Idempotency**: PostgreSQL Transactional Outbox pattern (`FOR UPDATE SKIP LOCKED`) and `Idempotency-Key` duplicate prevention.

## Getting Started

### Local PostgreSQL Database
```bash
docker-compose up -d
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## ADR Architecture Governance
All architectural choices are locked for V1. Any modification requires an approved Architecture Decision Record in `docs/adr/`.
