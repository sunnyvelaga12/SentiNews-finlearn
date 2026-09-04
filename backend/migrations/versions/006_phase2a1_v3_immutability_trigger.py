"""phase2a1_v3_immutability_trigger

Revision ID: 006
Revises: 005
Create Date: 2026-08-19

Gate 10A: Immutability Enforcement Trigger on learning_attempts table.
Prohibits UPDATE and DELETE statements on canonical evidence rows at database boundary.
"""
from alembic import op
import sqlalchemy as sa

revision = '006_v3_immutability_trigger'
down_revision = '005_phase2a1_v3_backfill'


branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION enforce_learning_attempts_immutability()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'learning_attempts is an immutable evidence log. UPDATE and DELETE are prohibited.';
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_protect_learning_attempts_immutability ON learning_attempts;")

    op.execute("""
        CREATE TRIGGER trg_protect_learning_attempts_immutability
        BEFORE UPDATE OR DELETE ON learning_attempts
        FOR EACH ROW EXECUTE FUNCTION enforce_learning_attempts_immutability();
    """)



def downgrade() -> None:
    op.execute("""
        DROP TRIGGER IF EXISTS trg_protect_learning_attempts_immutability ON learning_attempts;
        DROP FUNCTION IF EXISTS enforce_learning_attempts_immutability();
    """)
