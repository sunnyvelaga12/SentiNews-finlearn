"""Add lesson_version_id to learning_sessions

Revision ID: 011_add_lesson_version_to_sessions
Revises: 010_content_system_foundation
Create Date: 2026-09-02
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = '011_session_lesson_version'
down_revision: Union[str, None] = '010_content_system_foundation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('learning_sessions')]
    if 'lesson_version_id' not in cols:
        op.add_column(
            'learning_sessions',
            sa.Column('lesson_version_id', UUID(as_uuid=True), sa.ForeignKey('lesson_versions.id', ondelete='RESTRICT'), nullable=True)
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('learning_sessions')]
    if 'lesson_version_id' in cols:
        op.drop_column('learning_sessions', 'lesson_version_id')
