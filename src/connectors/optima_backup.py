from __future__ import annotations

import re
import string
from datetime import datetime
from pathlib import Path
from typing import Any

from src.connectors.optima_sql_runner import SqlcmdConfig, run_sqlcmd, run_sqlcmd_table


BACKUP_SUFFIXES = {".bak", ".bac"}


def scan_backup_files(extra_roots: list[str] | None = None) -> list[dict[str, Any]]:
    roots = _default_scan_roots()
    if extra_roots:
        roots.extend(Path(root) for root in extra_roots if root)

    seen: set[str] = set()
    backups: list[dict[str, Any]] = []
    for root in roots:
        if not root.exists():
            continue
        for path in _iter_backup_candidates(root):
            resolved = str(path.resolve()).lower()
            if resolved in seen:
                continue
            seen.add(resolved)
            stat = path.stat()
            backups.append(
                {
                    "path": str(path),
                    "name": path.name,
                    "size_mb": round(stat.st_size / 1024 / 1024, 2),
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
                }
            )
    backups.sort(key=lambda item: item["modified"], reverse=True)
    return backups


def inspect_backup(path: str, server: str = r".\SQLEXPRESS02", sqlcmd_path: str | None = None) -> dict[str, Any]:
    backup_path = _validate_backup_path(path)
    config = SqlcmdConfig(server=server, database="master", sqlcmd_path=sqlcmd_path)
    disk = _sql_literal(str(backup_path))

    header_cols, header_rows = run_sqlcmd_table(f"RESTORE HEADERONLY FROM DISK = N'{disk}';", config)
    file_cols, file_rows = run_sqlcmd_table(f"RESTORE FILELISTONLY FROM DISK = N'{disk}';", config)
    header = header_rows[0] if header_rows else {}

    return {
        "path": str(backup_path),
        "header_columns": header_cols,
        "file_columns": file_cols,
        "database_name": header.get("DatabaseName") or "",
        "backup_name": header.get("BackupName") or "",
        "backup_start_date": header.get("BackupStartDate") or "",
        "backup_finish_date": header.get("BackupFinishDate") or "",
        "server_name": header.get("ServerName") or "",
        "compatibility_level": header.get("CompatibilityLevel") or "",
        "files": [
            {
                "logical_name": row.get("LogicalName") or "",
                "type": row.get("Type") or "",
                "physical_name": row.get("PhysicalName") or "",
                "size": row.get("Size") or "",
            }
            for row in file_rows
        ],
        "suggested_database": suggest_database_name(header.get("DatabaseName") or backup_path.stem),
    }


def restore_backup(
    path: str,
    server: str = r".\SQLEXPRESS02",
    target_database: str | None = None,
    sqlcmd_path: str | None = None,
) -> dict[str, Any]:
    metadata = inspect_backup(path, server=server, sqlcmd_path=sqlcmd_path)
    backup_path = _validate_backup_path(path)
    target = sanitize_identifier(target_database or metadata["suggested_database"])
    if not target:
        raise ValueError("Nie udało się ustalić nazwy bazy roboczej.")

    config = SqlcmdConfig(server=server, database="master", sqlcmd_path=sqlcmd_path)
    if _database_exists(target, config):
        raise ValueError(f"Baza robocza '{target}' już istnieje. Podaj inną nazwę.")

    data_path, log_path = _default_sql_data_paths(config)
    move_clauses = []
    data_index = 0
    log_index = 0
    for file_info in metadata["files"]:
        logical_name = file_info["logical_name"]
        file_type = file_info["type"]
        if not logical_name:
            continue
        if file_type == "L":
            log_index += 1
            destination = log_path / f"{target}_log{'' if log_index == 1 else log_index}.ldf"
        else:
            data_index += 1
            extension = ".mdf" if data_index == 1 else f"_{data_index}.ndf"
            destination = data_path / f"{target}{extension}"
        move_clauses.append(f"MOVE N'{_sql_literal(logical_name)}' TO N'{_sql_literal(str(destination))}'")

    if not move_clauses:
        raise ValueError("Backup nie zwrócił listy plików do odtworzenia.")

    restore_sql = f"""
RESTORE DATABASE [{target}]
FROM DISK = N'{_sql_literal(str(backup_path))}'
WITH {', '.join(move_clauses)}, RECOVERY, STATS = 10;
ALTER DATABASE [{target}] SET READ_ONLY WITH ROLLBACK IMMEDIATE;
""".strip()
    output = run_sqlcmd(restore_sql, config)

    return {
        "database": target,
        "server": server,
        "source_path": str(backup_path),
        "read_only": True,
        "message": output.strip() or "Backup odtworzony i ustawiony jako read-only.",
    }


def suggest_database_name(source_name: str) -> str:
    base = sanitize_identifier(source_name)
    if base.upper().startswith("CDN_"):
        base = base[4:]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return sanitize_identifier(f"OptimaAudit_{base[:48]}_{timestamp}")


def sanitize_identifier(value: str) -> str:
    text = re.sub(r"[^A-Za-z0-9_]+", "_", value.strip())
    text = re.sub(r"_+", "_", text).strip("_")
    if not text:
        return ""
    if text[0].isdigit():
        text = f"DB_{text}"
    return text[:120]


def _default_scan_roots() -> list[Path]:
    roots: list[Path] = []
    for drive in string.ascii_uppercase:
        root = Path(f"{drive}:\\")
        if root.exists():
            roots.append(root)
    home = Path.home()
    roots.extend([home / "Downloads", home / "Desktop", home / "OneDrive" / "Pulpit"])
    return roots


def _iter_backup_candidates(root: Path) -> list[Path]:
    candidates: list[Path] = []
    try:
        for item in root.iterdir():
            if item.is_file() and item.suffix.lower() in BACKUP_SUFFIXES:
                candidates.append(item)
    except OSError:
        return []
    return candidates


def _validate_backup_path(path: str) -> Path:
    backup_path = Path(path).expanduser()
    if not backup_path.exists():
        raise FileNotFoundError(f"Nie znaleziono pliku backupu: {backup_path}")
    if backup_path.suffix.lower() not in BACKUP_SUFFIXES:
        raise ValueError("Obsługiwane są pliki .BAK i .BAC.")
    return backup_path


def _database_exists(database: str, config: SqlcmdConfig) -> bool:
    sql = f"SELECT name FROM sys.databases WHERE name = N'{_sql_literal(database)}';"
    _, rows = run_sqlcmd_table(sql, config)
    return bool(rows)


def _default_sql_data_paths(config: SqlcmdConfig) -> tuple[Path, Path]:
    sql = """
SELECT
    CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000)) AS DataPath,
    CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(4000)) AS LogPath;
""".strip()
    _, rows = run_sqlcmd_table(sql, config)
    data_path = rows[0].get("DataPath") if rows else ""
    log_path = rows[0].get("LogPath") if rows else ""
    fallback = Path(r"C:\Program Files\Microsoft SQL Server\MSSQL17.SQLEXPRESS02\MSSQL\DATA")
    return Path(data_path or fallback), Path(log_path or data_path or fallback)


def _sql_literal(value: str) -> str:
    return value.replace("'", "''")
