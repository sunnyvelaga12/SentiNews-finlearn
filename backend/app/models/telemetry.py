import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class TelemetryEvent(Base):
    """
    Append-Only Telemetry Event Model (Observation Layer).
    Observes learner interaction patterns without mutating canonical learning truth.
    """
    __tablename__ = "telemetry_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_event_id = Column(String(128), nullable=True, index=True)
    event_name = Column(String(100), nullable=False, index=True)
    event_version = Column(String(20), default="1.0", nullable=False)
    schema_version = Column(String(20), default="1.0", nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    session_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    session_item_id = Column(UUID(as_uuid=True), nullable=True)
    concept_id = Column(UUID(as_uuid=True), nullable=True)
    
    payload = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("ux_telemetry_user_client_event", "user_id", "client_event_id", unique=True),
        Index("ix_telemetry_user_occurred", "user_id", "occurred_at"),
        Index("ix_telemetry_event_occurred", "event_name", "occurred_at"),
    )
