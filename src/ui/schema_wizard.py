from __future__ import annotations

from PySide6.QtWidgets import QComboBox, QDialog, QLabel, QPushButton, QTextEdit, QVBoxLayout

from src.schema_generator.optima_xml_template_generator import OptimaXmlTemplateGenerator
from src.schema_generator.rules_engine import SchemaRulesEngine
from src.schema_generator.template_library import TemplateLibrary
from src.schema_generator.schema_validator import SchemaValidator


class SchemaWizard(QDialog):
    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.setWindowTitle("Generator schematu")
        self.resize(720, 540)
        self.template_library = TemplateLibrary()
        self.rules_engine = SchemaRulesEngine(self.template_library)
        self.validator = SchemaValidator()
        self.xml_generator = OptimaXmlTemplateGenerator()

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("Wybierz wzorzec schematu ksiÄgowego."))

        self.template_combo = QComboBox()
        for item in self.template_library.list_templates():
            self.template_combo.addItem(item["name"], item["id"])
        layout.addWidget(self.template_combo)

        generate_button = QPushButton("Generuj projekt")
        generate_button.clicked.connect(self._generate)
        layout.addWidget(generate_button)

        self.output = QTextEdit()
        self.output.setReadOnly(True)
        layout.addWidget(self.output)

    def _generate(self) -> None:
        draft = self.rules_engine.generate(self.template_combo.currentData())
        issues = self.validator.validate(draft)
        preview_xml = self.xml_generator.build_preview_xml(draft)
        text = [
            f"Nazwa: {draft.name}",
            f"Warunek: {draft.condition}",
            "Linie:",
        ]
        for line in draft.lines:
            text.append(f"- {line.side} | {line.account} | {line.amount_expression} | {line.description}")
        text.append("")
        text.append("Walidacja:")
        for issue in issues:
            text.append(f"- {issue.level}: {issue.issue}")
        text.append("")
        text.append("PodglÄd XML:")
        text.append(preview_xml)
        self.output.setPlainText("\n".join(text))

