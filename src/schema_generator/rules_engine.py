from __future__ import annotations

from copy import deepcopy
from typing import Any

from src.core.models import SchemaDraft, SchemaDraftLine
from src.schema_generator.template_library import TemplateLibrary


class SchemaRulesEngine:
    def __init__(self, template_library: TemplateLibrary | None = None) -> None:
        self.template_library = template_library or TemplateLibrary()

    def generate(self, template_id: str, values: dict[str, Any] | None = None) -> SchemaDraft:
        values = values or {}
        template = deepcopy(self.template_library.get_template(template_id))
        lines = [
            SchemaDraftLine(
                side=item["side"],
                account=self._render(item.get("account"), values),
                amount_expression=self._render(item.get("amount_expression"), values),
                description=self._render(item.get("description"), values),
            )
            for item in template.get("lines", [])
        ]
        warnings = [self._render(item, values) or "" for item in template.get("warnings", [])]
        return SchemaDraft(
            name=self._render(template.get("name"), values) or template_id,
            template_id=template_id,
            condition=self._render(template.get("condition"), values),
            warnings=warnings + ["Koniecznie przetestuj schemat w bazie DEMO."],
            lines=lines,
        )

    @staticmethod
    def _render(value: str | None, values: dict[str, Any]) -> str | None:
        if value is None:
            return None
        rendered = value
        for key, replacement in values.items():
            rendered = rendered.replace(f"{{{{{key}}}}}", str(replacement))
        return rendered

