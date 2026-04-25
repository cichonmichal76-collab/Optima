from __future__ import annotations

from datetime import date as dt_date
from datetime import datetime as dt_datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from src.core.enums import DataKind, FormatKind, SeverityLevel


class AuditIssue(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    level: SeverityLevel
    area: str
    source_file: str | None = None
    document_number: str | None = None
    contractor: str | None = None
    date: dt_date | None = None
    issue_code: str
    issue: str
    recommendation: str
    raw_row_index: int | None = None
    confidence: float = 1.0


class VatRecord(BaseModel):
    source_type: str = "UNKNOWN"
    document_number: str
    contractor_name: str | None = None
    contractor_nip: str | None = None
    issue_date: dt_date | None = None
    receipt_date: dt_date | None = None
    vat_period: str | None = None
    net: Decimal
    vat: Decimal
    gross: Decimal
    vat_rate: str | None = None
    register_name: str | None = None
    jpk_codes: list[str] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)


class LedgerRecord(BaseModel):
    document_number: str
    accounting_date: dt_date | None = None
    operation_date: dt_date | None = None
    description: str | None = None
    account: str | None = None
    account_opposite: str | None = None
    account_wn: str | None = None
    account_ma: str | None = None
    amount_wn: Decimal = Decimal("0")
    amount_ma: Decimal = Decimal("0")
    currency: str = "PLN"
    contractor_name: str | None = None
    contractor_nip: str | None = None
    journal: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class AccountRecord(BaseModel):
    account_number: str
    name: str | None = None
    account_type: str | None = None
    is_active: bool | None = None
    jpk_s_12_1: str | None = None
    jpk_s_12_2: str | None = None
    jpk_s_12_3: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class SettlementRecord(BaseModel):
    document_number: str
    contractor_name: str | None = None
    contractor_nip: str | None = None
    due_date: dt_date | None = None
    payment_date: dt_date | None = None
    amount: Decimal
    paid_amount: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    account: str | None = None
    status: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class MappingProfile(BaseModel):
    name: str
    data_kind: DataKind
    column_map: dict[str, str]
    created_at: dt_datetime = Field(default_factory=dt_datetime.utcnow)
    updated_at: dt_datetime = Field(default_factory=dt_datetime.utcnow)
    source_signature: list[str] = Field(default_factory=list)


class PreviewResult(BaseModel):
    file_path: str | None = None
    detected_format: FormatKind = FormatKind.UNKNOWN
    headers: list[str] = Field(default_factory=list)
    preview_rows: list[dict[str, Any]] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    sheet_names: list[str] = Field(default_factory=list)
    xml_root: str | None = None
    namespaces: dict[str, str] = Field(default_factory=dict)


class ImportResult(BaseModel):
    file_path: str
    data_kind: DataKind
    records: list[Any] = Field(default_factory=list)
    row_count: int = 0
    issues: list[AuditIssue] = Field(default_factory=list)
    mapping_used: dict[str, str] = Field(default_factory=dict)


class DetectedFormat(BaseModel):
    format: FormatKind
    confidence: float = 1.0
    reason: str = ""
    sheet_names: list[str] = Field(default_factory=list)
    xml_root: str | None = None


class SchemaDraftLine(BaseModel):
    side: str
    account: str | None = None
    amount_expression: str | None = None
    description: str | None = None


class SchemaDraft(BaseModel):
    name: str
    template_id: str
    condition: str | None = None
    warnings: list[str] = Field(default_factory=list)
    lines: list[SchemaDraftLine] = Field(default_factory=list)


class AuditRunResult(BaseModel):
    issues: list[AuditIssue] = Field(default_factory=list)
    summary: dict[str, Any] = Field(default_factory=dict)
