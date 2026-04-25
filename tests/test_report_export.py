from __future__ import annotations

import json
from datetime import date

from openpyxl import load_workbook

from src.core.models import AuditIssue, AuditRunResult
from src.export.report_html import HtmlReportExporter
from src.export.report_json import JsonReportExporter
from src.export.report_xlsx import XlsxReportExporter


def test_report_exporters_create_expected_outputs(tmp_path):
    result = AuditRunResult(
        issues=[
            AuditIssue(
                level="WARNING",
                area="VAT",
                document_number="FS/1",
                contractor="Acme",
                date=date(2026, 4, 25),
                issue_code="VAT_DUPLICATE",
                issue="Duplikat faktury.",
                recommendation="Zweryfikuj eksport.",
            )
        ],
        summary={
            "critical_count": 0,
            "warning_count": 1,
            "info_count": 0,
            "document_count": 1,
            "contractor_count": 1,
            "net_total": "100.00",
            "vat_total": "23.00",
            "gross_total": "123.00",
        },
    )

    json_path = JsonReportExporter().export(result, tmp_path / "report.json")
    html_path = HtmlReportExporter().export(result, tmp_path / "report.html")
    xlsx_path = XlsxReportExporter().export(result, tmp_path / "report.xlsx")

    payload = json.loads(json_path.read_text(encoding="utf-8"))
    assert payload["issues"][0]["issue_code"] == "VAT_DUPLICATE"

    html = html_path.read_text(encoding="utf-8")
    assert "Podsumowanie" in html
    assert "Duplikat faktury." in html

    workbook = load_workbook(xlsx_path)
    sheet = workbook["Wyniki"]
    headers = [cell.value for cell in sheet[1]]
    assert headers == [
        "poziom",
        "obszar",
        "plik",
        "dokument",
        "kontrahent",
        "data",
        "problem",
        "rekomendacja",
        "pewnosc",
        "indeks_wiersza",
    ]
