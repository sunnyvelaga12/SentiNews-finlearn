"""Add current_position to learning_sessions

Revision ID: 017_session_current_position
Revises: 016_media_assets
Create Date: 2026-09-04
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '017_session_current_position'
down_revision: Union[str, None] = '016_media_assets'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('learning_sessions')]
    if 'current_position' not in cols:
        op.add_column('learning_sessions', sa.Column('current_position', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('learning_sessions')]
    if 'current_position' in cols:
        op.drop_column('learning_sessions', 'current_position')
