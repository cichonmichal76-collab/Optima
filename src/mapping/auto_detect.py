from __future__ import annotations

from src.core.enums import DataKind
from src.core.normalizers import normalize_header


FIELD_ALIASES: dict[str, list[str]] = {
    "document_number": [
        "nr dokumentu",
        "numer dokumentu",
        "numer dowodu",
        "nr dowodu",
        "dokument",
        "dowod",
        "dowod ksiegowy",
        "invoice number",
    ],
    "issue_date": ["data wystawienia", "data dokumentu", "data faktury"],
    "receipt_date": ["data wplywu", "data wpływu", "data otrzymania"],
    "vat_period": ["okres vat", "okres rozliczeniowy"],
    "contractor_name": ["kontrahent", "nazwa kontrahenta", "nazwa podmiotu", "podmiot", "nazwa", "firma"],
    "contractor_nip": ["nip", "nip kontrahenta", "nr kontrahenta"],
    "net": ["netto", "wartosc netto", "wartość netto", "kwota netto"],
    "vat": ["vat", "kwota vat", "podatek vat"],
    "gross": ["brutto", "wartosc brutto", "wartość brutto", "kwota brutto"],
    "vat_rate": ["stawka vat", "vat %", "stawka"],
    "register_name": ["rejestr", "rejestr vat"],
    "jpk_codes": ["kody jpk", "oznaczenia jpk"],
    "accounting_date": ["data ksiegowania", "data księgowania", "data zapisu"],
    "operation_date": ["data operacji"],
    "description": ["opis", "tresc", "treść"],
    "account": ["konto rozrachunkowe"],
    "account_opposite": ["konto przeciw", "konto przeciw.", "konto przeciwstawne", "konto przeciwne"],
    "account_wn": ["konto wn", "wn", "konto winien"],
    "account_ma": ["konto ma", "ma"],
    "amount_wn": ["kwota wn", "wn kwota"],
    "amount_ma": ["kwota ma", "ma kwota"],
    "journal": ["dziennik", "rejestr ksiegowy", "dziennik czastkowy", "nr dziennika", "numer w dzienniku"],
    "account_number": ["konto", "numer konta", "nr konta"],
    "name": ["nazwa konta", "konto nazwa", "nazwa"],
    "account_type": ["typ konta", "rodzaj konta"],
    "is_active": ["aktywne", "aktywny", "status"],
    "jpk_s_12_1": ["s_12_1", "jpk s_12_1"],
    "jpk_s_12_2": ["s_12_2", "jpk s_12_2"],
    "jpk_s_12_3": ["s_12_3", "jpk s_12_3"],
    "due_date": ["termin platnosci", "termin płatności"],
    "payment_date": ["data platnosci", "data płatności"],
    "amount": ["kwota", "wartosc", "wartość"],
    "paid_amount": ["zaplacono", "zapłacono", "kwota zaplacona", "kwota zapłacona"],
    "remaining_amount": ["pozostalo", "pozostało", "saldo", "kwota pozostala", "kwota pozostała"],
    "status": ["status", "stan rozrachunku"],
}


DATA_KIND_SIGNALS: dict[DataKind, set[str]] = {
    DataKind.VAT_PURCHASE: {"netto", "vat", "brutto", "stawka vat", "rejestr"},
    DataKind.VAT_SALE: {"netto", "vat", "brutto", "stawka vat", "kontrahent"},
    DataKind.LEDGER: {"konto", "konto przeciw", "kwota wn", "kwota ma"},
    DataKind.ACCOUNT_PLAN: {"numer konta", "nazwa konta", "typ konta"},
    DataKind.SETTLEMENTS: {"termin platnosci", "saldo", "zaplacono"},
    DataKind.BANK: {"opis", "kwota", "kontrahent"},
}


def alias_lookup() -> dict[str, str]:
    lookup: dict[str, str] = {}
    for field_name, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            lookup.setdefault(normalize_header(alias), field_name)
    return lookup


def guess_data_kind(headers: list[str]) -> DataKind:
    normalized = {normalize_header(header) for header in headers}
    best_kind = DataKind.UNKNOWN
    best_score = 0
    for data_kind, signals in DATA_KIND_SIGNALS.items():
        score = sum(1 for signal in signals if normalize_header(signal) in normalized)
        if score > best_score:
            best_score = score
            best_kind = data_kind
    return best_kind
