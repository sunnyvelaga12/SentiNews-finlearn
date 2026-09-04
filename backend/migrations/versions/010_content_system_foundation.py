"""Content System Foundation — Migration 010: Provenance, Jurisdiction, and Versioning Metadata

Revision ID: 010_content_system_foundation
Revises: 009_pilot_assessments
Create Date: 2026-08-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '010_content_system_foundation'
down_revision: Union[str, None] = '009_pilot_assessments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. Enhance concepts table
    concept_cols = [c['name'] for c in inspector.get_columns('concepts')]
    if 'jurisdiction' not in concept_cols:
        op.add_column('concepts', sa.Column('jurisdiction', sa.String(10), server_default='GLOBAL', nullable=False))
    if 'effective_from' not in concept_cols:
        op.add_column('concepts', sa.Column('effective_from', sa.DateTime(timezone=True), nullable=True))
    if 'effective_to' not in concept_cols:
        op.add_column('concepts', sa.Column('effective_to', sa.DateTime(timezone=True), nullable=True))

    # 2. Enhance sources table
    source_cols = [c['name'] for c in inspector.get_columns('sources')]
    if 'jurisdiction' not in source_cols:
        op.add_column('sources', sa.Column('jurisdiction', sa.String(10), server_default='GLOBAL', nullable=False))
    if 'effective_date' not in source_cols:
        op.add_column('sources', sa.Column('effective_date', sa.DateTime(timezone=True), nullable=True))
    if 'version' not in source_cols:
        op.add_column('sources', sa.Column('version', sa.Integer(), server_default='1', nullable=False))

    # 3. Enhance lesson_versions table
    lv_cols = [c['name'] for c in inspector.get_columns('lesson_versions')]
    if 'publish_at' not in lv_cols:
        op.add_column('lesson_versions', sa.Column('publish_at', sa.DateTime(timezone=True), nullable=True))
    if 'unpublish_at' not in lv_cols:
        op.add_column('lesson_versions', sa.Column('unpublish_at', sa.DateTime(timezone=True), nullable=True))
    if 'change_reason' not in lv_cols:
        op.add_column('lesson_versions', sa.Column('change_reason', sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Revert lesson_versions
    lv_cols = [c['name'] for c in inspector.get_columns('lesson_versions')]
    if 'change_reason' in lv_cols:
        op.drop_column('lesson_versions', 'change_reason')
    if 'unpublish_at' in lv_cols:
        op.drop_column('lesson_versions', 'unpublish_at')
    if 'publish_at' in lv_cols:
        op.drop_column('lesson_versions', 'publish_at')

    # Revert sources
    source_cols = [c['name'] for c in inspector.get_columns('sources')]
    if 'version' in source_cols:
        op.drop_column('sources', 'version')
    if 'effective_date' in source_cols:
        op.drop_column('sources', 'effective_date')
    if 'jurisdiction' in source_cols:
        op.drop_column('sources', 'jurisdiction')

    # Revert concepts
    concept_cols = [c['name'] for c in inspector.get_columns('concepts')]
    if 'effective_to' in concept_cols:
        op.drop_column('concepts', 'effective_to')
    if 'effective_from' in concept_cols:
        op.drop_column('concepts', 'effective_from')
    if 'jurisdiction' in concept_cols:
        op.drop_column('concepts', 'jurisdiction')
