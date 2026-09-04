import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class MediaAsset(Base):
    """
    First-class Media Asset registry for SentiNews Learn Content Studio.
    Abstracts physical storage key and provider from content authoring references.
    """
    __tablename__ = "media_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False)
    storage_provider = Column(String(50), default="LOCAL", nullable=False)  # LOCAL, S3, GCS
    storage_key = Column(String(512), nullable=False)
    url = Column(String(512), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    alt_text = Column(String(255), nullable=True)
    caption = Column(Text, nullable=True)
    credit = Column(String(255), nullable=True)
    source = Column(String(255), nullable=True)
    checksum = Column(String(64), nullable=False, index=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
