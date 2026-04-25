from __future__ import annotations

from PySide6.QtWidgets import QComboBox, QDialog, QFormLayout, QHBoxLayout, QLabel, QPushButton, QVBoxLayout

from src.core.enums import DataKind
from src.mapping.column_mapper import ColumnMapper


class ColumnMappingDialog(QDialog):
    def __init__(self, headers: list[str], data_kind: DataKind, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Mapowanie kolumn")
        self.headers = headers
        self.data_kind = data_kind
        self.mapper = ColumnMapper()
        self.comboboxes: dict[str, QComboBox] = {}

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("Lewy panel reprezentuje pola wymagane przez aplikacje."))

        form_layout = QFormLayout()
        suggested = self.mapper.auto_map(headers, data_kind)
        for field_name in self.mapper.fields_for_kind(data_kind):
            combo = QComboBox()
            combo.addItem("")
            combo.addItems(headers)
            if field_name in suggested:
                combo.setCurrentText(suggested[field_name])
            self.comboboxes[field_name] = combo
            marker = " (wymagane)" if field_name in self.mapper.required_fields_for_kind(data_kind) else ""
            form_layout.addRow(f"{field_name}{marker}", combo)

        layout.addLayout(form_layout)

        buttons = QHBoxLayout()
        save_button = QPushButton("Zapisz")
        cancel_button = QPushButton("Anuluj")
        save_button.clicked.connect(self.accept)
        cancel_button.clicked.connect(self.reject)
        buttons.addWidget(save_button)
        buttons.addWidget(cancel_button)
        layout.addLayout(buttons)

    def mapping(self) -> dict[str, str]:
        result: dict[str, str] = {}
        for field_name, combo in self.comboboxes.items():
            if combo.currentText():
                result[field_name] = combo.currentText()
        return result

