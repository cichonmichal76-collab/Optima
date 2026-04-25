from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any


class SqliteStore:
    def __init__(self, file_path: Path) -> None:
        self.file_path = file_path
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.file_path)

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS kv_store (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )

    def set(self, key: str, value: Any) -> None:
        payload = json.dumps(value, ensure_ascii=False)
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO kv_store(key, value) VALUES(?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, payload),
            )

    def get(self, key: str, default: Any = None) -> Any:
        with self._connect() as connection:
            row = connection.execute("SELECT value FROM kv_store WHERE key = ?", (key,)).fetchone()
        if not row:
            return default
        return json.loads(row[0])
