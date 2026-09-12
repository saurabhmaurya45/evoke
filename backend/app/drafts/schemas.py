import uuid
from datetime import datetime
from typing import Any

from app.shared.schema import CamelModel


class DraftOut(CamelModel):
    event_id: uuid.UUID
    template_id: uuid.UUID | None
    template_version: int | None
    schema_version: int | None
    data: dict[str, Any]
    revision: int
    updated_at: datetime


class DraftUpdate(CamelModel):
    template_id: uuid.UUID | None = None
    template_version: int | None = None
    schema_version: int | None = None
    data: dict[str, Any]
    # The client's last-known revision, for optimistic concurrency.
    revision: int
