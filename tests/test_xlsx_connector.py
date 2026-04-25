from __future__ import annotations

from decimal import Decimal

import pandas as pd

from src.connectors.xlsx_connector import XlsxConnector
from src.core.enums import DataKind


def test_xlsx_connector_loads_vat_rows_with_shuffled_columns(tmp_path):
    file_path = tmp_path / "vat.xlsx"
    frame = pd.DataFrame(
        [
            {
                "Netto": "100,00",
                "Nr dokumentu": "FV/1/04/2026",
                "Brutto": "123,00",
                "VAT": "23,00",
                "Kontrahent": "Firma Test",
                "NIP": "1234567890",
                "Data wystawienia": "2026-04-01",
                "Data wplywu": "2026-04-02",
                "Stawka VAT": "23%",
                "Rejestr": "Zakup krajowy",
            }
        ]
    )
    with pd.ExcelWriter(file_path) as writer:
        pd.DataFrame().to_excel(writer, sheet_name="Pusty", index=False)
        frame.to_excel(writer, sheet_name="VAT", index=False)

    connector = XlsxConnector(data_kind=DataKind.VAT_PURCHASE)
    preview = connector.preview(file_path)
    result = connector.load(file_path)

    assert "Nr dokumentu" in preview.headers
    assert result.row_count == 1
    record = result.records[0]
    assert record.document_number == "FV/1/04/2026"
    assert record.contractor_name == "Firma Test"
    assert record.net == Decimal("100.00")
    assert record.vat == Decimal("23.00")
    assert record.gross == Decimal("123.00")

