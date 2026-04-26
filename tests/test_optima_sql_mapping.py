from __future__ import annotations

import pytest

from src.connectors.optima_sql_mapping import build_optima_sql_query
from src.core.enums import DataKind


def test_vat_purchase_query_uses_documented_vat_tables_without_vat_rate_mapping():
    query = build_optima_sql_query(DataKind.VAT_PURCHASE, 202603)

    assert "CDN.VatNag" in query.sql
    assert "CDN.VatTab" in query.sql
    assert "VaT_NettoDoVAT" in query.sql
    assert "VaT_VATDoVAT" in query.sql
    assert "VaT_Stawka" not in query.sql
    assert "n.VaN_Rejestr = N'ZAKUP'" in query.sql
    assert "n.VaN_DeklRokMies = 202603" in query.sql
    assert "[Numer dokumentu]" in query.sql
    assert "[Kwota brutto]" in query.sql


def test_vat_sale_query_filters_sales_register():
    query = build_optima_sql_query(DataKind.VAT_SALE, "202603")

    assert "n.VaN_Rejestr = N'SPRZEDAŻ'" in query.sql
    assert query.data_kind == DataKind.VAT_SALE


def test_ledger_query_uses_explicit_debit_credit_account_columns():
    query = build_optima_sql_query(DataKind.LEDGER, 202603)

    assert "CDN.DekretyNag" in query.sql
    assert "CDN.DekretyElem" in query.sql
    assert "e.DeE_AccWnId" in query.sql
    assert "e.DeE_AccMaId" in query.sql
    assert "e.DeE_KontoWn AS [Konto Wn]" in query.sql
    assert "e.DeE_KontoMa AS [Konto Ma]" in query.sql
    assert "n.DeN_Bufor" in query.sql
    assert "2026-03-01" in query.sql
    assert "2026-04-01" in query.sql


def test_ledger_query_filters_by_custom_date_range():
    query = build_optima_sql_query(DataKind.LEDGER, date_from="2026-03-10", date_to="2026-03-20")

    assert "n.DeN_DataDok >= '2026-03-10'" in query.sql
    assert "n.DeN_DataDok < '2026-03-21'" in query.sql


def test_vat_query_filters_by_year_when_month_is_not_selected():
    query = build_optima_sql_query(DataKind.VAT_PURCHASE, year="2026")

    assert "n.VaN_DeklRokMies >= 202601" in query.sql
    assert "n.VaN_DeklRokMies <= 202612" in query.sql


def test_account_plan_query_maps_plan_accounts():
    query = build_optima_sql_query(DataKind.ACCOUNT_PLAN)

    assert "CDN.Konta" in query.sql
    assert "Acc_Numer AS [Numer konta]" in query.sql
    assert "Acc_NieAktywne" in query.sql


def test_settlements_query_uses_settlement_table_and_status():
    query = build_optima_sql_query(DataKind.SETTLEMENTS, 202603)

    assert "CDN.KsiRozrachunki" in query.sql
    assert "KRo_Dokument AS [Numer dokumentu]" in query.sql
    assert "KRo_TerminPlatnosci" in query.sql
    assert "KRo_SumRozliczen" in query.sql
    assert "[Konto rozrachunkowe]" in query.sql
    assert "[Status]" in query.sql
    assert "2026-03-01" in query.sql
    assert "2026-04-01" in query.sql


def test_bank_query_uses_bank_entries_and_operation_columns():
    query = build_optima_sql_query(DataKind.BANK, year=2026)

    assert "CDN.BnkZapisy" in query.sql
    assert "[Data operacji]" in query.sql
    assert "BZp_KontoPrzeciwstawne AS [Konto rozrachunkowe]" in query.sql
    assert "N'Rozliczony'" in query.sql
    assert "BZp_DataDok >= '2026-01-01'" in query.sql
    assert "BZp_DataDok < '2027-01-01'" in query.sql


def test_period_validation_rejects_invalid_month():
    with pytest.raises(ValueError):
        build_optima_sql_query(DataKind.VAT_PURCHASE, "202613")
