from __future__ import annotations

from xml.etree.ElementTree import Element, SubElement, tostring

from src.core.models import SchemaDraft


class OptimaXmlTemplateGenerator:
    def build_preview_xml(self, draft: SchemaDraft) -> str:
        root = Element("OptimaSchemaPreview", attrib={"importable": "false"})
        SubElement(root, "Name").text = draft.name
        if draft.condition:
            SubElement(root, "Condition").text = draft.condition
        lines_node = SubElement(root, "Lines")
        for line in draft.lines:
            line_node = SubElement(lines_node, "Line", attrib={"side": line.side})
            SubElement(line_node, "Account").text = line.account or ""
            SubElement(line_node, "AmountExpression").text = line.amount_expression or ""
            SubElement(line_node, "Description").text = line.description or ""
        warnings_node = SubElement(root, "Warnings")
        for warning in draft.warnings:
            SubElement(warnings_node, "Warning").text = warning
        return tostring(root, encoding="unicode")

