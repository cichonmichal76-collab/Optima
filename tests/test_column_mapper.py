from __future__ import annotations

from src.core.enums import DataKind
from src.mapping.column_mapper import ColumnMapper


def test_column_mapper_auto_map_for_ledger_headers():
    mapper = ColumnMapper()
    headers = [
        "Nr dokumentu",
        "Data ksiegowania",
        "Opis",
        "Konto Wn",
        "Konto Ma",
        "Kwota Wn",
        "Kwota Ma",
    ]

    mapping = mapper.auto_map(headers, DataKind.LEDGER)

    assert mapping["document_number"] == "Nr dokumentu"
    assert mapping["account_wn"] == "Konto Wn"
    assert mapper.validate_mapping(DataKind.LEDGER, mapping) == []


def test_column_mapper_reports_missing_required_fields():
    mapper = ColumnMapper()
    mapping = {"document_number": "Nr dokumentu", "account_wn": "Konto Wn"}

    missing = mapper.validate_mapping(DataKind.LEDGER, mapping)

    assert set(missing) == {"account_ma", "amount_wn", "amount_ma"}

