from __future__ import annotations

from typing import Sequence

from src.core.models import AuditIssue, VatRecord


class JpkAudit:
    def run(self, records: Sequence[VatRecord]) -> list[AuditIssue]:
        issues: list[AuditIssue] = []
        if not records:
            issues.append(
                AuditIssue(
                    level="WARNING",
                    area="JPK",
                    issue_code="JPK_EMPTY",
                    issue="Parser JPK nie znalaz? rekord?w do analizy.",
                    recommendation="Zweryfikuj strukturę XML, namespace i typ pliku.",
                    confidence=0.85,
                )
            )
            return issues

        for record in records:
            if not record.document_number:
                issues.append(
                    AuditIssue(
                        level="WARNING",
                        area="JPK",
                        document_number=record.document_number,
                        contractor=record.contractor_name,
                        issue_code="JPK_MISSING_DOCUMENT",
                        issue="Wiersz JPK nie zawiera numeru dokumentu.",
                        recommendation="Sprawd? ?r?d?o XML i mapowanie p?l parsera.",
                        confidence=0.8,
                    )
                )
        return issues

