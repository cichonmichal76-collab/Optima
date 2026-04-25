from __future__ import annotations

from src.core.enums import DataKind
from src.core.normalizers import normalize_header
from src.mapping.auto_detect import alias_lookup


FIELDS_BY_KIND: dict[DataKind, list[str]] = {
    DataKind.VAT_PURCHASE: [
        "document_number",
        "issue_date",
        "receipt_date",
        "contractor_nip",
        "contractor_name",
        "net",
        "vat",
        "gross",
        "register_name",
        "jpk_codes",
    ],
    DataKind.VAT_SALE: [
        "document_number",
        "issue_date",
        "contractor_nip",
        "contractor_name",
        "net",
        "vat",
        "gross",
        "register_name",
        "jpk_codes",
    ],
    DataKind.LEDGER: [
        "document_number",
        "accounting_date",
        "operation_date",
        "description",
        "account",
        "account_opposite",
        "account_wn",
        "account_ma",
        "amount_wn",
        "amount_ma",
        "journal",
        "contractor_name",
        "contractor_nip",
    ],
    DataKind.ACCOUNT_PLAN: [
        "account_number",
        "name",
        "account_type",
        "is_active",
        "jpk_s_12_1",
        "jpk_s_12_2",
        "jpk_s_12_3",
    ],
    DataKind.SETTLEMENTS: [
        "document_number",
        "contractor_name",
        "contractor_nip",
        "due_date",
        "payment_date",
        "amount",
        "paid_amount",
        "remaining_amount",
        "account",
        "status",
    ],
    DataKind.BANK: [
        "document_number",
        "operation_date",
        "description",
        "amount",
        "contractor_name",
        "account",
        "status",
    ],
}


REQUIRED_FIELDS_BY_KIND: dict[DataKind, set[str]] = {
    DataKind.VAT_PURCHASE: {"document_number", "net", "vat", "gross"},
    DataKind.VAT_SALE: {"document_number", "net", "vat", "gross"},
    DataKind.LEDGER: {"document_number", "amount_wn", "amount_ma"},
    DataKind.ACCOUNT_PLAN: {"account_number"},
    DataKind.SETTLEMENTS: {"document_number", "amount"},
    DataKind.BANK: {"amount", "description"},
}


class ColumnMapper:
    def __init__(self) -> None:
        self._lookup = alias_lookup()

    def fields_for_kind(self, data_kind: DataKind) -> list[str]:
        return FIELDS_BY_KIND.get(data_kind, [])

    def required_fields_for_kind(self, data_kind: DataKind) -> set[str]:
        return REQUIRED_FIELDS_BY_KIND.get(data_kind, set())

    def auto_map(self, headers: list[str], data_kind: DataKind) -> dict[str, str]:
        normalized_to_original = {normalize_header(header): header for header in headers}
        mapping: dict[str, str] = {}
        for normalized_header_name, original_header in normalized_to_original.items():
            field_name = self._lookup.get(normalized_header_name)
            if field_name and field_name in self.fields_for_kind(data_kind) and field_name not in mapping:
                mapping[field_name] = original_header
        if data_kind == DataKind.LEDGER:
            self._map_optima_ledger_accounts(normalized_to_original, mapping)
        return mapping

    def validate_mapping(self, data_kind: DataKind, mapping: dict[str, str]) -> list[str]:
        required = self.required_fields_for_kind(data_kind)
        missing = [field_name for field_name in required if not mapping.get(field_name)]
        if data_kind == DataKind.LEDGER:
            has_optima_accounts = bool(mapping.get("account") and mapping.get("account_opposite"))
            has_explicit_sides = bool(mapping.get("account_wn") and mapping.get("account_ma"))
            if not has_optima_accounts and not has_explicit_sides:
                if mapping.get("account_wn") or mapping.get("account_ma"):
                    for field_name in ("account_wn", "account_ma"):
                        if not mapping.get(field_name):
                            missing.append(field_name)
                else:
                    for field_name in ("account", "account_opposite"):
                        if not mapping.get(field_name):
                            missing.append(field_name)
        return missing

    def apply_mapping(self, row: dict[str, object], mapping: dict[str, str]) -> dict[str, object]:
        result: dict[str, object] = {}
        for target_field, source_column in mapping.items():
            result[target_field] = row.get(source_column)
        return result

    @staticmethod
    def _map_optima_ledger_accounts(normalized_to_original: dict[str, str], mapping: dict[str, str]) -> None:
        # Optima exports "Konto" and "Konto przeciw." as account/opposite account,
        # not as Wn/Ma sides. Only explicit Konto Wn/Konto Ma headers map to sides.
        main_account = normalized_to_original.get("konto")
        opposite_account = (
            normalized_to_original.get("konto_przeciw")
            or normalized_to_original.get("konto_przeciwstawne")
            or normalized_to_original.get("konto_przeciwne")
        )
        if main_account and "account" not in mapping:
            mapping["account"] = main_account
        if opposite_account and "account_opposite" not in mapping:
            mapping["account_opposite"] = opposite_account
