import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class IdempotencyRecord(Base):
    """
    Transactional idempotency coordination record.

    Architecture Contract v3 — Key properties:
    - Scoped by (user_id, operation_type, idempotency_key) — A12
    - DB unique constraint is the sole idempotency authority — A14
    - PROCESSING rows vanish on ROLLBACK (no lease recovery needed)
    - SUCCESS records MUST have non-null response_snapshot — A13
    - Status: PROCESSING → SUCCESS (terminal). No FAILED state.
    """
    __tablename__ = "idempotency_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    operation_type = Column(String(50), nullable=False)  # SUBMIT_ATTEMPT, CREATE_SESSION, etc.
    idempotency_key = Column(String(128), nullable=False)
    request_fingerprint = Column(String(64), nullable=False)
    status = Column(String(20), default="PROCESSING", nullable=False)  # PROCESSING | SUCCESS
    attempt_id = Column(UUID(as_uuid=True), ForeignKey("learning_attempts.id", ondelete="SET NULL"), nullable=True)
    response_snapshot = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "user_id", "operation_type", "idempotency_key",
            name="uq_user_operation_idempotency",
        ),
    )
