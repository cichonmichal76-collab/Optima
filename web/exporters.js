import { download, escapeHtml } from "./utils.js";

export function exportJson(reportJson) {
  download("optima-audit-report.json", "application/json", reportJson);
}

export function exportHtml(issues) {
  const rows = issues.map((issue) => (
    `<tr><td>${escapeHtml(issue.level)}</td><td>${escapeHtml(issue.area)}</td><td>${escapeHtml(issue.document)}</td><td>${escapeHtml(issue.contractor)}</td><td>${escapeHtml(issue.issue)}</td><td>${escapeHtml(issue.recommendation)}</td></tr>`
  )).join("");
  const html = `<!doctype html><meta charset="utf-8"><title>Raport audytu</title><h1>Raport audytu Optima</h1><p>Wyniki wymagaja weryfikacji przez osobe odpowiedzialna za ksiegowosc.</p><table border="1" cellspacing="0" cellpadding="6"><tr><th>Poziom</th><th>Obszar</th><th>Dokument</th><th>Kontrahent</th><th>Problem</th><th>Rekomendacja</th></tr>${rows}</table>`;
  download("optima-audit-report.html", "text/html", html);
}

export function exportExcel(tableHtml) {
  download("optima-audit-report.xls", "application/vnd.ms-excel", tableHtml);
}

