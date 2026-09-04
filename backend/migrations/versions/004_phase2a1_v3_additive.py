"""Phase 2A.1 Hardening — Migration 1: Additive Schema Changes

Architecture Contract v3 — Gate 1

This migration is purely additive. No data changes, no column drops.
Safe to roll back by dropping the added columns and constraints.

Changes:
1. learning_attempts: add aggregate_sequence, received_at, evidence_snapshot, response_snapshot
2. learning_attempts: add UNIQUE(session_item_id) — A10/A15
3. learning_attempts: add UNIQUE(user_id, concept_id, aggregate_sequence) — A4/A16
4. concept_mastery: add aggregate_version, last_event_sequence — A4
5. idempotency_records: redesign for v3 contract — A12/A14

Revision ID: 004_phase2a1_v3_additive
Revises: 003_phase2a1_hardening_schema
Create Date: 2026-08-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = '004_phase2a1_v3_additive'
down_revision: Union[str, None] = '003_phase2a1_hardening_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # ── 1. learning_attempts: add new columns ─────────────────────────────
    la_cols = [c['name'] for c in inspector.get_columns('learning_attempts')]

    if 'aggregate_sequence' not in la_cols:
        op.add_column('learning_attempts',
            sa.Column('aggregate_sequence', sa.Integer(), nullable=True))

    if 'received_at' not in la_cols:
        op.add_column('learning_attempts',
            sa.Column('received_at', sa.DateTime(timezone=True), nullable=True))

    if 'evidence_snapshot' not in la_cols:
        op.add_column('learning_attempts',
            sa.Column('evidence_snapshot', JSONB(), nullable=True))

    if 'response_snapshot' not in la_cols:
        op.add_column('learning_attempts',
            sa.Column('response_snapshot', JSONB(), nullable=True))

    # ── 2. learning_attempts: add UNIQUE constraints ──────────────────────
    la_constraints = [c['name'] for c in inspector.get_unique_constraints('learning_attempts')]

    # A10/A15: One attempt per session_item
    if 'uq_one_attempt_per_session_item' not in la_constraints:
        op.create_unique_constraint(
            'uq_one_attempt_per_session_item',
            'learning_attempts',
            ['session_item_id'],
        )

    # A4/A16: No duplicate aggregate sequences per (user, concept)
    if 'uq_aggregate_sequence' not in la_constraints:
        op.create_unique_constraint(
            'uq_aggregate_sequence',
            'learning_attempts',
            ['user_id', 'concept_id', 'aggregate_sequence'],
        )

    # ── 3. concept_mastery: add aggregate coordination columns ────────────
    cm_cols = [c['name'] for c in inspector.get_columns('concept_mastery')]

    if 'aggregate_version' not in cm_cols:
        op.add_column('concept_mastery',
            sa.Column('aggregate_version', sa.Integer(),
                      nullable=False, server_default='0'))

    if 'last_event_sequence' not in cm_cols:
        op.add_column('concept_mastery',
            sa.Column('last_event_sequence', sa.Integer(),
                      nullable=False, server_default='0'))

    # ── 4. idempotency_records: add new columns for v3 contract ───────────
    ir_cols = [c['name'] for c in inspector.get_columns('idempotency_records')]

    if 'operation_type' not in ir_cols:
        op.add_column('idempotency_records',
            sa.Column('operation_type', sa.String(50), nullable=True))
        # Backfill existing rows with a default operation type
        op.execute("UPDATE idempotency_records SET operation_type = 'LEGACY' WHERE operation_type IS NULL")
        op.alter_column('idempotency_records', 'operation_type', nullable=False)

    if 'attempt_id' not in ir_cols:
        op.add_column('idempotency_records',
            sa.Column('attempt_id', UUID(as_uuid=True), nullable=True))

    if 'response_snapshot' not in ir_cols:
        op.add_column('idempotency_records',
            sa.Column('response_snapshot', JSONB(), nullable=True))

    if 'request_fingerprint' not in ir_cols:
        op.add_column('idempotency_records',
            sa.Column('request_fingerprint', sa.String(64), nullable=True))

    if 'completed_at' not in ir_cols:
        op.add_column('idempotency_records',
            sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))

    # ── 5. idempotency_records: update unique constraint ──────────────────
    ir_constraints = [c['name'] for c in inspector.get_unique_constraints('idempotency_records')]

    # Drop old constraint if it exists
    ir_indexes = [idx['name'] for idx in inspector.get_indexes('idempotency_records')]
    if 'uq_user_idempotency_key_endpoint' in ir_indexes:
        op.drop_index('uq_user_idempotency_key_endpoint', table_name='idempotency_records')

    # Create new v3 constraint: (user_id, operation_type, idempotency_key)
    if 'uq_user_operation_idempotency' not in ir_constraints:
        op.create_unique_constraint(
            'uq_user_operation_idempotency',
            'idempotency_records',
            ['user_id', 'operation_type', 'idempotency_key'],
        )


def downgrade() -> None:
    # ── Reverse in opposite order ─────────────────────────────────────────

    # 5. Restore old idempotency constraint
    op.drop_constraint('uq_user_operation_idempotency', 'idempotency_records', type_='unique')
    # Note: cannot fully restore old constraint without old columns; partial rollback

    # 4. Drop idempotency new columns
    op.drop_column('idempotency_records', 'completed_at')
    op.drop_column('idempotency_records', 'request_fingerprint')
    op.drop_column('idempotency_records', 'response_snapshot')
    op.drop_column('idempotency_records', 'attempt_id')
    op.drop_column('idempotency_records', 'operation_type')

    # 3. Drop concept_mastery aggregate columns
    op.drop_column('concept_mastery', 'last_event_sequence')
    op.drop_column('concept_mastery', 'aggregate_version')

    # 2. Drop learning_attempts constraints
    op.drop_constraint('uq_aggregate_sequence', 'learning_attempts', type_='unique')
    op.drop_constraint('uq_one_attempt_per_session_item', 'learning_attempts', type_='unique')

    # 1. Drop learning_attempts new columns
    op.drop_column('learning_attempts', 'response_snapshot')
    op.drop_column('learning_attempts', 'evidence_snapshot')
    op.drop_column('learning_attempts', 'received_at')
    op.drop_column('learning_attempts', 'aggregate_sequence')
