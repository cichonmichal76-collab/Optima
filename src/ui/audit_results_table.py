from __future__ import annotations

from PySide6.QtWidgets import QTableWidget, QTableWidgetItem

from src.core.models import AuditIssue


class AuditResultsTable(QTableWidget):
    headers = [
        "Poziom",
        "Obszar",
        "Plik",
        "Dokument",
        "Kontrahent",
        "Data",
        "Problem",
        "Rekomendacja",
        "Pewnosc",
        "Indeks wiersza",
    ]

    def __init__(self) -> None:
        super().__init__(0, len(self.headers))
        self.setHorizontalHeaderLabels(self.headers)

    def set_issues(self, issues: list[AuditIssue]) -> None:
        self.setRowCount(len(issues))
        for row_index, issue in enumerate(issues):
            values = [
                str(issue.level),
                issue.area,
                issue.source_file or "",
                issue.document_number or "",
                issue.contractor or "",
                str(issue.date or ""),
                issue.issue,
                issue.recommendation,
                f"{issue.confidence:.2f}",
                str(issue.raw_row_index or ""),
            ]
            for column_index, value in enumerate(values):
                self.setItem(row_index, column_index, QTableWidgetItem(value))
        self.resizeColumnsToContents()

