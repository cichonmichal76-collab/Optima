from __future__ import annotations

from decimal import Decimal

from src.connectors.csv_connector import CsvConnector
from src.core.enums import DataKind


def test_csv_connector_reads_cp1250_semicolon_and_polish_dates(tmp_path):
    file_path = tmp_path / "vat.csv"
    content = (
        "Nr dokumentu;Data wystawienia;NIP;Kontrahent;Netto;VAT;Brutto;Stawka VAT\n"
        "FS/1/04/2026;25.04.2026;9998887776;Zażółć Sp. z o.o.;100,50;23,12;123,62;23%\n"
    )
    file_path.write_bytes(content.encode("cp1250"))

    connector = CsvConnector(data_kind=DataKind.VAT_SALE)
    result = connector.load(file_path)

    assert result.row_count == 1
    record = result.records[0]
    assert record.document_number == "FS/1/04/2026"
    assert record.contractor_name == "Zażółć Sp. z o.o."
    assert str(record.issue_date) == "2026-04-25"
    assert record.net == Decimal("100.50")
    assert record.gross == Decimal("123.62")

