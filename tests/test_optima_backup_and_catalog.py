from __future__ import annotations

import src.connectors.optima_backup as optima_backup
import serve
from src.connectors.optima_backup import pick_backup_file, sanitize_identifier, scan_backup_files, suggest_database_name
from src.connectors.optima_data_catalog import build_available_data_sql, build_module_query


def test_suggest_database_name_creates_safe_audit_name():
    name = suggest_database_name("CDN_WOJEWÓDZKI SP. Z O.O.")

    assert name.startswith("OptimaAudit_")
    assert " " not in name
    assert "." not in name


def test_sanitize_identifier_rejects_sql_punctuation():
    assert sanitize_identifier("abc]; DROP DATABASE master;--") == "abc_DROP_DATABASE_master"


def test_unique_database_name_adds_suffix_when_target_exists(monkeypatch):
    existing = {"OptimaAudit_Test"}

    def fake_database_exists(database, config):
        return database in existing

    monkeypatch.setattr(optima_backup, "_database_exists", fake_database_exists)

    assert optima_backup._unique_database_name("OptimaAudit_Test", object()).startswith("OptimaAudit_Test_")


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


def test_pick_backup_file_uses_parent_directory_of_existing_file(tmp_path, monkeypatch):
    backup = tmp_path / "firma.bak"
    backup.write_bytes(b"backup")
    captured = {}

    def fake_picker(initial_dir):
        captured["initial_dir"] = initial_dir
        return str(backup)

    monkeypatch.setattr(optima_backup, "_ask_backup_filename", fake_picker)

    selected = pick_backup_file(str(backup))

    assert selected == str(backup)
    assert captured["initial_dir"] == str(tmp_path)


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


def test_list_available_years_reads_distinct_years(monkeypatch):
    def fake_run_sqlcmd_table(sql, config):
        assert "CDN.VatNag" in sql
        assert config.database == "OptimaAudit_Test"
        return ["Rok"], [{"Rok": "2027"}, {"Rok": "2026"}, {"Rok": "2025"}, {"Rok": "2024"}, {"Rok": "bad"}]

    monkeypatch.setattr(serve, "run_sqlcmd_table", fake_run_sqlcmd_table)

    assert serve.list_available_years(r".\SQLEXPRESS02", "OptimaAudit_Test") == [2026, 2025]


def test_list_available_years_respects_selected_import_years(monkeypatch):
    def fake_run_sqlcmd_table(sql, config):
        return ["Rok"], [{"Rok": "2026"}, {"Rok": "2025"}]

    monkeypatch.setattr(serve, "run_sqlcmd_table", fake_run_sqlcmd_table)

    assert serve.list_available_years(
        r".\SQLEXPRESS02",
        "OptimaAudit_Test",
        allowed_years=["2025"],
    ) == [2025]
