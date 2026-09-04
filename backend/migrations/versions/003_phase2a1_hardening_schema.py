"""Phase 2A.1 Hardening Schema Updates

Revision ID: 003_phase2a1_hardening_schema
Revises: 002_phase2a_schema
Create Date: 2026-08-18 22:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = '003_phase2a1_hardening_schema'
down_revision: Union[str, None] = '002_phase2a_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add JSON metadata columns to learning_attempts if they do not already exist
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_cols = [c['name'] for c in inspector.get_columns('learning_attempts')]

    if 'evaluation_json' not in existing_cols:
        op.add_column('learning_attempts', sa.Column('evaluation_json', JSONB(), nullable=True))
    if 'context_json' not in existing_cols:
        op.add_column('learning_attempts', sa.Column('context_json', JSONB(), nullable=True))
    if 'evidence_json' not in existing_cols:
        op.add_column('learning_attempts', sa.Column('evidence_json', JSONB(), nullable=True))
    if 'versions_json' not in existing_cols:
        op.add_column('learning_attempts', sa.Column('versions_json', JSONB(), nullable=True))

    existing_constraints = [c['name'] for c in inspector.get_unique_constraints('learning_attempts')]
    if 'uq_user_idempotency_key' not in existing_constraints:
        op.create_unique_constraint('uq_user_idempotency_key', 'learning_attempts', ['user_id', 'idempotency_key'])


def downgrade() -> None:
    op.drop_column('learning_attempts', 'versions_json')
    op.drop_column('learning_attempts', 'evidence_json')
    op.drop_column('learning_attempts', 'context_json')
    op.drop_column('learning_attempts', 'evaluation_json')
