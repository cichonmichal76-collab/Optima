from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from typing import Any

from src.connectors.base import BaseConnector
from src.core.enums import DataKind, FormatKind
from src.core.models import ImportResult, MappingProfile, PreviewResult, VatRecord
from src.core.normalizers import normalize_decimal, normalize_text

try:
    from lxml import etree
except ImportError:  # pragma: no cover
    from xml.etree import ElementTree as etree  # type: ignore[assignment]


class JpkXmlConnector(BaseConnector):
    def can_handle(self, file_path: Path) -> bool:
        return file_path.suffix.lower() == ".xml"

    def preview(self, file_path: Path) -> PreviewResult:
        tree = etree.parse(str(file_path))
        root = tree.getroot()
        rows = self._extract_rows(root)
        headers = list(rows[0].keys()) if rows else []
        namespaces = self._extract_namespaces(root)
        return PreviewResult(
            file_path=str(file_path),
            detected_format=FormatKind.XML,
            headers=headers,
            preview_rows=rows[:20],
            notes=["Minimalny podgląd JPK/XML z obsługą namespace."],
            xml_root=self._local_name(root.tag),
            namespaces=namespaces,
        )

    def load(self, file_path: Path, mapping: MappingProfile | None = None) -> ImportResult:
        tree = etree.parse(str(file_path))
        root = tree.getroot()
        rows = self._extract_rows(root)
        records = [self._to_vat_record(row) for row in rows]
        return ImportResult(
            file_path=str(file_path),
            data_kind=DataKind.JPK_XML,
            records=records,
            row_count=len(records),
            mapping_used={},
        )

    def _extract_rows(self, root: Any) -> list[dict[str, str]]:
        rows: list[dict[str, str]] = []
        for element in root.iter():
            local_name = self._local_name(element.tag)
            if local_name not in {"SprzedazWiersz", "ZakupWiersz"}:
                continue
            row: dict[str, str] = {}
            for child in list(element):
                row[self._local_name(child.tag)] = normalize_text(child.text) or ""
            row["_record_type"] = local_name
            rows.append(row)
        if rows:
            return rows

        for element in list(root)[:20]:
            row = {self._local_name(child.tag): normalize_text(child.text) or "" for child in list(element)}
            if row:
                rows.append(row)
        return rows

    def _to_vat_record(self, row: dict[str, str]) -> VatRecord:
        document_number = row.get("DowodSprzedazy") or row.get("DowodZakupu") or row.get("NrFa") or "BRAK_NUMERU"
        contractor_name = row.get("NazwaKontrahenta") or row.get("NazwaDostawcy")
        contractor_nip = row.get("NrKontrahenta") or row.get("NrDostawcy")
        vat_value = normalize_decimal(row.get("PodatekNaliczony"), Decimal("0")) or Decimal("0")
        net_value = normalize_decimal(row.get("Netto"), Decimal("0")) or Decimal("0")
        gross_value = normalize_decimal(row.get("Brutto"))
        if gross_value is None:
            gross_value = net_value + vat_value
        return VatRecord(
            source_type="JPK_V7",
            document_number=document_number,
            contractor_name=contractor_name,
            contractor_nip=contractor_nip,
            net=net_value,
            vat=vat_value,
            gross=gross_value,
            raw=row,
        )

    @staticmethod
    def _local_name(tag: str) -> str:
        return tag.split("}", 1)[-1]

    @staticmethod
    def _extract_namespaces(root: Any) -> dict[str, str]:
        if hasattr(root, "nsmap") and root.nsmap:
            return {key or "default": value for key, value in root.nsmap.items() if value}
        return {}
