import { TEMPLATES } from "./config.js";

export function generateSchemaDraft(templateId) {
  const template = TEMPLATES[templateId];
  return {
    name: template.name,
    condition: template.condition,
    lines: template.lines.map(([side, account, amountExpression, description]) => ({ side, account, amountExpression, description })),
    warnings: ["Koniecznie przetestuj schemat w bazie DEMO."],
  };
}

