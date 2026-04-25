from __future__ import annotations

from PySide6.QtWidgets import QTextBrowser


class ReportViewer(QTextBrowser):
    def set_report_html(self, html: str) -> None:
        self.setHtml(html)

