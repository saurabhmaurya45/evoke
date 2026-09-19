"""Pure unit tests for app.templates.validation — no DB/Docker required."""

import pytest

from app.shared.errors import ValidationFailedError
from app.templates.validation import validate_instance, validate_schema_definition

SCHEMA = {
    "type": "object",
    "properties": {
        "coupleNames": {"type": "string", "maxLength": 100},
        "guestCount": {"type": "integer", "minimum": 1},
        "website": {"type": "string"},
    },
    "required": ["coupleNames"],
    "additionalProperties": False,
}


def test_validate_schema_definition_accepts_valid_schema():
    validate_schema_definition(SCHEMA)  # does not raise


def test_validate_schema_definition_rejects_malformed_schema():
    with pytest.raises(ValidationFailedError):
        validate_schema_definition({"type": "not-a-real-type"})


def test_validate_instance_accepts_conforming_data():
    validate_instance(SCHEMA, {"coupleNames": "Alex & Sam", "guestCount": 50})  # does not raise


def test_validate_instance_rejects_missing_required_field():
    with pytest.raises(ValidationFailedError) as exc_info:
        validate_instance(SCHEMA, {"guestCount": 50}, field_label="defaults")
    assert "defaults does not conform" in exc_info.value.message


def test_validate_instance_rejects_wrong_type():
    with pytest.raises(ValidationFailedError):
        validate_instance(SCHEMA, {"coupleNames": "Alex & Sam", "guestCount": "fifty"})


def test_validate_instance_rejects_unknown_property():
    with pytest.raises(ValidationFailedError):
        validate_instance(SCHEMA, {"coupleNames": "Alex & Sam", "extra": "nope"})


def test_validate_instance_rejects_script_tag():
    with pytest.raises(ValidationFailedError) as exc_info:
        validate_instance(SCHEMA, {"coupleNames": "<script>alert(1)</script>"})
    assert exc_info.value.details["violations"][0]["path"] == "coupleNames"


def test_validate_instance_rejects_html_markup():
    with pytest.raises(ValidationFailedError):
        validate_instance(SCHEMA, {"coupleNames": "<img src=x onerror=alert(1)>"})


def test_validate_instance_rejects_javascript_uri():
    with pytest.raises(ValidationFailedError):
        validate_instance(SCHEMA, {"coupleNames": "Alex", "website": "javascript:alert(1)"})


def test_validate_instance_rejects_null_byte():
    with pytest.raises(ValidationFailedError):
        validate_instance(SCHEMA, {"coupleNames": "Alex\x00Sam"})


def test_validate_instance_rejects_oversized_string():
    with pytest.raises(ValidationFailedError):
        validate_instance(SCHEMA, {"coupleNames": "a" * 20_001})


def test_validate_instance_rejects_deeply_nested_data():
    nested: dict = {"coupleNames": "Alex"}
    cursor = nested
    for _ in range(25):
        cursor["child"] = {}
        cursor = cursor["child"]
    schema = {"type": "object"}
    with pytest.raises(ValidationFailedError):
        validate_instance(schema, nested)


def test_validate_instance_allows_plain_text_with_ampersand():
    # A bare "&" is not markup and shouldn't be flagged as HTML.
    validate_instance(SCHEMA, {"coupleNames": "Alex & Sam"})  # does not raise


# --- Flat field-name -> JSON-Schema-fragment map, per
# docs/Template-Module-Design-Specification.md section 4.3 ---

WEDDING_SCHEMA = {
    "couple": {
        "type": "object",
        "properties": {
            "name_1": {"type": "string", "minLength": 1, "maxLength": 100, "title": "Partner 1 Name"},
            "name_2": {"type": "string", "minLength": 1, "maxLength": 100, "title": "Partner 2 Name"},
            "nickname": {"type": "string", "maxLength": 100, "title": "Couple Nickname (optional)"},
        },
        "required": ["name_1", "name_2"],
    },
    "date": {"type": "string", "format": "date", "title": "Event Date"},
    "venue": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "maxLength": 200},
            "city": {"type": "string", "maxLength": 100},
            "country": {"type": "string", "maxLength": 100},
        },
    },
    "story": {"type": "string", "maxLength": 5000, "title": "Your Love Story (optional)"},
}

WEDDING_DEFAULTS = {
    "couple": {"name_1": "", "name_2": "", "nickname": ""},
    "date": "2026-12-31",
    "venue": {"name": "Taj Mahal", "city": "Agra", "country": "India"},
    "story": "",
}


def test_flat_map_schema_definition_is_valid():
    validate_schema_definition(WEDDING_SCHEMA)  # does not raise


def test_flat_map_schema_accepts_full_conforming_data():
    validate_instance(
        WEDDING_SCHEMA,
        {
            "couple": {"name_1": "Alex", "name_2": "Sam"},
            "date": "2026-12-31",
            "venue": {"name": "Taj Mahal", "city": "Agra", "country": "India"},
            "story": "We met in college.",
        },
    )  # does not raise


def test_flat_map_schema_rejects_missing_nested_required_field():
    with pytest.raises(ValidationFailedError):
        validate_instance(WEDDING_SCHEMA, {"couple": {"name_1": "Alex"}, "date": "2026-12-31"})


def test_flat_map_schema_rejects_bad_date_format():
    with pytest.raises(ValidationFailedError):
        validate_instance(
            WEDDING_SCHEMA,
            {"couple": {"name_1": "Alex", "name_2": "Sam"}, "date": "not-a-date"},
        )


def test_flat_map_schema_rejects_unknown_top_level_field():
    with pytest.raises(ValidationFailedError):
        validate_instance(
            WEDDING_SCHEMA,
            {"couple": {"name_1": "Alex", "name_2": "Sam"}, "date": "2026-12-31", "hacker": "x"},
        )


def test_flat_map_schema_rejects_script_in_nested_story_field():
    with pytest.raises(ValidationFailedError) as exc_info:
        validate_instance(
            WEDDING_SCHEMA,
            {
                "couple": {"name_1": "Alex", "name_2": "Sam"},
                "date": "2026-12-31",
                "story": "<script>alert(1)</script>",
            },
        )
    assert exc_info.value.details["violations"][0]["path"] == "story"


def test_defaults_with_blank_placeholders_pass_with_partial():
    # The spec's own example defaults leave required nested fields ("name_1",
    # "name_2") as empty placeholders — this is legitimate for a pre-fill
    # template, not a final submission, so partial=True must accept it.
    validate_instance(WEDDING_SCHEMA, WEDDING_DEFAULTS, field_label="defaults", partial=True)


def test_defaults_without_partial_rejects_blank_placeholders():
    # Without partial=True, the same defaults fail: minLength:1 on an empty
    # name_1/name_2 — confirms partial=True is doing real work, not a no-op.
    with pytest.raises(ValidationFailedError):
        validate_instance(WEDDING_SCHEMA, WEDDING_DEFAULTS, field_label="defaults")


def test_defaults_with_partial_still_rejects_wrong_type():
    bad_defaults = {**WEDDING_DEFAULTS, "date": 12345}
    with pytest.raises(ValidationFailedError):
        validate_instance(WEDDING_SCHEMA, bad_defaults, field_label="defaults", partial=True)


def test_defaults_with_partial_still_rejects_script_content():
    bad_defaults = {**WEDDING_DEFAULTS, "story": "<script>alert(1)</script>"}
    with pytest.raises(ValidationFailedError):
        validate_instance(WEDDING_SCHEMA, bad_defaults, field_label="defaults", partial=True)
