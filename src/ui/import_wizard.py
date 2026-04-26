from __future__ import annotations

from pathlib import Path

from PySide6.QtWidgets import (
    QComboBox,
    QDialog,
    QFileDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTextEdit,
    QVBoxLayout,
)

from src.connectors.base import FormatDetector
from src.connectors.csv_connector import CsvConnector
from src.connectors.jpk_xml_connector import JpkXmlConnector
from src.connectors.optima_document_xml_connector import OptimaDocumentXmlConnector
from src.connectors.optima_schema_xml_connector import OptimaSchemaXmlConnector
from src.connectors.xlsx_connector import XlsxConnector
from src.core.enums import DataKind, FormatKind
from src.core.models import ImportResult, MappingProfile
from src.ui.column_mapping_dialog import ColumnMappingDialog


class ImportWizard(QDialog):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Kreator importu")
        self.resize(760, 520)
        self.import_result: ImportResult | None = None

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("Krok 1: wybierz typ danych i plik do analizy."))

        self.kind_combo = QComboBox()
        for data_kind in DataKind:
            if data_kind != DataKind.UNKNOWN:
                self.kind_combo.addItem(data_kind.value, data_kind)
        layout.addWidget(self.kind_combo)

        file_row = QHBoxLayout()
        self.file_edit = QLineEdit()
        browse_button = QPushButton("Wybierz plik")
        browse_button.clicked.connect(self._browse_file)
        file_row.addWidget(self.file_edit)
        file_row.addWidget(browse_button)
        layout.addLayout(file_row)

        preview_button = QPushButton("Podgląd i mapowanie")
        preview_button.clicked.connect(self._preview_and_map)
        layout.addWidget(preview_button)

        self.preview_box = QTextEdit()
        self.preview_box.setReadOnly(True)
        layout.addWidget(self.preview_box)

        import_button = QPushButton("Załaduj dane")
        import_button.clicked.connect(self._load_import)
        layout.addWidget(import_button)

    def _browse_file(self) -> None:
        file_name, _ = QFileDialog.getOpenFileName(self, "Wybierz plik")
        if file_name:
            self.file_edit.setText(file_name)

    def _preview_and_map(self) -> None:
        file_path = Path(self.file_edit.text())
        if not file_path.exists():
            QMessageBox.warning(self, "Brak pliku", "Wybierz poprawny plik do analizy.")
            return

        data_kind = self.kind_combo.currentData()
        connector = self._connector_for(file_path, data_kind)
        preview = connector.preview(file_path)
        lines = [
            f"Format: {preview.detected_format}",
            f"Headers: {', '.join(preview.headers)}",
            f"Notes: {' | '.join(preview.notes)}",
        ]
        for row in preview.preview_rows[:5]:
            lines.append(str(row))
        self.preview_box.setPlainText("\n".join(lines))

        if preview.headers and preview.detected_format in {FormatKind.CSV, FormatKind.XLS, FormatKind.XLSX}:
            dialog = ColumnMappingDialog(preview.headers, data_kind, self)
            if dialog.exec():
                self._mapping = MappingProfile(name="ad_hoc", data_kind=data_kind, column_map=dialog.mapping())
            else:
                self._mapping = None
        else:
            self._mapping = None

    def _load_import(self) -> None:
        file_path = Path(self.file_edit.text())
        if not file_path.exists():
            QMessageBox.warning(self, "Brak pliku", "Wybierz poprawny plik do importu.")
            return
        data_kind = self.kind_combo.currentData()
        connector = self._connector_for(file_path, data_kind)
        self.import_result = connector.load(file_path, getattr(self, "_mapping", None))
        self.accept()

    @staticmethod
    def _connector_for(file_path: Path, data_kind: DataKind):
        detected = FormatDetector.detect(file_path)
        if detected.format in {FormatKind.XLSX, FormatKind.XLS}:
            return XlsxConnector(data_kind=data_kind)
        if detected.format == FormatKind.CSV:
            return CsvConnector(data_kind=data_kind)
        if data_kind == DataKind.JPK_XML:
            return JpkXmlConnector()
        if data_kind == DataKind.OPTIMA_SCHEMA_XML:
            return OptimaSchemaXmlConnector()
        return OptimaDocumentXmlConnector()
