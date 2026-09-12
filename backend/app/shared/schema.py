from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base for every request/response schema so the API speaks camelCase JSON (per
    the architecture docs' contract) while Python code stays snake_case throughout.

    `populate_by_name=True` means input can be sent as either the alias (camelCase)
    or the field name — FastAPI's default `response_model_by_alias=True` means output
    always uses the camelCase alias.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
