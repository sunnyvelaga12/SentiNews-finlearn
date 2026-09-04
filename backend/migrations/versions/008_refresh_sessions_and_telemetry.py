"""Phase 2A.1 Hardening — Migration 4: Refresh Sessions and Telemetry

Revision ID: 008_refresh_sessions_and_telemetry
Revises: 007_drop_legacy_idemp_cols
Create Date: 2026-08-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '008_refresh_and_telemetry'
down_revision: Union[str, None] = '007_drop_legacy_idemp_cols'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Refresh Sessions table
    if 'revoked_sessions' in tables:
        op.drop_table('revoked_sessions')

    if 'refresh_sessions' not in tables:
        op.create_table(
            'refresh_sessions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('family_id', postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column('token_hash', sa.String(64), nullable=False, unique=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('replaced_by', postgresql.UUID(as_uuid=True), nullable=True),
        )
        op.create_index('ix_refresh_sessions_user_id', 'refresh_sessions', ['user_id'])
        op.create_index('ix_refresh_sessions_family_id', 'refresh_sessions', ['family_id'])
        op.create_index('ix_refresh_sessions_token_hash', 'refresh_sessions', ['token_hash'], unique=True)

    # 2. Telemetry Events table
    if 'telemetry_events' not in tables:
        op.create_table(
            'telemetry_events',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('client_event_id', sa.String(128), nullable=True),
            sa.Column('event_name', sa.String(100), nullable=False),
            sa.Column('event_version', sa.String(20), nullable=False, server_default='1.0'),
            sa.Column('schema_version', sa.String(20), nullable=False, server_default='1.0'),
            sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('session_item_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('concept_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_telemetry_events_client_event_id', 'telemetry_events', ['client_event_id'])
        op.create_index('ix_telemetry_events_event_name', 'telemetry_events', ['event_name'])
        op.create_index('ix_telemetry_events_user_id', 'telemetry_events', ['user_id'])
        op.create_index('ix_telemetry_events_session_id', 'telemetry_events', ['session_id'])
        op.create_index('ux_telemetry_user_client_event', 'telemetry_events', ['user_id', 'client_event_id'], unique=True)
        op.create_index('ix_telemetry_user_occurred', 'telemetry_events', ['user_id', 'occurred_at'])
        op.create_index('ix_telemetry_event_occurred', 'telemetry_events', ['event_name', 'occurred_at'])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'telemetry_events' in tables:
        op.drop_table('telemetry_events')

    if 'refresh_sessions' in tables:
        op.drop_table('refresh_sessions')

    if 'revoked_sessions' not in tables:
        op.create_table(
            'revoked_sessions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('hashed_refresh_token', sa.String(64), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index('ix_revoked_sessions_hashed_refresh_token', 'revoked_sessions', ['hashed_refresh_token'])
