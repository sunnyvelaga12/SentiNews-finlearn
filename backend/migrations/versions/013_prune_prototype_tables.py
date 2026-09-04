"""Prune unused prototype tables (pilot_assessments, content_reviews)

Revision ID: 013_prune_prototype_tables
Revises: 012_version_archival
Create Date: 2026-09-03
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '013_prune_prototype_tables'
down_revision: Union[str, None] = '012_version_archival'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Safely drop pilot_assessments
    if 'pilot_assessments' in tables:
        op.drop_table('pilot_assessments')

    # 2. Safely drop pilot_assessment_definitions
    if 'pilot_assessment_definitions' in tables:
        op.drop_table('pilot_assessment_definitions')

    # 3. Safely drop content_reviews
    if 'content_reviews' in tables:
        op.drop_table('content_reviews')

    # 4. Safely drop enum if present
    op.execute("DROP TYPE IF EXISTS assessment_type_enum CASCADE;")


def downgrade() -> None:
    pass
