from __future__ import annotations

from pathlib import Path

from src.connectors.base import BaseConnector
from src.core.enums import DataKind, FormatKind
from src.core.models import AuditIssue, ImportResult, MappingProfile, PreviewResult

try:
    from lxml import etree
except ImportError:  # pragma: no cover
    from xml.etree import ElementTree as etree  # type: ignore[assignment]


class OptimaDocumentXmlConnector(BaseConnector):
    def can_handle(self, file_path: Path) -> bool:
        return file_path.suffix.lower() == ".xml"

    def preview(self, file_path: Path) -> PreviewResult:
        tree = etree.parse(str(file_path))
        root = tree.getroot()
        return PreviewResult(
            file_path=str(file_path),
            detected_format=FormatKind.XML,
            headers=["tag"],
            preview_rows=[{"tag": child.tag.split("}", 1)[-1]} for child in list(root)[:20]],
            notes=["Podgląd techniczny dokumentu XML Optimy."],
            xml_root=root.tag.split("}", 1)[-1],
        )

    def load(self, file_path: Path, mapping: MappingProfile | None = None) -> ImportResult:
        tree = etree.parse(str(file_path))
        root = tree.getroot()
        records = [{child.tag.split("}", 1)[-1]: (child.text or "").strip()} for child in list(root)]
        issues = [
            AuditIssue(
                level="INFO",
                area="DOCUMENT_XML",
                source_file=str(file_path),
                issue_code="DOCUMENT_XML_PREVIEW_ONLY",
                issue="Parser dokumentów XML w MVP działa w trybie technicznego podglądu.",
                recommendation="Wykorzystaj wynik do audytu i rozszerz parser po zebraniu wzorcowych plików.",
                confidence=0.9,
            )
        ]
        return ImportResult(
            file_path=str(file_path),
            data_kind=DataKind.OPTIMA_DOCUMENT_XML,
            records=records,
            row_count=len(records),
            issues=issues,
        )
