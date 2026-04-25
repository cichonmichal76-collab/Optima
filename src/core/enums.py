from __future__ import annotations

from enum import Enum


class SeverityLevel(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class FormatKind(str, Enum):
    XLSX = "XLSX"
    XLS = "XLS"
    CSV = "CSV"
    XML = "XML"
    JSON = "JSON"
    TXT = "TXT"
    UNKNOWN = "UNKNOWN"


class DataKind(str, Enum):
    VAT_PURCHASE = "VAT_PURCHASE"
    VAT_SALE = "VAT_SALE"
    LEDGER = "LEDGER"
    ACCOUNT_PLAN = "ACCOUNT_PLAN"
    SETTLEMENTS = "SETTLEMENTS"
    BANK = "BANK"
    JPK_XML = "JPK_XML"
    OPTIMA_SCHEMA_XML = "OPTIMA_SCHEMA_XML"
    OPTIMA_DOCUMENT_XML = "OPTIMA_DOCUMENT_XML"
    UNKNOWN = "UNKNOWN"

