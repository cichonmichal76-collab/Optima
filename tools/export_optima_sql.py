from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.connectors.optima_sql_mapping import build_optima_sql_query  # noqa: E402
from src.core.enums import DataKind  # noqa: E402


DEFAULT_SQLCMD_PATHS = (
    r"C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE",
    r"C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE",
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Eksportuje dane z bazy firmowej Comarch ERP Optima do lokalnego TSV dla GUI audytowego."
    )
    parser.add_argument("--server", default=r".\SQLEXPRESS02", help=r"Instancja SQL Server, np. .\SQLEXPRESS02.")
    parser.add_argument("--database", default="OptimaAudit_Firma_202603", help="Nazwa odtworzonej bazy firmowej.")
    parser.add_argument(
        "--kind",
        required=True,
        choices=("VAT_PURCHASE", "VAT_SALE", "LEDGER", "ACCOUNT_PLAN"),
        help="Typ danych do eksportu.",
    )
    parser.add_argument("--period", help="Okres RRRRMM, np. 202603. Wymagany dla VAT i księgowości.")
    parser.add_argument("--output", required=True, type=Path, help="Ścieżka pliku wynikowego .tsv/.csv.")
    parser.add_argument("--sqlcmd", default=None, help="Opcjonalna pełna ścieżka do SQLCMD.EXE.")
    args = parser.parse_args()

    data_kind = DataKind(args.kind)
    if data_kind != DataKind.ACCOUNT_PLAN and not args.period:
        parser.error("--period jest wymagany dla VAT_PURCHASE, VAT_SALE i LEDGER.")

    sqlcmd = _find_sqlcmd(args.sqlcmd)
    query = build_optima_sql_query(data_kind, args.period)
    raw_output = _run_sqlcmd(sqlcmd, args.server, args.database, query.sql)
    rows = _clean_sqlcmd_tsv(raw_output)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(rows) + "\n", encoding="utf-8")

    print(f"Eksport zakończony sukcesem: {args.output}")
    print(f"Typ danych: {data_kind.value}")
    print(f"Wiersze danych: {max(len(rows) - 1, 0)}")
    for note in query.notes:
        print(f"- {note}")
    return 0


def _find_sqlcmd(explicit_path: str | None) -> str:
    candidates = [explicit_path] if explicit_path else []
    found = shutil.which("sqlcmd")
    if found:
        candidates.append(found)
    candidates.extend(DEFAULT_SQLCMD_PATHS)

    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    raise FileNotFoundError("Nie znaleziono SQLCMD.EXE. Podaj ścieżkę parametrem --sqlcmd.")


def _run_sqlcmd(sqlcmd: str, server: str, database: str, sql: str) -> str:
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
                server,
                "-E",
                "-C",
                "-d",
                database,
                "-W",
                "-s",
                "\t",
                "-i",
                str(sql_file),
                "-u",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    finally:
        sql_file.unlink(missing_ok=True)

    stdout = _decode_sqlcmd_bytes(result.stdout)
    stderr = _decode_sqlcmd_bytes(result.stderr).strip()
    if result.returncode != 0:
        raise RuntimeError(f"SQLCMD zakończył się błędem {result.returncode}: {stderr or stdout}")
    if stderr:
        print(stderr, file=sys.stderr)
    return stdout


def _decode_sqlcmd_bytes(payload: bytes) -> str:
    if payload.startswith((b"\xff\xfe", b"\xfe\xff")):
        return payload.decode("utf-16")
    for encoding in ("utf-8-sig", "mbcs", "utf-16le"):
        try:
            return payload.decode(encoding)
        except UnicodeDecodeError:
            continue
    return payload.decode("utf-8", errors="replace")


def _clean_sqlcmd_tsv(output: str) -> list[str]:
    lines = [line.rstrip() for line in output.lstrip("\ufeff").splitlines()]
    cleaned: list[str] = []
    for line in lines:
        if not line.strip():
            continue
        if set(line.replace("\t", "").strip()) <= {"-"}:
            continue
        cleaned.append(line)
    return cleaned


if __name__ == "__main__":
    raise SystemExit(main())
