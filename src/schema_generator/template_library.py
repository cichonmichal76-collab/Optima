from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DEFAULT_TEMPLATES: dict[str, dict[str, Any]] = {
    "FZ_VAT_100": {
        "name": "FZ koszt VAT 100%",
        "condition": "document_type == 'FZ'",
        "warnings": ["Przetestuj projekt schematu w bazie DEMO przed wdrożeniem."],
        "lines": [
            {"side": "WN", "account": "{{cost_account}}", "amount_expression": "net", "description": "Koszt netto"},
            {"side": "WN", "account": "{{vat_account}}", "amount_expression": "vat", "description": "VAT naliczony"},
            {"side": "MA", "account": "{{supplier_account}}", "amount_expression": "gross", "description": "Rozrachunek z dostawcą"},
        ],
    },
    "FZ_PALIWO_50": {
        "name": "FZ paliwo VAT 50%",
        "condition": "document_type == 'FZ' and category == 'PALIWO'",
        "warnings": ["Zweryfikuj podział VAT odliczonego i nieodliczonego."],
        "lines": [
            {"side": "WN", "account": "{{fuel_account}}", "amount_expression": "net + vat_nondeductible", "description": "Koszt paliwa"},
            {"side": "WN", "account": "{{vat_account}}", "amount_expression": "vat_deductible", "description": "VAT odliczalny"},
            {"side": "MA", "account": "{{supplier_account}}", "amount_expression": "gross", "description": "Rozrachunek z dostawcą"},
        ],
    },
    "FZ_BEZ_VAT": {
        "name": "FZ bez VAT",
        "condition": "document_type == 'FZ' and vat == 0",
        "warnings": ["Zweryfikuj podstawę zwolnienia lub NP."],
        "lines": [
            {"side": "WN", "account": "{{cost_account}}", "amount_expression": "gross", "description": "Koszt brutto"},
            {"side": "MA", "account": "{{supplier_account}}", "amount_expression": "gross", "description": "Rozrachunek z dostawcą"},
        ],
    },
    "FS_23": {
        "name": "FS sprzedaż krajowa 23%",
        "condition": "document_type == 'FS' and vat_rate == '23%'",
        "warnings": ["Zweryfikuj konta przychodowe oraz konto VAT należnego."],
        "lines": [
            {"side": "WN", "account": "{{customer_account}}", "amount_expression": "gross", "description": "Należność od odbiorcy"},
            {"side": "MA", "account": "{{revenue_account}}", "amount_expression": "net", "description": "Przychód"},
            {"side": "MA", "account": "{{vat_due_account}}", "amount_expression": "vat", "description": "VAT należny"},
        ],
    },
    "WB_BANK_FEE": {
        "name": "WB opłata bankowa",
        "condition": "document_type == 'WB' and kind == 'BANK_FEE'",
        "warnings": ["Zweryfikuj konto kosztów finansowych."],
        "lines": [
            {"side": "WN", "account": "{{financial_cost_account}}", "amount_expression": "amount", "description": "Koszt bankowy"},
            {"side": "MA", "account": "{{bank_account}}", "amount_expression": "amount", "description": "Rachunek bankowy"},
        ],
    },
    "AMORT": {
        "name": "AMORT amortyzacja",
        "condition": "document_type == 'AMORT'",
        "warnings": ["Zweryfikuj konto umorzenia i rodzaj środka trwałego."],
        "lines": [
            {"side": "WN", "account": "{{depreciation_cost_account}}", "amount_expression": "amount", "description": "Koszt amortyzacji"},
            {"side": "MA", "account": "{{accumulated_depreciation_account}}", "amount_expression": "amount", "description": "Umorzenie"},
        ],
    },
    "LP": {
        "name": "LP lista płac podstawowa",
        "condition": "document_type == 'LP'",
        "warnings": ["Zweryfikuj konta wynagrodzeń, ZUS i podatku."],
        "lines": [
            {"side": "WN", "account": "{{salary_cost_account}}", "amount_expression": "gross_salary", "description": "Koszt wynagrodzeń"},
            {"side": "MA", "account": "{{employee_liability_account}}", "amount_expression": "net_salary", "description": "Wypłata netto"},
            {"side": "MA", "account": "{{tax_liability_account}}", "amount_expression": "tax", "description": "Podatek"},
            {"side": "MA", "account": "{{social_security_account}}", "amount_expression": "social_security", "description": "ZUS"},
        ],
    },
}


class TemplateLibrary:
    def __init__(self, data_file: Path | None = None) -> None:
        self.data_file = data_file or Path(__file__).resolve().parents[2] / "data" / "templates.json"

    def load(self) -> dict[str, dict[str, Any]]:
        if self.data_file.exists():
            return json.loads(self.data_file.read_text(encoding="utf-8"))
        return DEFAULT_TEMPLATES

    def list_templates(self) -> list[dict[str, str]]:
        templates = self.load()
        return [{"id": key, "name": value["name"]} for key, value in templates.items()]

    def get_template(self, template_id: str) -> dict[str, Any]:
        templates = self.load()
        if template_id not in templates:
            raise KeyError(f"Nieznany template: {template_id}")
        return templates[template_id]
