from src.connectors.optima_filter_snippets import build_optima_filter_snippets


def test_builds_primary_and_secondary_filter_for_documents() -> None:
    result = build_optima_filter_snippets(
        report_title="Dokumenty bez schematu",
        module_code="DOCUMENTS",
        headers=["Numer dokumentu", "Optima DoNID"],
        rows=[
            {"Numer dokumentu": "FV/1/2026", "Optima DoNID": "101"},
            {"Numer dokumentu": "FV/2/2026", "Optima DoNID": "102"},
            {"Numer dokumentu": "FV/2/2026", "Optima DoNID": "102"},
        ],
    )

    assert result["supported"] is True
    assert result["primary"]["expression"] == "DoN_DoNID IN (101, 102)"
    assert result["secondary"]["expression"] == "DoN_NumerPelny IN (N'FV/1/2026', N'FV/2/2026')"


def test_falls_back_to_number_filter_when_ids_are_missing() -> None:
    result = build_optima_filter_snippets(
        report_title="Rejestr VAT zakup",
        module_code="VAT_PURCHASE",
        headers=["Numer dokumentu"],
        rows=[{"Numer dokumentu": "FZ/44/2026"}],
    )

    assert result["supported"] is True
    assert result["primary"] is None
    assert result["secondary"]["expression"] == "VaN_Dokument = N'FZ/44/2026'"


def test_reports_unsupported_when_no_key_data_exists() -> None:
    result = build_optima_filter_snippets(
        report_title="Status paczki danych",
        module_code="DOCUMENTS",
        headers=["Status", "Kwota"],
        rows=[{"Status": "OK", "Kwota": "1200"}],
    )

    assert result["supported"] is False
    assert result["status"] == "unsupported"
