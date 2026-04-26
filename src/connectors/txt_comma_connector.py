from __future__ import annotations

from pathlib import Path

from src.connectors.base import BaseConnector
from src.core.enums import DataKind, FormatKind
from src.core.models import AuditIssue, ImportResult, MappingProfile, PreviewResult


class TxtCommaConnector(BaseConnector):
    def can_handle(self, file_path: Path) -> bool:
        return file_path.suffix.lower() == ".txt"

    def preview(self, file_path: Path) -> PreviewResult:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()[:20]
        return PreviewResult(
            file_path=str(file_path),
            detected_format=FormatKind.TXT,
            headers=["line"],
            preview_rows=[{"line": line} for line in lines],
            notes=["Format legacy. ObsÅuga eksperymentalna w MVP."],
        )

    def load(self, file_path: Path, mapping: MappingProfile | None = None) -> ImportResult:
        issues = [
            AuditIssue(
                level="INFO",
                area="IMPORT",
                source_file=str(file_path),
                issue_code="LEGACY_FORMAT",
                issue="Format TXT/COMMA jest przygotowany architektonicznie, ale parser nie jest jeszcze kompletny.",
                recommendation="UÅ¼yj eksportu XLSX/CSV albo rozbuduj parser legacy na podstawie prÃ³bki pliku.",
                confidence=0.95,
            )
        ]
        return ImportResult(
            file_path=str(file_path),
            data_kind=DataKind.UNKNOWN,
            records=[],
            row_count=0,
            issues=issues,
        )

