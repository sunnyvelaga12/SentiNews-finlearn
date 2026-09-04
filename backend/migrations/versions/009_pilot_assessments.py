"""Pilot Assessment Instrumentation — Migration 009: Pilot Assessments and Definitions

Revision ID: 009_pilot_assessments
Revises: 008_refresh_and_telemetry
Create Date: 2026-08-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '009_pilot_assessments'
down_revision: Union[str, None] = '008_refresh_and_telemetry'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Create enum type if not exists
    assessment_type_enum = postgresql.ENUM('BASELINE', 'IMMEDIATE', 'DELAYED', 'TRANSFER', name='assessment_type_enum', create_type=False)
    assessment_type_enum.create(conn, checkfirst=True)

    # 2. Pilot Assessment Definitions table
    if 'pilot_assessment_definitions' not in tables:
        op.create_table(
            'pilot_assessment_definitions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('code', sa.String(50), nullable=False, unique=True),
            sa.Column('title', sa.String(150), nullable=False),
            sa.Column('description', sa.String(500), nullable=True),
            sa.Column('assessment_type', assessment_type_enum, nullable=False, server_default='BASELINE'),
            sa.Column('domain', sa.String(50), nullable=False, server_default='general'),
            sa.Column('question_pool', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
            sa.Column('passing_score', sa.Integer(), nullable=False, server_default='7000'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_pilot_assessment_defs_code', 'pilot_assessment_definitions', ['code'], unique=True)

    # 3. Pilot Assessments table
    if 'pilot_assessments' not in tables:
        op.create_table(
            'pilot_assessments',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('learner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('assessment_definition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('pilot_assessment_definitions.id', ondelete='CASCADE'), nullable=False),
            sa.Column('assessment_type', assessment_type_enum, nullable=False),
            sa.Column('concept_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('concepts.id', ondelete='SET NULL'), nullable=True),
            sa.Column('score', sa.Integer(), nullable=False),
            sa.Column('confidence', sa.Integer(), nullable=False, server_default='3'),
            sa.Column('response_time_ms', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('idempotency_key', sa.String(128), nullable=False),
            sa.Column('raw_responses', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
            sa.Column('attempted_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint('score >= 0 AND score <= 10000', name='chk_pilot_assessment_score'),
            sa.CheckConstraint('confidence >= 1 AND confidence <= 5', name='chk_pilot_assessment_confidence'),
            sa.CheckConstraint('response_time_ms >= 0', name='chk_pilot_assessment_response_time'),
            sa.UniqueConstraint('learner_id', 'assessment_definition_id', 'idempotency_key', name='uq_pilot_assessment_idemp'),
        )
        op.create_index('ix_pilot_assessments_learner_id', 'pilot_assessments', ['learner_id'])
        op.create_index('ix_pilot_assessments_definition_id', 'pilot_assessments', ['assessment_definition_id'])
        op.create_index('ix_pilot_assessment_learner_type_time', 'pilot_assessments', ['learner_id', 'assessment_type', 'attempted_at'])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'pilot_assessments' in tables:
        op.drop_table('pilot_assessments')

    if 'pilot_assessment_definitions' in tables:
        op.drop_table('pilot_assessment_definitions')

    op.execute("DROP TYPE IF EXISTS assessment_type_enum")
