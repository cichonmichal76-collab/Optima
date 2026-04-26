from __future__ import annotations

from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from src.connectors.optima_sql_mapping import build_optima_sql_query
from src.connectors.optima_sql_runner import SqlcmdConfig, run_sqlcmd_table
from src.core.enums import DataKind
from src.core.normalizers import normalize_bool, normalize_date, normalize_decimal, normalize_text
from src.mapping.column_mapper import ColumnMapper


SUPPORTED_VALIDATION_KINDS = {
    DataKind.VAT_PURCHASE,
    DataKind.VAT_SALE,
    DataKind.LEDGER,
    DataKind.ACCOUNT_PLAN,
}

FIELD_LABELS = {
    "document_number": "Numer dokumentu",
    "issue_date": "Data wystawienia",
    "receipt_date": "Data wpływu",
    "vat_period": "Okres VAT",
    "contractor_name": "Kontrahent",
    "contractor_nip": "NIP kontrahenta",
    "net": "Kwota netto",
    "vat": "Kwota VAT",
    "gross": "Kwota brutto",
    "vat_rate": "Stawka VAT",
    "register_name": "Rejestr",
    "jpk_codes": "Kody JPK",
    "accounting_date": "Data księgowania",
    "operation_date": "Data operacji",
    "description": "Opis",
    "account": "Konto rozrachunkowe",
    "account_opposite": "Konto przeciwstawne",
    "account_wn": "Konto Wn",
    "account_ma": "Konto Ma",
    "amount_wn": "Kwota Wn",
    "amount_ma": "Kwota Ma",
    "journal": "Dziennik",
    "account_number": "Numer konta",
    "name": "Nazwa",
    "account_type": "Typ konta",
    "is_active": "Czy aktywne",
    "jpk_s_12_1": "JPK S_12_1",
    "jpk_s_12_2": "JPK S_12_2",
    "jpk_s_12_3": "JPK S_12_3",
}

KIND_LABELS = {
    DataKind.VAT_PURCHASE: "Rejestr VAT zakup",
    DataKind.VAT_SALE: "Rejestr VAT sprzedaż",
    DataKind.LEDGER: "Zapisy księgowe",
    DataKind.ACCOUNT_PLAN: "Plan kont",
}

NUMERIC_FIELDS_BY_KIND = {
    DataKind.VAT_PURCHASE: ["net", "vat", "gross"],
    DataKind.VAT_SALE: ["net", "vat", "gross"],
    DataKind.LEDGER: ["amount_wn", "amount_ma"],
    DataKind.ACCOUNT_PLAN: [],
}

SAMPLE_LIMIT = 8


def validate_excel_against_sql(
    *,
    headers: list[str],
    rows: list[dict[str, Any]],
    data_kind: DataKind | str,
    server: str,
    database: str,
    period: int | str | None = None,
    year: int | str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    sqlcmd_path: str | None = None,
) -> dict[str, Any]:
    if not headers:
        raise ValueError("Plik Excel nie zawiera nagłówków do porównania.")
    if not rows:
        raise ValueError("Plik Excel nie zawiera żadnych wierszy do porównania.")

    kind = data_kind if isinstance(data_kind, DataKind) else DataKind(str(data_kind))
    if kind not in SUPPORTED_VALIDATION_KINDS:
        supported = ", ".join(KIND_LABELS[item] for item in SUPPORTED_VALIDATION_KINDS)
        raise ValueError(f"Walidacja SQL obsługuje teraz tylko: {supported}.")

    mapper = ColumnMapper()
    excel_mapping = mapper.auto_map(headers, kind)
    excel_missing = mapper.validate_mapping(kind, excel_mapping)

    query = build_optima_sql_query(kind, period, year=year, date_from=date_from, date_to=date_to)
    sql_headers, sql_rows = run_sqlcmd_table(
        query.sql,
        SqlcmdConfig(server=server, database=database, sqlcmd_path=sqlcmd_path),
    )
    sql_mapping = mapper.auto_map(sql_headers, kind)
    sql_missing = mapper.validate_mapping(kind, sql_mapping)

    comparable_fields = [
        field
        for field in mapper.fields_for_kind(kind)
        if excel_mapping.get(field) and sql_mapping.get(field)
    ]
    if not comparable_fields:
        raise ValueError("Nie udało się znaleźć wspólnych pól między eksportem Excela a odczytem SQL.")

    excel_rows_normalized = _normalize_rows(rows, excel_mapping, kind, comparable_fields)
    sql_rows_normalized = _normalize_rows(sql_rows, sql_mapping, kind, comparable_fields)
    comparison = _compare_row_sets(excel_rows_normalized, sql_rows_normalized, comparable_fields)

    exact_match = (
        not excel_missing
        and not sql_missing
        and comparison["excel_only_count"] == 0
        and comparison["sql_only_count"] == 0
        and len(excel_rows_normalized) == len(sql_rows_normalized)
    )
    status = "success" if exact_match else "warning"
    compared_field_labels = [FIELD_LABELS.get(field, field) for field in comparable_fields]

    return {
        "status": status,
        "kind": kind.value,
        "kind_label": KIND_LABELS[kind],
        "notes": [
            "Walidacja porównuje Excel z Optimy i wynik SQL po polach kanonicznych.",
            *query.notes,
        ],
        "summary": {
            "excel_rows": len(excel_rows_normalized),
            "sql_rows": len(sql_rows_normalized),
            "matched_rows": comparison["matched_rows"],
            "excel_only_rows": comparison["excel_only_count"],
            "sql_only_rows": comparison["sql_only_count"],
            "match_rate": _calculate_match_rate(
                comparison["matched_rows"],
                len(excel_rows_normalized),
                len(sql_rows_normalized),
            ),
        },
        "mapping": {
            "compared_fields": compared_field_labels,
            "excel_missing_required": [FIELD_LABELS.get(field, field) for field in excel_missing],
            "sql_missing_required": [FIELD_LABELS.get(field, field) for field in sql_missing],
            "fields": [
                {
                    "field": field,
                    "label": FIELD_LABELS.get(field, field),
                    "excel_header": excel_mapping.get(field, ""),
                    "sql_header": sql_mapping.get(field, ""),
                    "compared": field in comparable_fields,
                }
                for field in mapper.fields_for_kind(kind)
            ],
        },
        "totals": _build_totals(kind, excel_rows_normalized, sql_rows_normalized),
        "differences": {
            "excel_only_sample": [_label_row(row) for row in comparison["excel_only_sample"]],
            "sql_only_sample": [_label_row(row) for row in comparison["sql_only_sample"]],
        },
        "preview": {
            "excel_headers": headers,
            "sql_headers": sql_headers,
            "excel_sample": [_label_row(row) for row in excel_rows_normalized[:5]],
            "sql_sample": [_label_row(row) for row in sql_rows_normalized[:5]],
        },
        "source": {
            "server": server,
            "database": database,
            "period": period,
            "year": year,
            "date_from": date_from,
            "date_to": date_to,
        },
    }


def _normalize_rows(
    rows: list[dict[str, Any]],
    mapping: dict[str, str],
    data_kind: DataKind,
    fields: list[str],
) -> list[dict[str, str]]:
    normalized_rows: list[dict[str, str]] = []
    for row in rows:
        normalized = {
            field: _normalize_field_value(field, row.get(mapping[field]), data_kind)
            for field in fields
        }
        if any(value not in ("", None) for value in normalized.values()):
            normalized_rows.append(normalized)
    return normalized_rows


def _normalize_field_value(field: str, value: Any, data_kind: DataKind) -> str:
    if field in {"issue_date", "receipt_date", "accounting_date", "operation_date"}:
        normalized = normalize_date(value)
        return normalized.isoformat() if normalized else ""

    if field == "contractor_nip":
        text = normalize_text(value) or ""
        return "".join(char for char in text if char.isalnum()).upper()

    if field == "is_active":
        normalized = normalize_bool(value)
        if normalized is True:
            return "TAK"
        if normalized is False:
            return "NIE"
        return ""

    if field in set(NUMERIC_FIELDS_BY_KIND.get(data_kind, [])):
        normalized_decimal = normalize_decimal(value, Decimal("0")) or Decimal("0")
        return _decimal_text(normalized_decimal)

    text = normalize_text(value) or ""
    return text.casefold()


def _decimal_text(value: Decimal) -> str:
    return format(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f")


def _compare_row_sets(
    excel_rows: list[dict[str, str]],
    sql_rows: list[dict[str, str]],
    fields: list[str],
) -> dict[str, Any]:
    excel_counter = Counter(_row_signature(row, fields) for row in excel_rows)
    sql_counter = Counter(_row_signature(row, fields) for row in sql_rows)
    matched_rows = sum((excel_counter & sql_counter).values())
    excel_only_counter = excel_counter - sql_counter
    sql_only_counter = sql_counter - excel_counter

    excel_by_signature = { _row_signature(row, fields): row for row in excel_rows }
    sql_by_signature = { _row_signature(row, fields): row for row in sql_rows }

    return {
        "matched_rows": matched_rows,
        "excel_only_count": sum(excel_only_counter.values()),
        "sql_only_count": sum(sql_only_counter.values()),
        "excel_only_sample": _sample_rows(excel_only_counter, excel_by_signature),
        "sql_only_sample": _sample_rows(sql_only_counter, sql_by_signature),
    }


def _row_signature(row: dict[str, str], fields: list[str]) -> tuple[tuple[str, str], ...]:
    return tuple((field, row.get(field, "")) for field in fields)


def _sample_rows(counter: Counter[tuple[tuple[str, str], ...]], row_lookup: dict[tuple[tuple[str, str], ...], dict[str, str]]) -> list[dict[str, str]]:
    samples: list[dict[str, str]] = []
    for signature, occurrences in counter.items():
        for _ in range(occurrences):
            samples.append(dict(row_lookup[signature]))
            if len(samples) >= SAMPLE_LIMIT:
                return samples
    return samples


def _build_totals(
    data_kind: DataKind,
    excel_rows: list[dict[str, str]],
    sql_rows: list[dict[str, str]],
) -> list[dict[str, str]]:
    totals: list[dict[str, str]] = []
    for field in NUMERIC_FIELDS_BY_KIND.get(data_kind, []):
        excel_total = sum((normalize_decimal(row.get(field), Decimal("0")) or Decimal("0")) for row in excel_rows)
        sql_total = sum((normalize_decimal(row.get(field), Decimal("0")) or Decimal("0")) for row in sql_rows)
        difference = excel_total - sql_total
        totals.append(
            {
                "label": FIELD_LABELS.get(field, field),
                "excel_total": _decimal_text(excel_total),
                "sql_total": _decimal_text(sql_total),
                "difference": _decimal_text(difference),
                "match": difference == 0,
            }
        )
    return totals


def _calculate_match_rate(matched_rows: int, excel_rows: int, sql_rows: int) -> str:
    denominator = max(excel_rows, sql_rows, 1)
    return f"{(matched_rows / denominator) * 100:.1f}%"


def _label_row(row: dict[str, str]) -> dict[str, str]:
    return {
        FIELD_LABELS.get(field, field): value
        for field, value in row.items()
    }
