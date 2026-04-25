from __future__ import annotations

from PySide6.QtWidgets import QFormLayout, QLabel, QWidget


class AuditDashboard(QWidget):
    def __init__(self) -> None:
        super().__init__()
        self.layout = QFormLayout(self)
        self.labels: dict[str, QLabel] = {}
        for key in [
            "critical_count",
            "warning_count",
            "info_count",
            "document_count",
            "contractor_count",
            "net_total",
            "vat_total",
            "gross_total",
        ]:
            label = QLabel("-")
            self.labels[key] = label
            self.layout.addRow(key, label)

    def set_summary(self, summary: dict[str, object]) -> None:
        for key, label in self.labels.items():
            label.setText(str(summary.get(key, "-")))

