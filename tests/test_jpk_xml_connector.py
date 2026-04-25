from __future__ import annotations

from src.connectors.jpk_xml_connector import JpkXmlConnector


def test_jpk_xml_connector_reads_namespaced_xml(tmp_path):
    file_path = tmp_path / "jpk.xml"
    file_path.write_text(
        """
        <JPK xmlns="http://example.com/jpk">
          <SprzedazWiersz>
            <DowodSprzedazy>FS/10/04/2026</DowodSprzedazy>
            <NazwaKontrahenta>Klient Test</NazwaKontrahenta>
            <NrKontrahenta>1234567890</NrKontrahenta>
            <Netto>100.00</Netto>
            <PodatekNaliczony>23.00</PodatekNaliczony>
          </SprzedazWiersz>
        </JPK>
        """.strip(),
        encoding="utf-8",
    )

    connector = JpkXmlConnector()
    preview = connector.preview(file_path)
    result = connector.load(file_path)

    assert preview.xml_root == "JPK"
    assert preview.namespaces["default"] == "http://example.com/jpk"
    assert result.row_count == 1
    assert result.records[0].document_number == "FS/10/04/2026"

