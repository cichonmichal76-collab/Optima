from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class OptimaFilterTarget:
    module: str
    list_label: str
    id_field: str | None = None
    id_headers: tuple[str, ...] = ()
    number_field: str | None = None
    number_headers: tuple[str, ...] = ()


FILTER_TARGETS: dict[str, OptimaFilterTarget] = {
    "DOCUMENTS": OptimaFilterTarget(
        module="DOCUMENTS",
        list_label="Obieg dokumentów / lista dokumentów",
        id_field="DoN_DoNID",
        id_headers=("Optima DoNID",),
        number_field="DoN_NumerPelny",
        number_headers=("Numer dokumentu", "Numer"),
    ),
    "LEDGER": OptimaFilterTarget(
        module="LEDGER",
        list_label="Zapisy księgowe / dekrety",
        id_field="DeN_DeNId",
        id_headers=("Optima DeNID",),
        number_field="DeN_NumerPelny",
        number_headers=("Numer dokumentu", "Numer"),
    ),
    "VAT_PURCHASE": OptimaFilterTarget(
        module="VAT_PURCHASE",
        list_label="Rejestr VAT zakupu",
        id_field="VaN_VaNID",
        id_headers=("Optima VaNID",),
        number_field="VaN_Dokument",
        number_headers=("Numer dokumentu", "Numer"),
    ),
    "VAT_SALE": OptimaFilterTarget(
        module="VAT_SALE",
        list_label="Rejestr VAT sprzedaży",
        id_field="VaN_VaNID",
        id_headers=("Optima VaNID",),
        number_field="VaN_Dokument",
        number_headers=("Numer dokumentu", "Numer"),
    ),
    "ACCOUNT_PLAN": OptimaFilterTarget(
        module="ACCOUNT_PLAN",
        list_label="Plan kont",
        id_field="Acc_AccID",
        id_headers=("Optima AccID",),
        number_field="Acc_Numer",
        number_headers=("Numer konta",),
    ),
    "SETTLEMENTS": OptimaFilterTarget(
        module="SETTLEMENTS",
        list_label="Rozrachunki",
        id_field="KRo_KRoId",
        id_headers=("Optima KRoID",),
        number_field="KRo_Dokument",
        number_headers=("Numer dokumentu", "Dokument"),
    ),
    "BANK": OptimaFilterTarget(
        module="BANK",
        list_label="Zapisy bankowe / kasowe",
        id_field="BZp_BZpID",
        id_headers=("Optima BZpID",),
        number_field="BZp_NumerPelny",
        number_headers=("Numer zapisu", "Numer dokumentu", "Numer"),
    ),
    "JPK_DECLARATIONS": OptimaFilterTarget(
        module="JPK_DECLARATIONS",
        list_label="JPK i deklaracje",
        id_field="Id",
        id_headers=("JPK ID", "Id"),
    ),
    "CONTRACTORS": OptimaFilterTarget(
        module="CONTRACTORS",
        list_label="Kartoteka kontrahentów",
        id_field="Knt_KntId",
        id_headers=("Optima KntID",),
        number_field="Knt_Kod",
        number_headers=("Kod kontrahenta",),
    ),
    "FIXED_ASSETS": OptimaFilterTarget(
        module="FIXED_ASSETS",
        list_label="Środki trwałe",
        id_field="SrT_SrTID",
        id_headers=("Optima SrTID",),
        number_field="SrT_Dokument",
        number_headers=("Dokument", "Nr inwentarzowy"),
    ),
    "HR_PAYROLL": OptimaFilterTarget(
        module="HR_PAYROLL",
        list_label="Kadry i płace",
        id_field="PRE_PreId",
        id_headers=("Optima PreID",),
        number_field="PRE_Kod",
        number_headers=("Kod pracownika",),
    ),
}


def build_optima_filter_snippets(
    *,
    report_title: str,
    module_code: str,
    headers: list[str] | tuple[str, ...],
    rows: list[dict[str, Any]] | tuple[dict[str, Any], ...],
) -> dict[str, Any]:
    target = FILTER_TARGETS.get(module_code)
    if not target:
        return {
            "supported": False,
            "status": "unsupported",
            "message": "Brak zdefiniowanego filtra dla tego modułu Optimy.",
        }

    if not rows:
        return {
            "supported": False,
            "status": "empty",
            "message": "Brak wierszy do zbudowania filtra do Optimy.",
            "target_list": target.list_label,
        }

    primary = _build_id_snippet(target, list(rows))
    secondary = _build_number_snippet(target, list(rows))
    if not primary and not secondary:
        return {
            "supported": False,
            "status": "unsupported",
            "message": "Ten wynik nie zawiera pewnego identyfikatora ani numeru pozwalającego zbudować filtr do Optimy.",
            "target_list": target.list_label,
            "record_count": len(rows),
        }

    warning = None
    if len(rows) > 250:
        warning = "Filtr obejmuje dużo pozycji. W Optimie najlepiej wkleić go do filtra zaawansowanego na odpowiedniej liście i dopiero wtedy zawęzić widok."

    return {
        "supported": True,
        "status": primary["mode"] if primary else secondary["mode"],
        "report_title": report_title,
        "target_list": target.list_label,
        "record_count": len(rows),
        "primary": primary,
        "secondary": secondary,
        "warning": warning,
        "instructions": [
            f"Otwórz w Optimie listę: {target.list_label}.",
            "Na dole listy rozwiń panel filtra zaawansowanego i uruchom Konstruktor filtra.",
            "Na zakładce Zaawansowane wklej poniższy warunek i użyj Filtruj.",
        ],
        "message": "Gotowy warunek do wklejenia w filtr zaawansowany Optimy.",
    }


def _build_id_snippet(target: OptimaFilterTarget, rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not target.id_field or not target.id_headers:
        return None
    values = _extract_unique_integer_values(rows, target.id_headers)
    if not values:
        return None
    return {
        "mode": "id",
        "label": "Filtr pewny po ID",
        "description": f"Najbezpieczniejszy wariant dla listy {target.list_label}.",
        "field": target.id_field,
        "expression": _numeric_expression(target.id_field, values),
        "record_count": len(values),
    }


def _build_number_snippet(target: OptimaFilterTarget, rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not target.number_field or not target.number_headers:
        return None
    values = _extract_unique_text_values(rows, target.number_headers)
    if not values:
        return None
    return {
        "mode": "number",
        "label": "Filtr alternatywny po numerze",
        "description": "Czytelniejszy wariant, przydatny gdy chcesz zawęzić widok po numerach dokumentów.",
        "field": target.number_field,
        "expression": _text_expression(target.number_field, values),
        "record_count": len(values),
    }


def _extract_unique_integer_values(rows: list[dict[str, Any]], headers: tuple[str, ...]) -> list[int]:
    seen: set[int] = set()
    result: list[int] = []
    for row in rows:
        for header in headers:
            raw = str(row.get(header, "")).strip()
            if not raw or not raw.isdigit():
                continue
            value = int(raw)
            if value in seen:
                continue
            seen.add(value)
            result.append(value)
            break
    return result


def _extract_unique_text_values(rows: list[dict[str, Any]], headers: tuple[str, ...]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for row in rows:
        for header in headers:
            raw = str(row.get(header, "")).strip()
            if not raw or raw in seen:
                continue
            seen.add(raw)
            result.append(raw)
            break
    return result


def _numeric_expression(field_name: str, values: list[int]) -> str:
    if len(values) == 1:
        return f"{field_name} = {values[0]}"
    return f"{field_name} IN ({', '.join(str(value) for value in values)})"


def _text_expression(field_name: str, values: list[str]) -> str:
    escaped = ["N'" + value.replace("'", "''") + "'" for value in values]
    if len(escaped) == 1:
        return f"{field_name} = {escaped[0]}"
    return f"{field_name} IN ({', '.join(escaped)})"
