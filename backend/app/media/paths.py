import uuid

from app.media.models import MediaType


def _generated_file_name(original_file_name: str) -> str:
    """Server-generated name — never the client-supplied one verbatim. Avoids path
    traversal, collisions, and leaking a possibly-PII original filename into a path
    that may end up public."""
    has_extension = "." in original_file_name
    suffix = f".{original_file_name.rsplit('.', 1)[1]}" if has_extension else ""
    return f"{uuid.uuid4()}{suffix}"


def base_template_media_path(template_id: uuid.UUID, media_type: MediaType, file_name: str) -> str:
    return f"asset/{template_id}/{media_type.value.lower()}/{_generated_file_name(file_name)}"


def user_template_media_path(
    user_id: uuid.UUID, event_id: uuid.UUID, media_type: MediaType, file_name: str
) -> str:
    name = _generated_file_name(file_name)
    return f"public/{user_id}/{event_id}/{media_type.value.lower()}/{name}"
