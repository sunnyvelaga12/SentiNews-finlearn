"""Phase 2A.1 Hardening — Migration 2: Backfill

Architecture Contract v3 — Gate 1B

Backfills new columns from existing data:
1. evidence_snapshot from evaluation_json + context_json + evidence_json + versions_json
2. response_snapshot from attempt_result_snapshot
3. aggregate_sequence via ROW_NUMBER OVER (PARTITION BY user_id, concept_id ORDER BY attempted_at, id)
4. received_at from attempted_at (best approximation for historical data)

Rollback: Sets new columns back to NULL. Non-destructive.

Revision ID: 005_phase2a1_v3_backfill
Revises: 004_phase2a1_v3_additive
Create Date: 2026-08-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_phase2a1_v3_backfill'
down_revision: Union[str, None] = '004_phase2a1_v3_additive'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Backfill evidence_snapshot from legacy JSON columns ────────────
    op.execute("""
        UPDATE learning_attempts
        SET evidence_snapshot = jsonb_build_object(
            'schema_version', 1,
            'evaluation', COALESCE(evaluation_json, '{}'::jsonb),
            'learning_context', COALESCE(context_json, '{}'::jsonb),
            'evidence', COALESCE(evidence_json, '{}'::jsonb),
            'versions', COALESCE(versions_json, '{}'::jsonb)
        )
        WHERE evidence_snapshot IS NULL
    """)

    # ── 2. Backfill response_snapshot from attempt_result_snapshot ─────────
    op.execute("""
        UPDATE learning_attempts
        SET response_snapshot = attempt_result_snapshot
        WHERE response_snapshot IS NULL
          AND attempt_result_snapshot IS NOT NULL
    """)

    # ── 3. Backfill aggregate_sequence via window function ────────────────
    # Canonical ordering for historical data: attempted_at ASC, id ASC
    op.execute("""
        UPDATE learning_attempts la
        SET aggregate_sequence = sub.seq
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY user_id, concept_id
                       ORDER BY attempted_at ASC, id ASC
                   ) AS seq
            FROM learning_attempts
        ) sub
        WHERE la.id = sub.id
          AND la.aggregate_sequence IS NULL
    """)

    # ── 4. Backfill received_at from attempted_at ─────────────────────────
    op.execute("""
        UPDATE learning_attempts
        SET received_at = attempted_at
        WHERE received_at IS NULL
    """)

    # ── 5. Backfill last_event_sequence on concept_mastery ────────────────
    # Set to the max aggregate_sequence for each (user_id, concept_id)
    op.execute("""
        UPDATE concept_mastery cm
        SET last_event_sequence = COALESCE(sub.max_seq, 0)
        FROM (
            SELECT user_id, concept_id, MAX(aggregate_sequence) AS max_seq
            FROM learning_attempts
            GROUP BY user_id, concept_id
        ) sub
        WHERE cm.user_id = sub.user_id
          AND cm.concept_id = sub.concept_id
          AND cm.last_event_sequence = 0
    """)


def downgrade() -> None:
    # Non-destructive: set new columns back to NULL
    op.execute("UPDATE learning_attempts SET evidence_snapshot = NULL")
    op.execute("UPDATE learning_attempts SET response_snapshot = NULL")
    op.execute("UPDATE learning_attempts SET aggregate_sequence = NULL")
    op.execute("UPDATE learning_attempts SET received_at = NULL")
    op.execute("UPDATE concept_mastery SET last_event_sequence = 0")
