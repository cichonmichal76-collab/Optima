from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from typing import Any

import pandas as pd

from src.connectors.base import BaseConnector
from src.core.enums import DataKind, FormatKind
from src.core.models import (
    AccountRecord,
    AuditIssue,
    ImportResult,
    LedgerRecord,
    MappingProfile,
    PreviewResult,
    SettlementRecord,
    VatRecord,
)
from src.core.normalizers import normalize_bool, normalize_date, normalize_decimal, normalize_text
from src.mapping.auto_detect import guess_data_kind
from src.mapping.column_mapper import ColumnMapper


class FileTableConnector(BaseConnector):
    format_kind = FormatKind.UNKNOWN
    supported_suffixes: tuple[str, ...] = ()

    def __init__(self, data_kind: DataKind = DataKind.UNKNOWN) -> None:
        self.data_kind = data_kind
        self.column_mapper = ColumnMapper()

    def can_handle(self, file_path: Path) -> bool:
        return file_path.suffix.lower() in self.supported_suffixes

    def preview(self, file_path: Path) -> PreviewResult:
        frame, metadata = self._read_frame(file_path)
        headers = [str(column) for column in frame.columns]
        preview_rows = [
            {str(key): self._to_python(value) for key, value in row.items()}
            for row in frame.head(20).to_dict(orient="records")
        ]
        return PreviewResult(
            file_path=str(file_path),
            detected_format=self.format_kind,
            headers=headers,
            preview_rows=preview_rows,
            notes=metadata.get("notes", []),
            sheet_names=metadata.get("sheet_names", []),
        )

    def load(self, file_path: Path, mapping: MappingProfile | None = None) -> ImportResult:
        frame, metadata = self._read_frame(file_path)
        headers = [str(column) for column in frame.columns]
        data_kind = self.data_kind if self.data_kind != DataKind.UNKNOWN else guess_data_kind(headers)
        mapping_used = mapping.column_map if mapping else self.column_mapper.auto_map(headers, data_kind)
        missing_required = self.column_mapper.validate_mapping(data_kind, mapping_used)

        issues: list[AuditIssue] = []
        for field_name in missing_required:
            issues.append(
                AuditIssue(
                    level="WARNING",
                    area="IMPORT",
                    source_file=str(file_path),
                    issue_code="MISSING_MAPPING",
                    issue=f"Brakuje mapowania pola '{field_name}'.",
                    recommendation="Uzupelnij mapowanie kolumn w kreatorze importu.",
                    confidence=0.95,
                )
            )

        records: list[Any] = []
        for row_index, row in enumerate(frame.to_dict(orient="records"), start=1):
            cleaned_row = {str(key): self._to_python(value) for key, value in row.items()}
            if self._is_empty_row(cleaned_row):
                continue
            mapped_row = self.column_mapper.apply_mapping(cleaned_row, mapping_used)
            record = self._build_record(data_kind, mapped_row, cleaned_row)
            if record is not None:
                records.append(record)

        return ImportResult(
            file_path=str(file_path),
            data_kind=data_kind,
            records=records,
            row_count=len(records),
            issues=issues,
            mapping_used=mapping_used,
        )

    def _read_frame(self, file_path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
        raise NotImplementedError

    @staticmethod
    def _to_python(value: Any) -> Any:
        if pd.isna(value):
            return None
        return value

    @staticmethod
    def _is_empty_row(row: dict[str, Any]) -> bool:
        return all(value in (None, "") for value in row.values())

    def _build_record(self, data_kind: DataKind, mapped_row: dict[str, Any], raw_row: dict[str, Any]) -> Any:
        if data_kind in {DataKind.VAT_PURCHASE, DataKind.VAT_SALE}:
            net = normalize_decimal(mapped_row.get("net"), Decimal("0")) or Decimal("0")
            vat = normalize_decimal(mapped_row.get("vat"), Decimal("0")) or Decimal("0")
            gross = normalize_decimal(mapped_row.get("gross"))
            if gross is None:
                gross = net + vat
            jpk_codes_raw = normalize_text(mapped_row.get("jpk_codes")) or ""
            jpk_codes = [item.strip() for item in jpk_codes_raw.split(",") if item.strip()]
            return VatRecord(
                source_type=data_kind.value,
                document_number=normalize_text(mapped_row.get("document_number")) or "",
                contractor_name=normalize_text(mapped_row.get("contractor_name")),
                contractor_nip=normalize_text(mapped_row.get("contractor_nip")),
                issue_date=normalize_date(mapped_row.get("issue_date")),
                receipt_date=normalize_date(mapped_row.get("receipt_date")),
                vat_period=normalize_text(mapped_row.get("vat_period")),
                net=net,
                vat=vat,
                gross=gross,
                vat_rate=normalize_text(mapped_row.get("vat_rate")),
                register_name=normalize_text(mapped_row.get("register_name")),
                jpk_codes=jpk_codes,
                raw=raw_row,
            )
        if data_kind == DataKind.LEDGER:
            return LedgerRecord(
                document_number=normalize_text(mapped_row.get("document_number")) or "",
                accounting_date=normalize_date(mapped_row.get("accounting_date")),
                operation_date=normalize_date(mapped_row.get("operation_date")),
                description=normalize_text(mapped_row.get("description")),
                account_wn=normalize_text(mapped_row.get("account_wn")),
                account_ma=normalize_text(mapped_row.get("account_ma")),
                amount_wn=normalize_decimal(mapped_row.get("amount_wn"), Decimal("0")) or Decimal("0"),
                amount_ma=normalize_decimal(mapped_row.get("amount_ma"), Decimal("0")) or Decimal("0"),
                contractor_name=normalize_text(mapped_row.get("contractor_name")),
                contractor_nip=normalize_text(mapped_row.get("contractor_nip")),
                journal=normalize_text(mapped_row.get("journal")),
                raw=raw_row,
            )
        if data_kind == DataKind.ACCOUNT_PLAN:
            return AccountRecord(
                account_number=normalize_text(mapped_row.get("account_number")) or "",
                name=normalize_text(mapped_row.get("name")),
                account_type=normalize_text(mapped_row.get("account_type")),
                is_active=normalize_bool(mapped_row.get("is_active")),
                jpk_s_12_1=normalize_text(mapped_row.get("jpk_s_12_1")),
                jpk_s_12_2=normalize_text(mapped_row.get("jpk_s_12_2")),
                jpk_s_12_3=normalize_text(mapped_row.get("jpk_s_12_3")),
                raw=raw_row,
            )
        if data_kind in {DataKind.SETTLEMENTS, DataKind.BANK}:
            amount = normalize_decimal(mapped_row.get("amount"), Decimal("0")) or Decimal("0")
            paid_amount = normalize_decimal(mapped_row.get("paid_amount"), Decimal("0")) or Decimal("0")
            remaining_amount = normalize_decimal(mapped_row.get("remaining_amount"))
            if remaining_amount is None:
                remaining_amount = amount - paid_amount
            return SettlementRecord(
                document_number=normalize_text(mapped_row.get("document_number")) or "",
                contractor_name=normalize_text(mapped_row.get("contractor_name")),
                contractor_nip=normalize_text(mapped_row.get("contractor_nip")),
                due_date=normalize_date(mapped_row.get("due_date")),
                payment_date=normalize_date(mapped_row.get("payment_date") or mapped_row.get("operation_date")),
                amount=amount,
                paid_amount=paid_amount,
                remaining_amount=remaining_amount,
                account=normalize_text(mapped_row.get("account")),
                status=normalize_text(mapped_row.get("status")),
                raw=raw_row,
            )
        return mapped_row

