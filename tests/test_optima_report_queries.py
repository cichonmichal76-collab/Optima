from __future__ import annotations

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
