"""phase2a schema update and learning engine tables creation

Revision ID: 002_phase2a_schema
Revises: 001_initial_schema
Create Date: 2026-08-18 21:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '002_phase2a_schema'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Learning Objectives
    op.create_table(
        'learning_objectives',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('slug', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('concept_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('concepts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('taxonomy_level', sa.String(50), nullable=False, server_default='UNDERSTAND'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 2. Learning Activities
    op.create_table(
        'learning_activities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('objective_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('learning_objectives.id', ondelete='CASCADE'), nullable=False),
        sa.Column('activity_type', sa.String(50), nullable=False),
        sa.Column('learning_phase', sa.String(50), nullable=False, server_default='RETRIEVE'),
        sa.Column('interaction_type', sa.String(50), nullable=False, server_default='MCQ'),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 3. Learning Sessions
    op.create_table(
        'learning_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('policy', sa.String(50), nullable=False, server_default='DEFAULT'),
        sa.Column('status', sa.String(20), nullable=False, server_default='ACTIVE'),
        sa.Column('estimated_minutes', sa.Integer(), nullable=False, server_default='4'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True)
    )

    # 4. Learning Session Items
    op.create_table(
        'learning_session_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('learning_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('activity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('learning_activities.id', ondelete='CASCADE'), nullable=False),
        sa.Column('concept_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('concepts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('objective_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('learning_objectives.id', ondelete='CASCADE'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('selection_reason', sa.String(100), nullable=False, server_default='NEXT_CONCEPT'),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('payload_snapshot', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('evaluation_spec_snapshot', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('learning_phase', sa.String(50), nullable=False, server_default='RETRIEVE'),
        sa.Column('interaction_type', sa.String(50), nullable=False, server_default='MCQ'),
        sa.Column('activity_schema_version', sa.Integer(), nullable=False, server_default='1')
    )

    # 5. Learning Attempts
    op.create_table(
        'learning_attempts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('learning_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('learning_session_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('activity_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('learning_activities.id', ondelete='CASCADE'), nullable=False),
        sa.Column('concept_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('concepts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('objective_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('learning_objectives.id', ondelete='CASCADE'), nullable=False),
        sa.Column('response_json', postgresql.JSONB(), nullable=False),
        sa.Column('evaluation_status', sa.String(20), nullable=False, server_default='EVALUATED'),
        sa.Column('is_correct', sa.Boolean(), nullable=False),
        sa.Column('score', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('confidence_rating', sa.Integer(), nullable=True),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('idempotency_key', sa.String(128), nullable=True, index=True),
        sa.Column('request_fingerprint', sa.String(64), nullable=True),
        sa.Column('attempt_result_snapshot', postgresql.JSONB(), nullable=True),
        sa.Column('attempted_at', sa.DateTime(timezone=True), nullable=False)
    )
    op.create_unique_constraint('uq_user_idempotency_key', 'learning_attempts', ['user_id', 'idempotency_key'])

    # 6. Learner State
    op.create_table(
        'learner_state',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('current_domain_id', sa.String(50), nullable=True),
        sa.Column('current_concept_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('concepts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('xp_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('current_streak', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('longest_streak', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('daily_goal_minutes', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('last_learning_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 7. concept_mastery updates
    op.add_column('concept_mastery', sa.Column('correct_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('concept_mastery', sa.Column('incorrect_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('concept_mastery', sa.Column('attempt_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('concept_mastery', sa.Column('error_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('concept_mastery', sa.Column('lapse_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('concept_mastery', sa.Column('active_recall_successes', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('concept_mastery', sa.Column('delayed_recall_successes', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('concept_mastery', sa.Column('unique_objective_successes', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('concept_mastery', sa.Column('unique_activity_successes', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('concept_mastery', sa.Column('first_exposed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('concept_mastery', sa.Column('last_attempted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('concept_mastery', sa.Column('last_correct_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('concept_mastery', sa.Column('last_active_recall_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('concept_mastery', sa.Column('last_delayed_recall_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('concept_mastery', sa.Column('calculated_at', sa.DateTime(timezone=True), nullable=True))
    op.alter_column('concept_mastery', 'algorithm_version', new_column_name='mastery_algorithm_version', existing_type=sa.Integer(), server_default='1', nullable=False)
    op.create_unique_constraint('uq_mastery_user_concept', 'concept_mastery', ['user_id', 'concept_id'])

    # 8. review_items updates
    op.drop_index('uq_active_user_concept_review', table_name='review_items')
    op.drop_column('review_items', 'status')
    op.add_column('review_items', sa.Column('stability_days', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('review_items', sa.Column('lapses', sa.Integer(), nullable=False, server_default='0'))
    op.create_index('uq_user_concept_review', 'review_items', ['user_id', 'concept_id'], unique=True)


def downgrade() -> None:
    op.drop_index('uq_user_concept_review', table_name='review_items')
    op.drop_column('review_items', 'lapses')
    op.drop_column('review_items', 'stability_days')
    op.add_column('review_items', sa.Column('status', sa.String(20), nullable=False, server_default='SCHEDULED'))
    op.create_index('uq_active_user_concept_review', 'review_items', ['user_id', 'concept_id'], unique=True, postgresql_where=sa.text("status IN ('SCHEDULED', 'DUE', 'OVERDUE')"))

    op.drop_constraint('uq_mastery_user_concept', 'concept_mastery', type_='unique')
    op.alter_column('concept_mastery', 'mastery_algorithm_version', new_column_name='algorithm_version', existing_type=sa.Integer(), server_default='1', nullable=False)
    op.drop_column('concept_mastery', 'calculated_at')
    op.drop_column('concept_mastery', 'last_delayed_recall_at')
    op.drop_column('concept_mastery', 'last_active_recall_at')
    op.drop_column('concept_mastery', 'last_correct_at')
    op.drop_column('concept_mastery', 'last_attempted_at')
    op.drop_column('concept_mastery', 'first_exposed_at')
    op.drop_column('concept_mastery', 'unique_activity_successes')
    op.drop_column('concept_mastery', 'unique_objective_successes')
    op.drop_column('concept_mastery', 'delayed_recall_successes')
    op.drop_column('concept_mastery', 'active_recall_successes')
    op.drop_column('concept_mastery', 'lapse_count')
    op.drop_column('concept_mastery', 'error_count')
    op.drop_column('concept_mastery', 'attempt_count')
    op.drop_column('concept_mastery', 'incorrect_count')
    op.drop_column('concept_mastery', 'correct_count')

    op.drop_table('learner_state')
    op.drop_table('learning_attempts')
    op.drop_table('learning_session_items')
    op.drop_table('learning_sessions')
    op.drop_table('learning_activities')
    op.drop_table('learning_objectives')
