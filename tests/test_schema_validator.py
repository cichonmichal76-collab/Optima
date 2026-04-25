from __future__ import annotations

from src.core.models import SchemaDraft, SchemaDraftLine
from src.schema_generator.schema_validator import SchemaValidator


def test_schema_validator_finds_missing_side_account_and_amount():
    validator = SchemaValidator()
    draft = SchemaDraft(
        name="FZ paliwo",
        template_id="FZ_PALIWO_50",
        condition="true",
        lines=[SchemaDraftLine(side="WN", account=None, amount_expression=None)],
    )

    issues = validator.validate(draft)
    codes = {issue.issue_code for issue in issues}

    assert "SCHEMA_SIDE_MISSING" in codes
    assert "SCHEMA_ACCOUNT_MISSING" in codes
    assert "SCHEMA_AMOUNT_MISSING" in codes
    assert "SCHEMA_CONDITION_TOO_BROAD" in codes

