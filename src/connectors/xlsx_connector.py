from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from src.connectors.file_table_connector import FileTableConnector
from src.core.enums import FormatKind


class XlsxConnector(FileTableConnector):
    format_kind = FormatKind.XLSX
    supported_suffixes = (".xlsx", ".xls")

    def _read_frame(self, file_path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
        workbook = pd.read_excel(file_path, sheet_name=None, dtype=str)
        notes: list[str] = []
        for sheet_name, frame in workbook.items():
            if not frame.dropna(how="all").empty:
                cleaned = frame.dropna(how="all")
                if len(workbook) > 1:
                    notes.append(f"Uzyto arkusza: {sheet_name}")
                return cleaned, {"sheet_names": list(workbook.keys()), "notes": notes}
        first_sheet_name = next(iter(workbook.keys()))
        return workbook[first_sheet_name], {"sheet_names": list(workbook.keys()), "notes": ["Arkusz jest pusty."]}

