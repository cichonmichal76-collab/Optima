from __future__ import annotations

from src.connectors.optima_sql_runner import clean_sqlcmd_tsv, decode_sqlcmd_bytes


def test_clean_sqlcmd_tsv_removes_separator_lines():
    output = "A\tB\r\n-\t-\r\n1\t2\r\n\r\n"

    assert clean_sqlcmd_tsv(output) == ["A\tB", "1\t2"]


def test_clean_sqlcmd_tsv_removes_rows_affected_messages():
    output = "name\r\n----\r\n(0 rows affected)\r\n"

    assert clean_sqlcmd_tsv(output) == ["name"]


def test_decode_sqlcmd_bytes_handles_utf16_bom():
    payload = "Numer dokumentu\r\nFV/1\r\n".encode("utf-16")

    assert decode_sqlcmd_bytes(payload).startswith("Numer dokumentu")


def test_decode_sqlcmd_bytes_handles_polish_oem_codepage():
    assert decode_sqlcmd_bytes("Dekrety księgowe".encode("cp852")) == "Dekrety księgowe"
