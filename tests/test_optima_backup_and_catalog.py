from __future__ import annotations

from src.connectors.optima_backup import sanitize_identifier, suggest_database_name
from src.connectors.optima_data_catalog import build_available_data_sql, build_module_query


def test_suggest_database_name_creates_safe_audit_name():
    name = suggest_database_name("CDN_WOJEWÓDZKI SP. Z O.O.")

    assert name.startswith("OptimaAudit_")
    assert " " not in name
    assert "." not in name


def test_sanitize_identifier_rejects_sql_punctuation():
    assert sanitize_identifier("abc]; DROP DATABASE master;--") == "abc_DROP_DATABASE_master"


def test_available_data_sql_contains_core_modules():
    sql = build_available_data_sql()

    assert "VAT_PURCHASE" in sql
    assert "LEDGER" in sql
    assert "HR_PAYROLL" in sql


def test_bank_module_query_filters_by_period():
    sql, notes = build_module_query("BANK", "202603")

    assert "CDN.BnkZapisy" in sql
    assert "BZp_DataDok >= '2026-03-01'" in sql
    assert "BZp_DataDok < '2026-04-01'" in sql
    assert notes
