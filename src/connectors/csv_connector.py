from __future__ import annotations

import csv
from io import StringIO
from pathlib import Path
from typing import Any

import pandas as pd
from charset_normalizer import from_bytes

from src.connectors.file_table_connector import FileTableConnector
from src.core.enums import FormatKind


class CsvConnector(FileTableConnector):
    format_kind = FormatKind.CSV
    supported_suffixes = (".csv",)
    candidate_encodings = ("utf-8-sig", "utf-8", "cp1250", "latin2")

    def _read_frame(self, file_path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
        raw_bytes = file_path.read_bytes()
        encoding = self._detect_encoding(raw_bytes)
        text = raw_bytes.decode(encoding)
        delimiter = self._detect_delimiter(text)
        frame = pd.read_csv(StringIO(text), sep=delimiter, dtype=str)
        frame = frame.dropna(how="all")
        return frame, {"notes": [f"Wykryto encoding: {encoding}", f"Wykryto separator: {repr(delimiter)}"]}

    def _detect_encoding(self, raw_bytes: bytes) -> str:
        guess = from_bytes(raw_bytes).best()
        if guess and guess.encoding:
            return guess.encoding
        for encoding in self.candidate_encodings:
            try:
                raw_bytes.decode(encoding)
                return encoding
            except UnicodeDecodeError:
                continue
        return "utf-8"

    @staticmethod
    def _detect_delimiter(text: str) -> str:
        sample = "\n".join(text.splitlines()[:5])
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=";,\t")
            return dialect.delimiter
        except csv.Error:
            counts = {delimiter: sample.count(delimiter) for delimiter in (";", ",", "\t")}
            return max(counts, key=counts.get)

