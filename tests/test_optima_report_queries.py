from __future__ import annotations

import serve

from src.connectors.optima_report_queries import build_report_query


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
