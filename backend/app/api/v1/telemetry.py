import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_optional_current_user
from app.models.user import User
from app.models.telemetry import TelemetryEvent

router = APIRouter(prefix="/telemetry", tags=["Telemetry Ingestion"])


SENSITIVE_FIELD_NAMES = {
    "password", "token", "access_token", "refresh_token", "secret", "authorization", "api_key"
}


def redact_sensitive_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return payload
    sanitized = {}
    for k, v in payload.items():
        if k.lower() in SENSITIVE_FIELD_NAMES:
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = redact_sensitive_payload(v)
        else:
            sanitized[k] = v
    return sanitized


class TelemetryEventItem(BaseModel):
    client_event_id: Optional[str] = Field(None, max_length=128)
    event_name: str = Field(..., min_length=1, max_length=100)
    event_version: str = Field("1.0", max_length=20)
    schema_version: str = Field("1.0", max_length=20)
    occurred_at: Optional[datetime] = None
    session_id: Optional[Union[uuid.UUID, str]] = None
    session_item_id: Optional[Union[uuid.UUID, str]] = None
    concept_id: Optional[Union[uuid.UUID, str]] = None
    properties: Dict[str, Any] = Field(default_factory=dict)


class TelemetryBatchRequest(BaseModel):
    events: List[TelemetryEventItem]


class TelemetryIngestResponse(BaseModel):
    accepted: int
    deduplicated: int
    failed: int


@router.post(
    "/events",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=TelemetryIngestResponse,
    summary="Ingest observation telemetry events with idempotent deduplication",
)
async def ingest_telemetry_events(
    payload: Union[TelemetryBatchRequest, TelemetryEventItem, List[TelemetryEventItem]],
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Normalize input to list of TelemetryEventItem
    if isinstance(payload, TelemetryBatchRequest):
        items = payload.events
    elif isinstance(payload, list):
        items = payload
    else:
        items = [payload]

    # Bound batch size
    items = items[:100]

    accepted_count = 0
    dedup_count = 0
    server_resolved_user_id = current_user.id if current_user else None

    for item in items:
        # Check deduplication if client_event_id provided
        if item.client_event_id:
            conditions = [TelemetryEvent.client_event_id == item.client_event_id]
            if server_resolved_user_id:
                conditions.append(TelemetryEvent.user_id == server_resolved_user_id)
            stmt = select(TelemetryEvent.id).where(*conditions)
            res = await db.execute(stmt)
            if res.scalar_one_or_none():
                dedup_count += 1
                continue

        event_time = item.occurred_at or datetime.now(timezone.utc)
        
        # Safely parse UUID fields if valid UUID, else store None
        parsed_sess_id = None
        if item.session_id:
            try:
                parsed_sess_id = item.session_id if isinstance(item.session_id, uuid.UUID) else uuid.UUID(str(item.session_id))
            except (ValueError, TypeError):
                parsed_sess_id = None

        parsed_item_id = None
        if item.session_item_id:
            try:
                parsed_item_id = item.session_item_id if isinstance(item.session_item_id, uuid.UUID) else uuid.UUID(str(item.session_item_id))
            except (ValueError, TypeError):
                parsed_item_id = None

        parsed_concept_id = None
        if item.concept_id:
            try:
                parsed_concept_id = item.concept_id if isinstance(item.concept_id, uuid.UUID) else uuid.UUID(str(item.concept_id))
            except (ValueError, TypeError):
                parsed_concept_id = None

        payload_dict = redact_sensitive_payload(item.properties)
        if item.session_id and not parsed_sess_id:
            payload_dict["raw_session_id"] = str(item.session_id)

        record = TelemetryEvent(
            id=uuid.uuid4(),
            client_event_id=item.client_event_id,
            event_name=item.event_name,
            event_version=item.event_version,
            schema_version=item.schema_version,
            occurred_at=event_time,
            user_id=server_resolved_user_id,
            session_id=parsed_sess_id,
            session_item_id=parsed_item_id,
            concept_id=parsed_concept_id,
            payload=payload_dict,
        )
        db.add(record)
        accepted_count += 1

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # In case of concurrent insert race on unique (user_id, client_event_id), treat as deduplicated
        dedup_count += accepted_count
        accepted_count = 0

    return TelemetryIngestResponse(
        accepted=accepted_count,
        deduplicated=dedup_count,
        failed=0,
    )
