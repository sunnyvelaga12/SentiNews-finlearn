"""Add unique constraint uq_user_lesson_progress to user_progress

Revision ID: 015_user_prog_uniq
Revises: 014_restore_prototype_tables
Create Date: 2026-09-03
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic (must be <= 32 chars).
revision: str = '015_user_prog_uniq'
down_revision: Union[str, None] = '014_restore_prototype_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    constraints = [c['name'] for c in inspector.get_unique_constraints('user_progress')]
    
    if 'uq_user_lesson_progress' not in constraints:
        op.create_unique_constraint('uq_user_lesson_progress', 'user_progress', ['user_id', 'lesson_id'])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    constraints = [c['name'] for c in inspector.get_unique_constraints('user_progress')]

    if 'uq_user_lesson_progress' in constraints:
        op.drop_constraint('uq_user_lesson_progress', 'user_progress', type_='unique')
