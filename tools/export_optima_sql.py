from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.connectors.optima_sql_mapping import build_optima_sql_query  # noqa: E402
from src.connectors.optima_sql_runner import SqlcmdConfig, run_sqlcmd_table  # noqa: E402
from src.core.enums import DataKind  # noqa: E402


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

    query = build_optima_sql_query(data_kind, args.period)
    headers, table_rows = run_sqlcmd_table(
        query.sql,
        SqlcmdConfig(server=args.server, database=args.database, sqlcmd_path=args.sqlcmd),
    )
    rows = ["\t".join(headers), *["\t".join(row.get(header, "") for header in headers) for row in table_rows]]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(rows) + "\n", encoding="utf-8")

    print(f"Eksport zakończony sukcesem: {args.output}")
    print(f"Typ danych: {data_kind.value}")
    print(f"Wiersze danych: {max(len(rows) - 1, 0)}")
    for note in query.notes:
        print(f"- {note}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
