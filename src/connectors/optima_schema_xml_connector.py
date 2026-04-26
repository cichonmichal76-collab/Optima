from __future__ import annotations

from pathlib import Path
from typing import Any

from src.connectors.base import BaseConnector
from src.core.enums import DataKind, FormatKind
from src.core.models import AuditIssue, ImportResult, MappingProfile, PreviewResult

try:
    from lxml import etree
except ImportError:  # pragma: no cover
    from xml.etree import ElementTree as etree  # type: ignore[assignment]


class OptimaSchemaXmlConnector(BaseConnector):
    def can_handle(self, file_path: Path) -> bool:
        return file_path.suffix.lower() == ".xml"

    def preview(self, file_path: Path) -> PreviewResult:
        tree = etree.parse(str(file_path))
        root = tree.getroot()
        preview_rows = [{"tag": self._local_name(child.tag)} for child in list(root)[:20]]
        return PreviewResult(
            file_path=str(file_path),
            detected_format=FormatKind.XML,
            headers=["tag"],
            preview_rows=preview_rows,
            notes=["Techniczny podgląd XML schematu księgowego."],
            xml_root=self._local_name(root.tag),
        )

    def load(self, file_path: Path, mapping: MappingProfile | None = None) -> ImportResult:
        tree = etree.parse(str(file_path))
        root = tree.getroot()
        tags = [self._local_name(element.tag) for element in root.iter()]
        issues: list[AuditIssue] = []
        if not any("pozyc" in tag.lower() for tag in tags):
            issues.append(
                AuditIssue(
                    level="WARNING",
                    area="SCHEMA_XML",
                    source_file=str(file_path),
                    issue_code="SCHEMA_POSITIONS_MISSING",
                    issue="Nie znaleziono elementÃ³w pozycji schematu.",
                    recommendation="Zweryfikuj, czy eksportowany XML pochodzi ze schematu ksiÄgowego Optimy.",
                    confidence=0.8,
                )
            )
        if not any("konto" in tag.lower() for tag in tags):
            issues.append(
                AuditIssue(
                    level="WARNING",
                    area="SCHEMA_XML",
                    source_file=str(file_path),
                    issue_code="SCHEMA_ACCOUNT_MISSING",
                    issue="Nie znaleziono definicji kont w XML.",
                    recommendation="Zweryfikuj struktur? XML i uzupe?nij walidacj? na bazie eksportu wzorcowego.",
                    confidence=0.75,
                )
            )
        records = [{"tag": self._local_name(element.tag), "text": (element.text or "").strip()} for element in root.iter()]
        return ImportResult(
            file_path=str(file_path),
            data_kind=DataKind.OPTIMA_SCHEMA_XML,
            records=records,
            row_count=len(records),
            issues=issues,
        )

    @staticmethod
    def _local_name(tag: str) -> str:
        return tag.split("}", 1)[-1]

