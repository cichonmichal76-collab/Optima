from __future__ import annotations

from src.connectors.optima_backup import sanitize_identifier, scan_backup_files, suggest_database_name
from src.connectors.optima_data_catalog import build_available_data_sql, build_module_query


def test_suggest_database_name_creates_safe_audit_name():
    name = suggest_database_name("CDN_WOJEWÓDZKI SP. Z O.O.")

    assert name.startswith("OptimaAudit_")
    assert " " not in name
    assert "." not in name


def test_sanitize_identifier_rejects_sql_punctuation():
    assert sanitize_identifier("abc]; DROP DATABASE master;--") == "abc_DROP_DATABASE_master"


def test_scan_backup_files_accepts_directory_root(tmp_path):
    backup = tmp_path / "firma.bac"
    backup.write_bytes(b"backup")

    found = scan_backup_files([str(tmp_path)])

    assert any(item["path"] == str(backup) for item in found)


def test_scan_backup_files_accepts_direct_file_root(tmp_path):
    backup = tmp_path / "firma.bak"
    backup.write_bytes(b"backup")

    found = scan_backup_files([str(backup)])

    assert any(item["name"] == "firma.bak" for item in found)


def test_available_data_sql_contains_core_modules():
    sql = build_available_data_sql()

    assert "VAT_PURCHASE" in sql
    assert "LEDGER" in sql
    assert "HR_PAYROLL" in sql


def test_available_data_sql_filters_counts_by_year():
    sql = build_available_data_sql(year="2026")

    assert "VaN_DeklRokMies >= 202601" in sql
    assert "n.DeN_DataDok >= '2026-01-01'" in sql
    assert "n.DeN_DataDok < '2027-01-01'" in sql


def test_bank_module_query_filters_by_period():
    sql, notes = build_module_query("BANK", "202603")

    assert "CDN.BnkZapisy" in sql
    assert "BZp_DataDok >= '2026-03-01'" in sql
    assert "BZp_DataDok < '2026-04-01'" in sql
    assert notes


def test_bank_module_query_filters_by_custom_date_range():
    sql, _ = build_module_query("BANK", date_from="2026-03-10", date_to="2026-03-20")

    assert "BZp_DataDok >= '2026-03-10'" in sql
    assert "BZp_DataDok < '2026-03-21'" in sql
