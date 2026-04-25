from __future__ import annotations

import json
import mimetypes
from email import policy
from email.parser import BytesParser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import pandas as pd

from src.connectors.optima_backup import inspect_backup, restore_backup, scan_backup_files
from src.connectors.optima_data_catalog import build_available_data_sql, build_module_query
from src.connectors.optima_report_queries import build_report_query
from src.connectors.optima_sql_mapping import build_optima_sql_query
from src.connectors.optima_sql_runner import SqlcmdConfig, run_sqlcmd_table
from src.core.enums import DataKind


HOST = "127.0.0.1"
PORT = 8000
ROOT = Path(__file__).resolve().parent
MAX_ROWS = 5000
MAX_SQL_ROWS = 100000
SQL_KINDS = {DataKind.VAT_PURCHASE, DataKind.VAT_SALE, DataKind.LEDGER, DataKind.ACCOUNT_PLAN}


class OptimaRequestHandler(SimpleHTTPRequestHandler):
    server_version = "OptimaLocalServer/0.1"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self) -> None:
        if self.path == "/api/preview":
            self._handle_preview()
            return
        if self.path == "/api/sql-preview":
            self._handle_sql_preview()
            return
        if self.path == "/api/module-preview":
            self._handle_module_preview()
            return
        if self.path == "/api/available-data":
            self._handle_available_data()
            return
        if self.path == "/api/report-data":
            self._handle_report_data()
            return
        if self.path == "/api/backup-info":
            self._handle_backup_info()
            return
        if self.path == "/api/connect-backup":
            self._handle_connect_backup()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/backups":
            query = parse_qs(parsed.query)
            roots = query.get("root") or query.get("directory") or None
            self._send_json({"backups": scan_backup_files(roots)})
            return
        if parsed.path == "/api/databases":
            query = parse_qs(parsed.query)
            server = (query.get("server") or [r".\SQLEXPRESS02"])[0]
            try:
                self._send_json({"databases": list_optima_databases(server)})
            except Exception as exc:  # noqa: BLE001 - local server returns user-facing errors.
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return
        if parsed.path == "/api/years":
            query = parse_qs(parsed.query)
            server = (query.get("server") or [r".\SQLEXPRESS02"])[0]
            database = (query.get("database") or [""])[0]
            try:
                self._send_json({"years": list_available_years(server, database)})
            except Exception as exc:  # noqa: BLE001 - local server returns user-facing errors.
                self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
            return
        super().do_GET()

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def guess_type(self, path: str) -> str:
        mime_type, _ = mimetypes.guess_type(path)
        if path.endswith(".js"):
            return "text/javascript; charset=utf-8"
        if path.endswith(".css"):
            return "text/css; charset=utf-8"
        if path.endswith(".html"):
            return "text/html; charset=utf-8"
        return mime_type or "application/octet-stream"

    def _handle_preview(self) -> None:
        try:
            file_name, content = self._read_multipart_file()
            payload = parse_spreadsheet(file_name, content)
            self._send_json(payload)
        except Exception as exc:  # noqa: BLE001 - local server returns user-facing errors.
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _handle_sql_preview(self) -> None:
        try:
            payload = self._read_json_body()
            response = load_sql_preview(payload)
            self._send_json(response)
        except Exception as exc:  # noqa: BLE001 - local server returns user-facing errors.
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _handle_module_preview(self) -> None:
        try:
            payload = self._read_json_body()
            response = load_module_preview(payload)
            self._send_json(response)
        except Exception as exc:  # noqa: BLE001 - local server returns user-facing errors.
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _handle_available_data(self) -> None:
        try:
            payload = self._read_json_body()
            response = available_data(payload)
            self._send_json(response)
        except Exception as exc:  # noqa: BLE001 - local server returns user-facing errors.
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _handle_report_data(self) -> None:
        try:
            payload = self._read_json_body()
            response = report_data(payload)
            self._send_json(response)
        except Exception as exc:  # noqa: BLE001 - local server returns user-facing errors.
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _handle_backup_info(self) -> None:
        try:
            payload = self._read_json_body()
            response = inspect_backup(
                str(payload.get("path") or ""),
                server=str(payload.get("server") or r".\SQLEXPRESS02"),
                sqlcmd_path=str(payload.get("sqlcmd") or "").strip() or None,
            )
            self._send_json(response)
        except Exception as exc:  # noqa: BLE001 - local server returns user-facing errors.
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _handle_connect_backup(self) -> None:
        try:
            payload = self._read_json_body()
            response = restore_backup(
                str(payload.get("path") or ""),
                server=str(payload.get("server") or r".\SQLEXPRESS02"),
                target_database=str(payload.get("target_database") or "").strip() or None,
                sqlcmd_path=str(payload.get("sqlcmd") or "").strip() or None,
            )
            self._send_json(response)
        except Exception as exc:  # noqa: BLE001 - local server returns user-facing errors.
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def _read_multipart_file(self) -> tuple[str, bytes]:
        content_type = self.headers.get("Content-Type", "")
        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length)
        message = BytesParser(policy=policy.default).parsebytes(
            f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
        )

        for part in message.iter_parts():
            if part.get_param("name", header="content-disposition") != "file":
                continue
            file_name = part.get_filename() or "upload"
            return file_name, part.get_payload(decode=True) or b""

        raise ValueError("Nie znaleziono pliku w przeslanym formularzu.")

    def _read_json_body(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length)
        if not body:
            return {}
        return json.loads(body.decode("utf-8"))

    def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def parse_spreadsheet(file_name: str, content: bytes) -> dict[str, Any]:
    suffix = Path(file_name).suffix.lower()
    if suffix not in {".xls", ".xlsx"}:
        raise ValueError("Endpoint /api/preview obsluguje tylko XLS i XLSX.")

    workbook = pd.read_excel(BytesIO(content), sheet_name=None, dtype=str, keep_default_na=False)
    if not workbook:
        return {"format": suffix[1:].upper(), "headers": [], "rows": [], "notes": ["Plik nie zawiera arkuszy."]}

    notes: list[str] = []
    selected_name = next(iter(workbook.keys()))
    selected_frame = workbook[selected_name]

    for sheet_name, frame in workbook.items():
        non_empty = frame.dropna(how="all")
        if not non_empty.empty:
            selected_name = sheet_name
            selected_frame = non_empty
            break

    if len(workbook) > 1:
        notes.append(f"Uzyto arkusza: {selected_name}")

    frame = selected_frame.fillna("")
    if len(frame) > MAX_ROWS:
        notes.append(f"Wczytano pierwsze {MAX_ROWS} wierszy z {len(frame)}.")
        frame = frame.head(MAX_ROWS)

    headers = [str(column) for column in frame.columns]
    rows = [
        {str(key): normalize_cell(value) for key, value in row.items()}
        for row in frame.to_dict(orient="records")
    ]
    return {"format": suffix[1:].upper(), "headers": headers, "rows": rows, "notes": notes}


def load_sql_preview(payload: dict[str, Any]) -> dict[str, Any]:
    data_kind = DataKind(payload.get("kind") or "")
    if data_kind not in SQL_KINDS:
        raise ValueError("SQL obsługuje teraz: VAT zakup, VAT sprzedaż, zapisy księgowe i plan kont.")

    server = str(payload.get("server") or r".\SQLEXPRESS02").strip()
    database = str(payload.get("database") or "OptimaAudit_Firma_202603").strip()
    period = payload.get("period") if data_kind != DataKind.ACCOUNT_PLAN else None
    sqlcmd_path = str(payload.get("sqlcmd") or "").strip() or None

    query = build_optima_sql_query(data_kind, period)
    headers, rows = run_sqlcmd_table(query.sql, SqlcmdConfig(server=server, database=database, sqlcmd_path=sqlcmd_path))

    notes = [
        f"Źródło SQL: {server} / {database}",
        *query.notes,
    ]
    if len(rows) > MAX_SQL_ROWS:
        notes.append(f"Wczytano pierwsze {MAX_SQL_ROWS} wierszy z {len(rows)}.")
        rows = rows[:MAX_SQL_ROWS]

    return {
        "format": "SQL",
        "headers": headers,
        "rows": rows,
        "notes": notes,
        "source": {
            "server": server,
            "database": database,
            "kind": data_kind.value,
            "period": period,
        },
    }


def load_module_preview(payload: dict[str, Any]) -> dict[str, Any]:
    module_code = str(payload.get("module") or payload.get("kind") or "").strip()
    server = str(payload.get("server") or r".\SQLEXPRESS02").strip()
    database = str(payload.get("database") or "OptimaAudit_Firma_202603").strip()
    period = payload.get("period")
    year = payload.get("year")
    date_from = str(payload.get("date_from") or "").strip() or None
    date_to = str(payload.get("date_to") or "").strip() or None
    sqlcmd_path = str(payload.get("sqlcmd") or "").strip() or None

    sql, notes = build_module_query(module_code, period, year=year, date_from=date_from, date_to=date_to)
    headers, rows = run_sqlcmd_table(sql, SqlcmdConfig(server=server, database=database, sqlcmd_path=sqlcmd_path))
    if len(rows) > MAX_SQL_ROWS:
        notes = (*notes, f"Wczytano pierwsze {MAX_SQL_ROWS} wierszy z {len(rows)}.")
        rows = rows[:MAX_SQL_ROWS]

    return {
        "format": "SQL",
        "headers": headers,
        "rows": rows,
        "notes": [f"Źródło SQL: {server} / {database}", *notes],
        "source": {
            "server": server,
            "database": database,
            "module": module_code,
            "period": period,
            "year": year,
            "date_from": date_from,
            "date_to": date_to,
        },
    }


def available_data(payload: dict[str, Any]) -> dict[str, Any]:
    server = str(payload.get("server") or r".\SQLEXPRESS02").strip()
    database = str(payload.get("database") or "OptimaAudit_Firma_202603").strip()
    period = payload.get("period")
    year = payload.get("year")
    date_from = str(payload.get("date_from") or "").strip() or None
    date_to = str(payload.get("date_to") or "").strip() or None
    sqlcmd_path = str(payload.get("sqlcmd") or "").strip() or None
    _, rows = run_sqlcmd_table(
        build_available_data_sql(period, year=year, date_from=date_from, date_to=date_to),
        SqlcmdConfig(server=server, database=database, sqlcmd_path=sqlcmd_path),
    )
    return {
        "server": server,
        "database": database,
        "period": period,
        "year": year,
        "date_from": date_from,
        "date_to": date_to,
        "modules": rows,
    }


def report_data(payload: dict[str, Any]) -> dict[str, Any]:
    report_key = str(payload.get("report") or payload.get("report_key") or "").strip()
    server = str(payload.get("server") or r".\SQLEXPRESS02").strip()
    database = str(payload.get("database") or "OptimaAudit_Firma_202603").strip()
    period = payload.get("period")
    year = payload.get("year")
    date_from = str(payload.get("date_from") or "").strip() or None
    date_to = str(payload.get("date_to") or "").strip() or None
    sqlcmd_path = str(payload.get("sqlcmd") or "").strip() or None

    query = build_report_query(report_key, period, year=year, date_from=date_from, date_to=date_to)
    headers, rows = run_sqlcmd_table(query.sql, SqlcmdConfig(server=server, database=database, sqlcmd_path=sqlcmd_path))
    if len(rows) > MAX_SQL_ROWS:
        rows = rows[:MAX_SQL_ROWS]

    return {
        "format": "SQL",
        "headers": headers,
        "rows": rows,
        "notes": [f"Źródło SQL: {server} / {database}", *query.notes],
        "source": {
            "server": server,
            "database": database,
            "report": report_key,
            "period": period,
            "year": year,
            "date_from": date_from,
            "date_to": date_to,
        },
    }


def list_optima_databases(server: str, sqlcmd_path: str | None = None) -> list[dict[str, str]]:
    sql = """
SET NOCOUNT ON;
SELECT TOP (20)
  name AS [Baza],
  CONVERT(varchar(19), create_date, 120) AS [Data utworzenia]
FROM sys.databases
WHERE name LIKE N'OptimaAudit_%'
ORDER BY create_date DESC, name DESC;
"""
    _, rows = run_sqlcmd_table(sql, SqlcmdConfig(server=server, database="master", sqlcmd_path=sqlcmd_path))
    return [
        {
            "name": row.get("Baza", ""),
            "created_at": row.get("Data utworzenia", ""),
        }
        for row in rows
        if row.get("Baza")
    ]


def list_available_years(server: str, database: str, sqlcmd_path: str | None = None) -> list[int]:
    if not database:
        return []

    sql = """
SET NOCOUNT ON;
SELECT DISTINCT Rok
FROM (
    SELECT VaN_DeklRokMies / 100 AS Rok FROM CDN.VatNag WHERE VaN_DeklRokMies > 0
    UNION ALL SELECT YEAR(DeN_DataDok) FROM CDN.DekretyNag WHERE DeN_DataDok IS NOT NULL
    UNION ALL SELECT YEAR(KRo_DataDokumentu) FROM CDN.KsiRozrachunki WHERE KRo_DataDokumentu IS NOT NULL
    UNION ALL SELECT YEAR(BZp_DataDok) FROM CDN.BnkZapisy WHERE BZp_DataDok IS NOT NULL
    UNION ALL SELECT YEAR(DataOd) FROM CDN.JpkNag WHERE DataOd IS NOT NULL
    UNION ALL SELECT YEAR(DoN_DataDok) FROM CDN.DokNag WHERE DoN_DataDok IS NOT NULL
    UNION ALL SELECT YEAR(SrT_DataZak) FROM CDN.Trwale WHERE SrT_DataZak IS NOT NULL
) AS Years
WHERE Rok BETWEEN 2000 AND 2100
ORDER BY Rok DESC;
"""
    _, rows = run_sqlcmd_table(sql, SqlcmdConfig(server=server, database=database, sqlcmd_path=sqlcmd_path))
    years: list[int] = []
    for row in rows:
        try:
            years.append(int(row.get("Rok", "")))
        except ValueError:
            continue
    return years


def normalize_cell(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def main() -> int:
    server = ThreadingHTTPServer((HOST, PORT), OptimaRequestHandler)
    print(f"Optima local server: http://{HOST}:{PORT}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
