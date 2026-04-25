from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path


DEFAULT_SQLCMD_PATHS = (
    r"C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
    r"C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE",
)


@dataclass(frozen=True)
class SqlcmdConfig:
    server: str = r".\SQLEXPRESS02"
    database: str = "OptimaAudit_Firma_202603"
    sqlcmd_path: str | None = None


def run_sqlcmd_table(sql: str, config: SqlcmdConfig) -> tuple[list[str], list[dict[str, str]]]:
    output = run_sqlcmd(sql, config)
    lines = clean_sqlcmd_tsv(output)
    if not lines:
        return [], []

    headers = lines[0].split("\t")
    rows = []
    for line in lines[1:]:
        values = line.split("\t")
        row = {
            header: _normalize_sqlcmd_value(values[index] if index < len(values) else "")
            for index, header in enumerate(headers)
        }
        rows.append(row)
    return headers, rows


def run_sqlcmd(sql: str, config: SqlcmdConfig) -> str:
    sqlcmd = find_sqlcmd(config.sqlcmd_path)
    # SQLCMD on Windows reads Unicode .sql files reliably when they have a UTF-16 BOM.
    # This keeps Polish aliases in exported headers intact.
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-16") as handle:
        handle.write(sql)
        sql_file = Path(handle.name)

    try:
        result = subprocess.run(
            [
                sqlcmd,
                "-S",
                config.server,
                "-E",
                "-C",
                "-d",
                config.database,
                "-W",
                "-s",
                "\t",
                "-i",
                str(sql_file),
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    finally:
        sql_file.unlink(missing_ok=True)

    stdout = decode_sqlcmd_bytes(result.stdout)
    stderr = decode_sqlcmd_bytes(result.stderr).strip()
    if result.returncode != 0:
        raise RuntimeError(f"SQLCMD zakończył się błędem {result.returncode}: {stderr or stdout}")
    if stderr:
        raise RuntimeError(stderr)
    return stdout


def find_sqlcmd(explicit_path: str | None = None) -> str:
    candidates = [explicit_path] if explicit_path else []
    found = shutil.which("sqlcmd")
    if found:
        candidates.append(found)
    candidates.extend(DEFAULT_SQLCMD_PATHS)

    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    raise FileNotFoundError("Nie znaleziono SQLCMD.EXE. Podaj ścieżkę do SQLCMD albo zainstaluj narzędzia SQL Server.")


def decode_sqlcmd_bytes(payload: bytes) -> str:
    if payload.startswith((b"\xff\xfe", b"\xfe\xff")):
        return payload.decode("utf-16")
    # Hidden SQLCMD processes on Polish Windows can emit OEM CP852, while
    # interactive runs often emit UTF-8. Try both before the ANSI fallback.
    for encoding in ("utf-8-sig", "cp852", "mbcs", "utf-16le"):
        try:
            return payload.decode(encoding)
        except UnicodeDecodeError:
            continue
    return payload.decode("utf-8", errors="replace")


def clean_sqlcmd_tsv(output: str) -> list[str]:
    lines = [line.rstrip() for line in output.lstrip("\ufeff").splitlines()]
    cleaned: list[str] = []
    for line in lines:
        if not line.strip():
            continue
        if set(line.replace("\t", "").strip()) <= {"-"}:
            continue
        cleaned.append(line)
    return cleaned


def _normalize_sqlcmd_value(value: str) -> str:
    return "" if value == "NULL" else value
