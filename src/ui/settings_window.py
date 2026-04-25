from __future__ import annotations

from pathlib import Path

from PySide6.QtWidgets import QCheckBox, QDialog, QFormLayout, QLineEdit, QPushButton, QVBoxLayout

from src.storage.settings_store import SettingsStore


class SettingsWindow(QDialog):
    def __init__(self, store_path: Path, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Ustawienia")
        self.store = SettingsStore(store_path)
        current = self.store.load_settings()

        layout = QVBoxLayout(self)
        form = QFormLayout()

        self.vat_accounts = QLineEdit(",".join(current.get("vat_accounts", [])))
        self.financial_cost_accounts = QLineEdit(",".join(current.get("financial_cost_accounts", [])))
        self.public_accounts = QLineEdit(",".join(current.get("public_accounts", [])))
        self.enforce_jpk = QCheckBox()
        self.enforce_jpk.setChecked(bool(current.get("enforce_jpk")))

        form.addRow("Konta VAT", self.vat_accounts)
        form.addRow("Konta kosztow finansowych", self.financial_cost_accounts)
        form.addRow("Konta US/ZUS", self.public_accounts)
        form.addRow("Kontrola JPK_KR_PD", self.enforce_jpk)
        layout.addLayout(form)

        save_button = QPushButton("Zapisz")
        save_button.clicked.connect(self._save)
        layout.addWidget(save_button)

    def _save(self) -> None:
        payload = {
            "vat_accounts": self._split_csv(self.vat_accounts.text()),
            "financial_cost_accounts": self._split_csv(self.financial_cost_accounts.text()),
            "public_accounts": self._split_csv(self.public_accounts.text()),
            "enforce_jpk": self.enforce_jpk.isChecked(),
        }
        self.store.save_settings(payload)
        self.accept()

    @staticmethod
    def _split_csv(value: str) -> list[str]:
        return [item.strip() for item in value.split(",") if item.strip()]

