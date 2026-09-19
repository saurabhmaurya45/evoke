"""Single import point so every ORM model is registered on `Base.metadata` before
Alembic autogenerate or `Base.metadata.create_all` runs. Add new model modules here."""

from app.drafts.models import Draft  # noqa: F401
from app.events.models import Event  # noqa: F401
from app.payments.models import Payment  # noqa: F401
from app.shared.audit import AuditLog  # noqa: F401
from app.templates.models import Category, Currency, Template, TemplateVersion  # noqa: F401
from app.users.models import User  # noqa: F401
