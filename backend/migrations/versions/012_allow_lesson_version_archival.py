"""Allow status transition to ARCHIVED for published lesson versions

Revision ID: 012_version_archival
Revises: 011_session_lesson_version
Create Date: 2026-09-02
"""
from typing import Sequence, Union
from alembic import op

revision: str = '012_version_archival'
down_revision: Union[str, None] = '011_session_lesson_version'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION enforce_lesson_version_immutability()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                IF OLD.status IN ('PUBLISHED', 'ARCHIVED') THEN
                    RAISE EXCEPTION 'Published or archived lesson versions are strictly immutable and cannot be deleted.';
                END IF;
                RETURN OLD;
            END IF;

            IF TG_OP = 'UPDATE' THEN
                IF OLD.status = 'PUBLISHED' THEN
                    IF NEW.status = 'ARCHIVED' THEN
                        RETURN NEW;
                    ELSE
                        RAISE EXCEPTION 'Published lesson versions are strictly immutable and cannot be updated.';
                    END IF;
                END IF;

                IF OLD.status = 'ARCHIVED' THEN
                    RAISE EXCEPTION 'Archived lesson versions are strictly immutable and cannot be updated.';
                END IF;

                RETURN NEW;
            END IF;

            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
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
