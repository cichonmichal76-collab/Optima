from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook

from src.core.models import AuditRunResult


class XlsxReportExporter:
    def export(self, result: AuditRunResult, file_path: Path) -> Path:
        workbook = Workbook()
        summary_sheet = workbook.active
        summary_sheet.title = "Podsumowanie"
        summary_sheet.append(["Pole", "Wartosc"])
        for key, value in result.summary.items():
            summary_sheet.append([key, value])

        issues_sheet = workbook.create_sheet("Wyniki")
        issues_sheet.append(
            [
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
        )
        for issue in result.issues:
            issues_sheet.append(
                [
                    str(issue.level),
                    issue.area,
                    issue.source_file or "",
                    issue.document_number or "",
                    issue.contractor or "",
                    str(issue.date or ""),
                    issue.issue,
                    issue.recommendation,
                    issue.confidence,
                    issue.raw_row_index or "",
                ]
            )

        workbook.save(file_path)
        return file_path
