from __future__ import annotations

from typing import Sequence

from src.core.models import AuditIssue, SchemaDraft
from src.schema_generator.schema_validator import SchemaValidator


class SchemaAudit:
    def __init__(self) -> None:
        self.validator = SchemaValidator()

    def run(self, drafts: Sequence[SchemaDraft]) -> list[AuditIssue]:
        issues: list[AuditIssue] = []
        for draft in drafts:
            issues.extend(self.validator.validate(draft))
        return issues

