"""Phase 2A.1 Hardening — Migration 3: Drop Legacy Idempotency Columns

Architecture Contract v3 — Final cleanup

Migration 004 added the v3 idempotency columns (operation_type, request_fingerprint,
attempt_id, response_snapshot, completed_at) but left the legacy columns from
migration 001 intact for safety. Those legacy columns (endpoint, request_hash,
response_status, response_body, expires_at) are NOT in the v3 ORM model and several
are NOT NULL, causing IntegrityError on new inserts.

This migration drops the legacy columns that no longer serve any purpose.

Revision ID: 007_drop_legacy_idemp_cols
Revises: 006_v3_immutability_trigger
Create Date: 2026-08-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = '007_drop_legacy_idemp_cols'
down_revision: Union[str, None] = '006_v3_immutability_trigger'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    ir_cols = [c['name'] for c in inspector.get_columns('idempotency_records')]

    # Drop legacy columns that are no longer in the v3 ORM model.
    # These were created in migration 001 and superseded by 004.
    legacy_columns = ['endpoint', 'request_hash', 'response_status', 'response_body', 'expires_at']
    for col in legacy_columns:
        if col in ir_cols:
            op.drop_column('idempotency_records', col)


def downgrade() -> None:
    # Re-add legacy columns with nullable defaults (non-destructive restore)
    op.add_column('idempotency_records',
        sa.Column('endpoint', sa.String(255), nullable=True))
    op.add_column('idempotency_records',
        sa.Column('request_hash', sa.String(64), nullable=True))
    op.add_column('idempotency_records',
        sa.Column('response_status', sa.Integer(), nullable=True))
    op.add_column('idempotency_records',
        sa.Column('response_body', JSONB(), nullable=True))
    op.add_column('idempotency_records',
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
