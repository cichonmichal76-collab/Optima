from __future__ import annotations

import json
from pathlib import Path

from src.core.models import AuditRunResult


class JsonReportExporter:
    def export(self, result: AuditRunResult, file_path: Path) -> Path:
        payload = {
            "summary": result.summary,
            "issues": [issue.model_dump(mode="json") for issue in result.issues],
        }
        file_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        return file_path

