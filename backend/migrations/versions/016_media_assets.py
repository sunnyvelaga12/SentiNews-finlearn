"""Create media_assets table

Revision ID: 016_media_assets
Revises: 015_user_prog_uniq
Create Date: 2026-09-04
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = '016_media_assets'
down_revision: Union[str, None] = '015_user_prog_uniq'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'media_assets' not in tables:
        op.create_table(
            'media_assets',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('filename', sa.String(255), nullable=False),
            sa.Column('storage_provider', sa.String(50), server_default='LOCAL', nullable=False),
            sa.Column('storage_key', sa.String(512), nullable=False),
            sa.Column('url', sa.String(512), nullable=False),
            sa.Column('mime_type', sa.String(100), nullable=False),
            sa.Column('file_size_bytes', sa.Integer(), nullable=False),
            sa.Column('width', sa.Integer(), nullable=True),
            sa.Column('height', sa.Integer(), nullable=True),
            sa.Column('alt_text', sa.String(255), nullable=True),
            sa.Column('caption', sa.Text(), nullable=True),
            sa.Column('credit', sa.String(255), nullable=True),
            sa.Column('source', sa.String(255), nullable=True),
            sa.Column('checksum', sa.String(64), nullable=False),
            sa.Column('uploaded_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index('ix_media_assets_checksum', 'media_assets', ['checksum'])


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'media_assets' in tables:
        op.drop_index('ix_media_assets_checksum', table_name='media_assets')
        op.drop_table('media_assets')
