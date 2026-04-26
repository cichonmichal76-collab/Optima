from __future__ import annotations

import serve

from src.connectors.optima_report_queries import build_report_query


def test_package_status_report_exposes_explicit_package_flags():
    query = build_report_query("package-status", "202603")

    assert "FROM CDN.DokNag AS d" in query.sql
    assert "FROM CDN.VatNag AS v" in query.sql
    assert "VaN_IdentKsieg" in query.sql
    assert "DeN_IdentKsieg" in query.sql
    assert "[__flag_dokumenty_bez_schematu]" in query.sql
    assert "[__flag_dokumenty_bez_dekretu]" in query.sql
    assert "[__flag_brak_danych_zrodlowych]" in query.sql
    assert "[__flag_duzo_dokumentow_bez_schematu]" in query.sql
    assert "[__flag_kontrola_techniczna_nieprzeszla]" in query.sql
    assert "d.DoN_DataDok >= '2026-03-01'" in query.sql
    assert "v.VaN_DataWys >= '2026-03-01'" in query.sql
    assert query.notes


def test_closing_blockers_report_exposes_explicit_blocker_flags():
    query = build_report_query("closing-blockers", "202603")

    assert "DuplicateDocuments" in query.sql
    assert "SalesWithoutKsef" in query.sql
    assert "BankWhitelistRisk" in query.sql
    assert "KntWeryfRachHist" in query.sql
    assert "VaN_NrKSeF" in query.sql
    assert "[__flag_blokady_techniczne_brak_danych_blad_importu_duplikaty]" in query.sql
    assert "[__flag_blokady_ksiegowe_i_schematowe_brak_dekretu_brak_schematu_schemat_bledny]" in query.sql
    assert "[__flag_blokady_podatkowe_ksef_platnicze_merytoryczne_i_zarzadcze]" in query.sql
    assert "[__flag_faktura_sprzedazy_bez_ksef]" in query.sql
    assert "[__flag_platnosc_na_rachunek_spoza_bialej_listy]" in query.sql
    assert "d.DoN_DataDok >= '2026-03-01'" in query.sql
    assert "v.VaN_DataWys >= '2026-03-01'" in query.sql
    assert "b.BZp_DataDok >= '2026-03-01'" in query.sql
    assert query.notes


def test_manual_entries_report_finds_entries_without_scheme():
    query = build_report_query("manual-entries", "202603")

    assert "CDN.DekretyNag" in query.sql
    assert "CDN.DekretyElem" in query.sql
    assert "DeN_WzorzecId IS NULL" in query.sql
    assert "DeN_WzorzecTyp IS NULL" in query.sql
    assert "n.DeN_DataDok >= '2026-03-01'" in query.sql
    assert "n.DeN_DataDok < '2026-04-01'" in query.sql
    assert "[Osoba księgująca]" in query.sql
    assert query.notes


def test_documents_without_scheme_report_exposes_filter_flags():
    query = build_report_query("documents-without-scheme", "202603")

    assert "CDN.DokNag AS d" in query.sql
    assert "CDN.DokPodmioty AS dp" in query.sql
    assert "CDN.TraNag AS tr" in query.sql
    assert "CDN.VatNag AS va" in query.sql
    assert "CDN.DokumentyKSeF AS dk" in query.sql
    assert "[__flag_brak_kontrahenta]" in query.sql
    assert "[__flag_brak_kategorii]" in query.sql
    assert "[__flag_brak_stawki_vat]" in query.sql
    assert "[__flag_brak_mpk]" in query.sql
    assert "[__flag_brak_projektu]" in query.sql
    assert "[__flag_brak_wynika_z_konfiguracji_schematu]" in query.sql
    assert "d.DoN_DataDok >= '2026-03-01'" in query.sql
    assert "d.DoN_DataDok < '2026-04-01'" in query.sql
    assert query.notes


def test_construction_site_costs_report_targets_account_500_150():
    query = build_report_query("construction-site-costs", "202603")

    assert "500-150%" in query.sql
    assert "CDN.Konta AS wn" in query.sql
    assert "CDN.Konta AS ma" in query.sql
    assert "[Budowa]" in query.sql
    assert "[Konto budowy]" in query.sql
    assert "[Optima DeNID]" in query.sql
    assert "n.DeN_DataDok >= '2026-03-01'" in query.sql
    assert "n.DeN_DataDok < '2026-04-01'" in query.sql
    assert query.notes


def test_report_data_falls_back_to_primary_module(monkeypatch):
    def fake_run_sqlcmd_table(sql, config):
        assert "CDN.Kontrahenci" in sql
        assert config.database == "OptimaAudit_Test"
        return ["Kod kontrahenta"], [{"Kod kontrahenta": "ABC"}]

    monkeypatch.setattr(serve, "run_sqlcmd_table", fake_run_sqlcmd_table)

    payload = serve.report_data(
        {
            "report": "contractor-master-data",
            "report_title": "Kartoteka kontrahentów",
            "module": "CONTRACTORS",
            "database": "OptimaAudit_Test",
        }
    )

    assert payload["rows"] == [{"Kod kontrahenta": "ABC"}]
    assert payload["source"]["source_type"] == "module"
    assert payload["source"]["module"] == "CONTRACTORS"
    assert any("Kartoteka kontrahentów" in note for note in payload["notes"])


def test_report_data_defaults_to_scope_2025_2026(monkeypatch):
    def fake_run_sqlcmd_table(sql, config):
        assert "n.DeN_DataDok >= '2025-01-01'" in sql
        assert "n.DeN_DataDok < '2027-01-01'" in sql
        return ["Numer"], [{"Numer": "E/2026/03"}]

    monkeypatch.setattr(serve, "run_sqlcmd_table", fake_run_sqlcmd_table)

    payload = serve.report_data(
        {
            "report": "manual-entries",
            "report_title": "Dokumenty z dekretem, ale bez schematu",
            "database": "OptimaAudit_Test",
        }
    )

    assert payload["rows"] == [{"Numer": "E/2026/03"}]
    assert payload["source"]["date_from"] == "2025-01-01"
    assert payload["source"]["date_to"] == "2026-12-31"


def test_report_data_uses_explicit_package_status_query(monkeypatch):
    def fake_run_sqlcmd_table(sql, config):
        assert "PackageMetrics" in sql
        assert "[Status paczki]" in sql
        assert config.database == "OptimaAudit_Test"
        return ["Nazwa paczki", "Status paczki"], [{"Nazwa paczki": "OptimaAudit_Test", "Status paczki": "OK"}]

    monkeypatch.setattr(serve, "run_sqlcmd_table", fake_run_sqlcmd_table)

    payload = serve.report_data(
        {
            "report": "package-status",
            "report_title": "Status paczki danych",
            "module": "DOCUMENTS",
            "database": "OptimaAudit_Test",
            "allowed_years": ["2026"],
        }
    )

    assert payload["rows"] == [{"Nazwa paczki": "OptimaAudit_Test", "Status paczki": "OK"}]
    assert payload["source"]["source_type"] == "report"
    assert payload["source"]["report"] == "package-status"


def test_report_data_uses_explicit_closing_blockers_query(monkeypatch):
    def fake_run_sqlcmd_table(sql, config):
        assert "SalesWithoutKsef" in sql
        assert "[Typ blokady]" in sql
        assert config.database == "OptimaAudit_Test"
        return ["Typ blokady", "Dokument"], [{"Typ blokady": "Podatkowa / KSeF", "Dokument": "FS/1/03/2026"}]

    monkeypatch.setattr(serve, "run_sqlcmd_table", fake_run_sqlcmd_table)

    payload = serve.report_data(
        {
            "report": "closing-blockers",
            "report_title": "Blokady zamknięcia miesiąca",
            "module": "DOCUMENTS",
            "database": "OptimaAudit_Test",
            "allowed_years": ["2026"],
        }
    )

    assert payload["rows"] == [{"Typ blokady": "Podatkowa / KSeF", "Dokument": "FS/1/03/2026"}]
    assert payload["source"]["source_type"] == "report"
    assert payload["source"]["report"] == "closing-blockers"


def test_report_data_defaults_to_selected_import_year(monkeypatch):
    def fake_run_sqlcmd_table(sql, config):
        assert "n.DeN_DataDok >= '2025-01-01'" in sql
        assert "n.DeN_DataDok < '2026-01-01'" in sql
        return ["Numer"], [{"Numer": "E/2025/03"}]

    monkeypatch.setattr(serve, "run_sqlcmd_table", fake_run_sqlcmd_table)

    payload = serve.report_data(
        {
            "report": "manual-entries",
            "report_title": "Dokumenty z dekretem, ale bez schematu",
            "database": "OptimaAudit_Test",
            "allowed_years": ["2025"],
        }
    )

    assert payload["rows"] == [{"Numer": "E/2025/03"}]
    assert payload["source"]["allowed_years"] == [2025]
    assert payload["source"]["date_from"] == "2025-01-01"
    assert payload["source"]["date_to"] == "2025-12-31"


def test_report_data_rejects_year_outside_allowed_scope():
    try:
        serve.report_data(
            {
                "report": "manual-entries",
                "report_title": "Dokumenty z dekretem, ale bez schematu",
                "database": "OptimaAudit_Test",
                "year": "2024",
            }
        )
    except ValueError as exc:
        assert "2025 i 2026" in str(exc)
    else:
        raise AssertionError("Expected ValueError for out-of-range year")
