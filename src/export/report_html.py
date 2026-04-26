from __future__ import annotations

from html import escape
from pathlib import Path

from src.core.models import AuditRunResult


class HtmlReportExporter:
    def export(self, result: AuditRunResult, file_path: Path) -> Path:
        rows = []
        for issue in result.issues:
            rows.append(
                "<tr>"
                f"<td>{escape(str(issue.level))}</td>"
                f"<td>{escape(issue.area)}</td>"
                f"<td>{escape(issue.source_file or '')}</td>"
                f"<td>{escape(issue.document_number or '')}</td>"
                f"<td>{escape(issue.contractor or '')}</td>"
                f"<td>{escape(str(issue.date or ''))}</td>"
                f"<td>{escape(issue.issue)}</td>"
                f"<td>{escape(issue.recommendation)}</td>"
                f"<td>{issue.confidence:.2f}</td>"
                "</tr>"
            )

        summary_lines = "".join(
            f"<li><strong>{escape(str(key))}</strong>: {escape(str(value))}</li>"
            for key, value in result.summary.items()
        )
        html = f"""
<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <title>Raport audytu Optima</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }}
    h1, h2 {{ color: #0f172a; }}
    .note {{ padding: 12px; border-left: 4px solid #f59e0b; background: #fffbeb; margin-bottom: 24px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }}
    th {{ background: #eff6ff; text-align: left; }}
    ul {{ padding-left: 18px; }}
  </style>
</head>
<body>
  <h1>Raport audytu Optima</h1>
  <div class="note">Wyniki wymagaj? weryfikacji przez osob? odpowiedzialn? za ksi?gowo??.</div>
  <h2>Podsumowanie</h2>
  <ul>{summary_lines}</ul>
  <h2>Wyniki</h2>
  <table>
    <thead>
      <tr>
        <th>Poziom</th>
        <th>Obszar</th>
        <th>Plik</th>
        <th>Dokument</th>
        <th>Kontrahent</th>
        <th>Data</th>
        <th>Problem</th>
        <th>Rekomendacja</th>
        <th>Pewno??</th>
      </tr>
    </thead>
    <tbody>
      {''.join(rows)}
    </tbody>
  </table>
</body>
</html>
"""
        file_path.write_text(html.strip(), encoding="utf-8")
        return file_path

