"""Add module metadata fields: learner_goal, why_this_matters, learning_outcomes

Revision ID: 018_module_metadata_fields
Revises: 017_add_session_current_position
Create Date: 2026-09-04

Rationale:
  Prior to this migration, `learner_goal`, `why_this_matters`, and `learning_outcomes`
  were hardcoded Python strings in curriculum.py that branched on module slug substrings
  (e.g. `"market" in mod.slug.lower()`). This violated the core LCMS principle that
  curriculum content must be DATA, not application code.

  After this migration, every Module row carries its own canonical metadata, and the
  hardcoded Python branches are permanently removed. New curriculum domains (Financial
  Statements, Valuation, Portfolio Management, Options, Macroeconomics, etc.) require
  zero application code changes.

  Schema decisions:
  - learner_goal: scalar TEXT — a single authoritative sentence. Not JSON; has no
    internal structure, no ordering requirement, and no reuse across modules.
  - why_this_matters: scalar TEXT — same rationale.
  - learning_outcomes: JSONB (array of strings) — ordered list, variable length, and
    potentially parseable for future analytics or prerequisite mapping. Stored as JSON
    rather than a normalized related-entity table because outcomes belong exclusively
    to one module, have no independent identity, are not shared across modules, and do
    not require individual FK references from other tables. If future analytics require
    outcome-level tracking, a `module_learning_outcomes` table can be introduced via a
    new migration without breaking this column.
  - completion_criteria: scalar TEXT — single human-readable sentence.
  - estimated_hours: FLOAT — simple numeric; no normalization needed.
  - level: String(20) — enum-like scalar (BEGINNER/INTERMEDIATE/ADVANCED).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = '018_module_metadata_fields'
down_revision: Union[str, None] = '017_session_current_position'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    module_cols = [c['name'] for c in inspector.get_columns('modules')]

    if 'learner_goal' not in module_cols:
        op.add_column('modules', sa.Column(
            'learner_goal',
            sa.Text(),
            nullable=True,
            comment='Single authoritative sentence describing what the learner will achieve.'
        ))

    if 'why_this_matters' not in module_cols:
        op.add_column('modules', sa.Column(
            'why_this_matters',
            sa.Text(),
            nullable=True,
            comment='Single authoritative sentence explaining the real-world relevance.'
        ))

    if 'learning_outcomes' not in module_cols:
        op.add_column('modules', sa.Column(
            'learning_outcomes',
            JSONB(),
            nullable=True,
            server_default='[]',
            comment='Ordered JSON array of strings listing specific measurable learning outcomes.'
        ))

    if 'completion_criteria' not in module_cols:
        op.add_column('modules', sa.Column(
            'completion_criteria',
            sa.Text(),
            nullable=True,
            comment='Human-readable completion and certification criteria for this module.'
        ))

    if 'estimated_hours' not in module_cols:
        op.add_column('modules', sa.Column(
            'estimated_hours',
            sa.Float(),
            nullable=True,
            server_default='1.5',
            comment='Estimated completion time in hours.'
        ))

    if 'level' not in module_cols:
        op.add_column('modules', sa.Column(
            'level',
            sa.String(20),
            nullable=True,
            server_default='BEGINNER',
            comment='Difficulty level: BEGINNER, INTERMEDIATE, or ADVANCED.'
        ))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    module_cols = [c['name'] for c in inspector.get_columns('modules')]

    for col in ('level', 'estimated_hours', 'completion_criteria',
                'learning_outcomes', 'why_this_matters', 'learner_goal'):
        if col in module_cols:
            op.drop_column('modules', col)
