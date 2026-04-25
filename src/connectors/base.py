from __future__ import annotations

from pathlib import Path
from typing import Protocol

import pandas as pd

from src.core.enums import FormatKind
from src.core.models import DetectedFormat, ImportResult, MappingProfile, PreviewResult

try:
    from lxml import etree
except ImportError:  # pragma: no cover
    from xml.etree import ElementTree as etree  # type: ignore[assignment]


class BaseConnector(Protocol):
    def can_handle(self, file_path: Path) -> bool: ...

    def preview(self, file_path: Path) -> PreviewResult: ...

    def load(self, file_path: Path, mapping: MappingProfile | None = None) -> ImportResult: ...


class FormatDetector:
    @staticmethod
    def detect(file_path: Path) -> DetectedFormat:
        suffix = file_path.suffix.lower()
        if suffix == ".xlsx":
            sheet_names = list(pd.ExcelFile(file_path).sheet_names)
            return DetectedFormat(
                format=FormatKind.XLSX,
                reason="Rozpoznano po rozszerzeniu XLSX.",
                sheet_names=sheet_names,
            )
        if suffix == ".xls":
            sheet_names = list(pd.ExcelFile(file_path).sheet_names)
            return DetectedFormat(
                format=FormatKind.XLS,
                reason="Rozpoznano po rozszerzeniu XLS.",
                sheet_names=sheet_names,
            )
        if suffix == ".csv":
            return DetectedFormat(format=FormatKind.CSV, reason="Rozpoznano po rozszerzeniu CSV.")
        if suffix == ".json":
            return DetectedFormat(format=FormatKind.JSON, reason="Rozpoznano po rozszerzeniu JSON.")
        if suffix == ".txt":
            return DetectedFormat(format=FormatKind.TXT, reason="Rozpoznano po rozszerzeniu TXT.")
        if suffix == ".xml":
            tree = etree.parse(str(file_path))
            root = tree.getroot()
            xml_root = root.tag.split("}", 1)[-1]
            return DetectedFormat(
                format=FormatKind.XML,
                reason="Rozpoznano po rozszerzeniu XML i korzeniu dokumentu.",
                xml_root=xml_root,
            )
        return DetectedFormat(format=FormatKind.UNKNOWN, confidence=0.1, reason="Nieznany format pliku.")

