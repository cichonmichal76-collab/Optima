from __future__ import annotations

from src.connectors import optima_sql_validation
from src.core.enums import DataKind


def test_validate_excel_against_sql_reports_exact_match(monkeypatch):
    def fake_run_sqlcmd_table(sql, config):
        assert "CDN.VatNag" in sql
        assert config.database == "OptimaAudit_Test"
        return (
            [
                "Numer dokumentu",
                "Data wystawienia",
                "Data wpływu",
                "NIP kontrahenta",
                "Kontrahent",
                "Kwota netto",
                "Kwota VAT",
                "Kwota brutto",
                "Rejestr",
            ],
            [
                {
                    "Numer dokumentu": "FV/1/04/2026",
                    "Data wystawienia": "2026-04-01",
                    "Data wpływu": "2026-04-02",
                    "NIP kontrahenta": "1234567890",
                    "Kontrahent": "Firma Test",
                    "Kwota netto": "100,00",
                    "Kwota VAT": "23,00",
                    "Kwota brutto": "123,00",
                    "Rejestr": "Zakup krajowy",
                }
            ],
        )

    monkeypatch.setattr(optima_sql_validation, "run_sqlcmd_table", fake_run_sqlcmd_table)

    payload = optima_sql_validation.validate_excel_against_sql(
        headers=[
            "Nr dokumentu",
            "Data wystawienia",
            "Data wpływu",
            "NIP",
            "Kontrahent",
            "Netto",
            "VAT",
            "Brutto",
            "Rejestr",
        ],
        rows=[
            {
                "Nr dokumentu": "FV/1/04/2026",
                "Data wystawienia": "2026-04-01",
                "Data wpływu": "2026-04-02",
                "NIP": "123-456-78-90",
                "Kontrahent": "Firma Test",
                "Netto": "100,00",
                "VAT": "23,00",
                "Brutto": "123,00",
                "Rejestr": "Zakup krajowy",
            }
        ],
        data_kind=DataKind.VAT_PURCHASE,
        server=r".\SQLEXPRESS02",
        database="OptimaAudit_Test",
        year=2026,
    )

    assert payload["status"] == "success"
    assert payload["summary"]["matched_rows"] == 1
    assert payload["summary"]["excel_only_rows"] == 0
    assert payload["summary"]["sql_only_rows"] == 0
    assert payload["summary"]["match_rate"] == "100.0%"
    assert payload["totals"][0]["label"] == "Kwota netto"
    assert payload["mapping"]["excel_missing_required"] == []
    assert payload["mapping"]["sql_missing_required"] == []


def test_validate_excel_against_sql_reports_mismatch(monkeypatch):
    def fake_run_sqlcmd_table(sql, config):
        return (
            ["Numer konta", "Nazwa", "Typ konta", "Czy aktywne"],
            [
                {
                    "Numer konta": "201-01",
                    "Nazwa": "Rozrachunki krajowe",
                    "Typ konta": "Bilansowe",
                    "Czy aktywne": "TAK",
                }
            ],
        )

    monkeypatch.setattr(optima_sql_validation, "run_sqlcmd_table", fake_run_sqlcmd_table)

    payload = optima_sql_validation.validate_excel_against_sql(
        headers=["Numer konta", "Nazwa konta", "Typ konta", "Aktywne"],
        rows=[
            {
                "Numer konta": "201-01",
                "Nazwa konta": "Rozrachunki eksport",
                "Typ konta": "Bilansowe",
                "Aktywne": "TAK",
            }
        ],
        data_kind=DataKind.ACCOUNT_PLAN,
        server=r".\SQLEXPRESS02",
        database="OptimaAudit_Test",
    )

    assert payload["status"] == "warning"
    assert payload["summary"]["matched_rows"] == 0
    assert payload["summary"]["excel_only_rows"] == 1
    assert payload["summary"]["sql_only_rows"] == 1
    assert payload["differences"]["excel_only_sample"]
    assert payload["differences"]["sql_only_sample"]
