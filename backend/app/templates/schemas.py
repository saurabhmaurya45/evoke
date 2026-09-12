import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.shared.schema import CamelModel
from app.templates.models import TemplateStatus, TemplateVersionStatus


class TemplateCreate(CamelModel):
    """ADMIN-only body — enforced by the router dependency, not here."""

    slug: str
    name: str
    category: str | None = None


class TemplateUpdate(CamelModel):
    """ADMIN-only partial update. Only provided fields are applied."""

    name: str | None = None
    category: str | None = None
    status: TemplateStatus | None = None


class TemplateOut(CamelModel):
    id: uuid.UUID
    slug: str
    name: str
    category: str | None
    status: TemplateStatus
    created_at: datetime
    updated_at: datetime


class TemplateVersionCreate(CamelModel):
    """ADMIN-only body. The caller supplies these explicitly — the backend does not
    guess schema/protocol versions or the default config."""

    schema_version: int
    protocol_version: int
    # Renamed from `schema` on the Python side only — that name shadows a deprecated
    # BaseModel.schema() classmethod. The JSON field stays "schema" via the alias.
    template_schema: dict[str, Any] = Field(alias="schema")
    default_config: dict[str, Any] | None = None


class TemplateVersionOut(CamelModel):
    id: uuid.UUID
    template_id: uuid.UUID
    version: int
    schema_version: int
    protocol_version: int
    template_schema: dict[str, Any] = Field(alias="schema")
    default_config: dict[str, Any] | None
    status: TemplateVersionStatus
    created_at: datetime
