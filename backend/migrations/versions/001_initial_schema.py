"""initial schema and triggers

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-08-17 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Users & Profiles
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('role', sa.String(50), nullable=False, server_default='LEARNER'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    op.create_table(
        'user_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('display_name', sa.String(100), nullable=True),
        sa.Column('avatar_url', sa.String(512), nullable=True),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='UTC'),
        sa.Column('streak_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_active_at', sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        'revoked_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('hashed_refresh_token', sa.String(64), nullable=False, index=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 2. Concepts & Relationships
    op.create_table(
        'concepts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('slug', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),

        sa.Column('learning_objective', sa.Text(), nullable=True),
        sa.Column('domain', sa.String(50), nullable=False),
        sa.Column('module_id', postgresql.UUID(as_uuid=True), nullable=True),


        sa.Column('level', sa.String(20), nullable=False, server_default='BEGINNER'),
        sa.Column('tags', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('status', sa.String(20), nullable=False, server_default='PUBLISHED'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )


    op.create_table(
        'concept_relationships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('source_concept_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('concepts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_concept_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('concepts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('relationship_type', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 3. Sources & Lesson Sources
    op.create_table(
        'sources',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('publisher', sa.String(255), nullable=False),
        sa.Column('url', sa.String(512), nullable=True),
        sa.Column('source_type', sa.String(50), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('accessed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('citation_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 4. Lessons & Versions
    op.create_table(
        'lessons',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('slug', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('domain', sa.String(50), nullable=False),
        sa.Column('level', sa.String(20), nullable=False, server_default='BEGINNER'),
        sa.Column('current_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    op.create_table(
        'lesson_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('title', sa.String(150), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('learning_objectives', postgresql.JSONB(), nullable=False),
        sa.Column('concept_ids', postgresql.JSONB(), nullable=False),
        sa.Column('prerequisite_ids', postgresql.JSONB(), nullable=False),
        sa.Column('blocks_json', postgresql.JSONB(), nullable=False),
        sa.Column('questions_json', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT', index=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    op.create_table(
        'lesson_sources',
        sa.Column('lesson_version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lesson_versions.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('source_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sources.id', ondelete='CASCADE'), primary_key=True)
    )

    # 5. Progress, Mastery, Reviews & Review Attempts
    op.create_table(
        'user_progress',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('lesson_version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lesson_versions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    op.create_table(
        'concept_mastery',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('concept_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('concepts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('mastery_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('confidence_level', sa.Float(), nullable=False, server_default='0.5'),
        sa.Column('evidence_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('algorithm_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('last_evaluated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    op.create_table(
        'review_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('concept_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('concepts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('review_stage', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('last_reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_review_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('correct_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('incorrect_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='SCHEDULED'),
        sa.Column('scheduler_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    # Create Partial Unique Index for Review Items
    op.create_index(
        'uq_active_user_concept_review',
        'review_items',
        ['user_id', 'concept_id'],
        unique=True,
        postgresql_where=sa.text("status IN ('SCHEDULED', 'DUE', 'OVERDUE')")
    )

    op.create_table(
        'review_attempts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('review_item_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('review_items.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('concept_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('concepts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('lesson_version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lesson_versions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('scheduler_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_correct', sa.Boolean(), nullable=False),
        sa.Column('confidence_rating', sa.Integer(), nullable=False),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('idempotency_key', sa.String(128), nullable=True),
        sa.Column('attempted_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 6. Idempotency Records & Outbox Events
    op.create_table(
        'idempotency_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('idempotency_key', sa.String(128), nullable=False),
        sa.Column('endpoint', sa.String(255), nullable=False),
        sa.Column('request_hash', sa.String(64), nullable=False),
        sa.Column('response_status', sa.Integer(), nullable=True),
        sa.Column('response_body', postgresql.JSONB(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='IN_PROGRESS'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False)
    )
    op.create_index(
        'uq_user_idempotency_key_endpoint',
        'idempotency_records',
        ['user_id', 'idempotency_key', 'endpoint'],
        unique=True
    )

    op.create_table(
        'outbox_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('aggregate_type', sa.String(100), nullable=False),
        sa.Column('aggregate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('attempt_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('locked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('locked_by', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True)
    )

    # 7. Content Reviews & Audit Logs
    op.create_table(
        'content_reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('lesson_version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lesson_versions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reviewer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('review_role', sa.String(50), nullable=False),
        sa.Column('status', sa.String(30), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('request_id', sa.String(64), nullable=True, index=True),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(100), nullable=False),
        sa.Column('resource_id', sa.String(100), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('previous_state', postgresql.JSONB(), nullable=True),
        sa.Column('new_state', postgresql.JSONB(), nullable=True),
        sa.Column('ip_hash', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    op.create_table(
        'analytics_events',
        sa.Column('event_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('event_name', sa.String(100), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('session_id', sa.String(100), nullable=True),
        sa.Column('entity_id', sa.String(100), nullable=True),
        sa.Column('properties', postgresql.JSONB(), nullable=False),
        sa.Column('schema_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False)
    )

    # 8. Create Published Lesson Version Immutability Trigger in PostgreSQL
    op.execute("""
        CREATE OR REPLACE FUNCTION enforce_lesson_version_immutability()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                IF OLD.status = 'PUBLISHED' THEN
                    RAISE EXCEPTION 'Published lesson versions are strictly immutable and cannot be deleted.';
                END IF;
                RETURN OLD;
            END IF;

            IF TG_OP = 'UPDATE' THEN
                IF OLD.status = 'PUBLISHED' THEN
                    RAISE EXCEPTION 'Published lesson versions are strictly immutable and cannot be updated.';
                END IF;
                RETURN NEW;
            END IF;

            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_lesson_version_immutability
        BEFORE UPDATE OR DELETE ON lesson_versions
        FOR EACH ROW EXECUTE FUNCTION enforce_lesson_version_immutability();
    """)

def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_lesson_version_immutability ON lesson_versions;")
    op.execute("DROP FUNCTION IF EXISTS enforce_lesson_version_immutability();")
    op.drop_table('analytics_events')
    op.drop_table('audit_logs')
    op.drop_table('content_reviews')
    op.drop_table('outbox_events')
    op.drop_table('idempotency_records')
    op.drop_table('review_attempts')
    op.drop_table('review_items')
    op.drop_table('concept_mastery')
    op.drop_table('user_progress')
    op.drop_table('lesson_sources')
    op.drop_table('lesson_versions')
    op.drop_table('lessons')
    op.drop_table('sources')
    op.drop_table('concept_relationships')
    op.drop_table('concepts')
    op.drop_table('revoked_sessions')
    op.drop_table('user_profiles')
    op.drop_table('users')
