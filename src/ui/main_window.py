from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from PySide6.QtWidgets import (
    QFileDialog,
    QHBoxLayout,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSplitter,
    QVBoxLayout,
    QWidget,
)

from src.audit.audit_engine import AuditEngine
from src.core.enums import DataKind
from src.export.report_html import HtmlReportExporter
from src.export.report_json import JsonReportExporter
from src.export.report_xlsx import XlsxReportExporter
from src.ui.audit_dashboard import AuditDashboard
from src.ui.audit_results_table import AuditResultsTable
from src.ui.import_wizard import ImportWizard
from src.ui.report_viewer import ReportViewer
from src.ui.schema_wizard import SchemaWizard
from src.ui.settings_window import SettingsWindow
from src.storage.settings_store import SettingsStore


class MainWindow(QMainWindow):
    def __init__(self, project_root: Path) -> None:
        super().__init__()
        self.project_root = project_root
        self.setWindowTitle("Optima Audit GUI MVP")
        self.resize(1180, 760)
        self.audit_engine = AuditEngine()
        self.settings_store = SettingsStore(project_root / "data" / "sample_profiles.json")
        self.current_result = None

        central = QWidget()
        self.setCentralWidget(central)
        root_layout = QVBoxLayout(central)

        buttons = QHBoxLayout()
        new_audit_button = QPushButton("Nowy audyt")
        new_audit_button.clicked.connect(self._start_audit)
        schema_button = QPushButton("Generator schematu")
        schema_button.clicked.connect(self._open_schema_wizard)
        open_button = QPushButton("OtwÃ³rz zapisany audyt")
        open_button.clicked.connect(self._open_saved_report)
        settings_button = QPushButton("Ustawienia")
        settings_button.clicked.connect(self._open_settings)
        export_json_button = QPushButton("Eksport JSON")
        export_json_button.clicked.connect(lambda: self._export_report("json"))
        export_html_button = QPushButton("Eksport HTML")
        export_html_button.clicked.connect(lambda: self._export_report("html"))
        export_xlsx_button = QPushButton("Eksport XLSX")
        export_xlsx_button.clicked.connect(lambda: self._export_report("xlsx"))
        for button in [
            new_audit_button,
            schema_button,
            open_button,
            settings_button,
            export_json_button,
            export_html_button,
            export_xlsx_button,
        ]:
            buttons.addWidget(button)
        root_layout.addLayout(buttons)

        splitter = QSplitter()
        self.dashboard = AuditDashboard()
        self.table = AuditResultsTable()
        self.report_viewer = ReportViewer()
        splitter.addWidget(self.dashboard)
        splitter.addWidget(self.table)
        splitter.addWidget(self.report_viewer)
        root_layout.addWidget(splitter)

    def _start_audit(self) -> None:
        dialog = ImportWizard(self)
        if not dialog.exec() or not dialog.import_result:
            return
        import_result = dialog.import_result
        settings = self.settings_store.load_settings()
        if import_result.data_kind in {DataKind.VAT_PURCHASE, DataKind.VAT_SALE}:
            result = self.audit_engine.run(vat_records=import_result.records, options=settings)
        elif import_result.data_kind == DataKind.LEDGER:
            result = self.audit_engine.run(ledger_records=import_result.records, options=settings)
        elif import_result.data_kind == DataKind.ACCOUNT_PLAN:
            result = self.audit_engine.run(account_records=import_result.records, options=settings)
        elif import_result.data_kind in {DataKind.SETTLEMENTS, DataKind.BANK}:
            result = self.audit_engine.run(settlement_records=import_result.records, bank_records=import_result.records, options=settings)
        elif import_result.data_kind == DataKind.JPK_XML:
            result = self.audit_engine.run(jpk_records=import_result.records, options=settings)
        else:
            QMessageBox.information(self, "Import", "Plik zosta? za?adowany do podgl?du technicznego.")
            return

        self.current_result = result
        self.dashboard.set_summary(result.summary)
        self.table.set_issues(result.issues)
        with TemporaryDirectory() as temp_dir:
            html_path = Path(temp_dir) / "report.html"
            HtmlReportExporter().export(result, html_path)
            self.report_viewer.set_report_html(html_path.read_text(encoding="utf-8"))

    def _open_schema_wizard(self) -> None:
        SchemaWizard(self).exec()

    def _open_settings(self) -> None:
        SettingsWindow(self.project_root / "data" / "sample_profiles.json", self).exec()

    def _open_saved_report(self) -> None:
        file_name, _ = QFileDialog.getOpenFileName(self, "Wybierz raport HTML", str(self.project_root / "exports"), "HTML (*.html)")
        if file_name:
            self.report_viewer.set_report_html(Path(file_name).read_text(encoding="utf-8"))

    def _export_report(self, file_type: str) -> None:
        if not self.current_result:
            QMessageBox.warning(self, "Brak danych", "Najpierw wykonaj audyt.")
            return

        target, _ = QFileDialog.getSaveFileName(self, "Zapisz raport", str(self.project_root / "exports"))
        if not target:
            return

        path = Path(target)
        if file_type == "json":
            JsonReportExporter().export(self.current_result, path.with_suffix(".json"))
        elif file_type == "html":
            HtmlReportExporter().export(self.current_result, path.with_suffix(".html"))
        else:
            XlsxReportExporter().export(self.current_result, path.with_suffix(".xlsx"))
        QMessageBox.information(self, "Eksport", "Raport zosta? zapisany.")

