from __future__ import annotations

from pathlib import Path

from src.connectors.base import BaseConnector
from src.core.enums import DataKind, FormatKind
from src.core.models import AuditIssue, ImportResult, MappingProfile, PreviewResult


class Mt940Connector(BaseConnector):
    def can_handle(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in {".sta", ".mt940"}

    def preview(self, file_path: Path) -> PreviewResult:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()[:20]
        return PreviewResult(
            file_path=str(file_path),
            detected_format=FormatKind.TXT,
            headers=["line"],
            preview_rows=[{"line": line} for line in lines],
            notes=["Parser MT940/STA jest szkieletem architektonicznym na etap po MVP."],
        )

    def load(self, file_path: Path, mapping: MappingProfile | None = None) -> ImportResult:
        issues = [
            AuditIssue(
                level="INFO",
                area="BANK",
                source_file=str(file_path),
                issue_code="MT940_NOT_IMPLEMENTED",
                issue="Parser MT940/STA nie jest jeszcze zaimplementowany produkcyjnie.",
                recommendation="W MVP korzystaj z eksportu banku/kasy do XLSX lub CSV z Optimy.",
                confidence=0.95,
            )
        ]
        return ImportResult(
            file_path=str(file_path),
            data_kind=DataKind.BANK,
            records=[],
            row_count=0,
            issues=issues,
        )
