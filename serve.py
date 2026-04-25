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

import pandas as pd


HOST = "127.0.0.1"
PORT = 8000
ROOT = Path(__file__).resolve().parent
MAX_ROWS = 5000


class OptimaRequestHandler(SimpleHTTPRequestHandler):
    server_version = "OptimaLocalServer/0.1"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self) -> None:
        if self.path == "/api/preview":
            self._handle_preview()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")

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

