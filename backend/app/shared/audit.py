import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class AuditLog(Base):
    """Append-only audit trail. Never update or delete rows; only insert."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


async def log_action(
    db: AsyncSession,
    *,
    action: str,
    resource_type: str,
    resource_id: uuid.UUID | None = None,
    actor_user_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Record an audit entry on the current session without committing.

    The caller's own transaction commit persists this alongside the business change it
    describes, so an audit entry never exists for a change that didn't happen (or vice versa).
    """
    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata_=metadata,
        )
    )
