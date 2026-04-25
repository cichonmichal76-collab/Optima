export const FIELDS_BY_KIND = {
  VAT_PURCHASE: ["document_number", "issue_date", "receipt_date", "contractor_nip", "contractor_name", "net", "vat", "gross", "vat_rate", "register_name"],
  VAT_SALE: ["document_number", "issue_date", "contractor_nip", "contractor_name", "net", "vat", "gross", "vat_rate", "register_name"],
  LEDGER: ["document_number", "accounting_date", "description", "account_wn", "account_ma", "amount_wn", "amount_ma", "journal", "contractor_name"],
  ACCOUNT_PLAN: ["account_number", "name", "account_type", "is_active", "jpk_s_12_1"],
  SETTLEMENTS: ["document_number", "contractor_name", "contractor_nip", "due_date", "payment_date", "amount", "paid_amount", "remaining_amount", "account", "status"],
  BANK: ["document_number", "operation_date", "description", "amount", "contractor_name", "account", "status"],
  JPK_XML: ["document_number", "contractor_nip", "contractor_name", "net", "vat", "gross"],
  OPTIMA_SCHEMA_XML: ["name", "condition", "account", "amount_expression"],
};

export const REQUIRED_BY_KIND = {
  VAT_PURCHASE: new Set(["document_number", "net", "vat", "gross"]),
  VAT_SALE: new Set(["document_number", "net", "vat", "gross"]),
  LEDGER: new Set(["document_number", "account_wn", "account_ma", "amount_wn", "amount_ma"]),
  ACCOUNT_PLAN: new Set(["account_number"]),
  SETTLEMENTS: new Set(["document_number", "amount"]),
  BANK: new Set(["amount", "description"]),
};

export const ALIASES = {
  document_number: ["nr dokumentu", "numer dokumentu", "dokument", "dowod", "dowod ksiegowy", "dowod sprzedazy", "dowod zakupu"],
  issue_date: ["data wystawienia", "data dokumentu", "data faktury"],
  receipt_date: ["data wplywu", "data otrzymania"],
  contractor_name: ["kontrahent", "nazwa kontrahenta", "nazwa dostawcy", "nazwa", "firma"],
  contractor_nip: ["nip", "nip kontrahenta", "nr kontrahenta", "nr dostawcy"],
  net: ["netto", "wartosc netto", "kwota netto"],
  vat: ["vat", "kwota vat", "podatek vat", "podatek naliczony"],
  gross: ["brutto", "wartosc brutto", "kwota brutto"],
  vat_rate: ["stawka vat", "vat procent", "stawka"],
  register_name: ["rejestr", "rejestr vat"],
  accounting_date: ["data ksiegowania"],
  description: ["opis", "tresc"],
  account_wn: ["konto wn", "wn"],
  account_ma: ["konto ma", "ma"],
  amount_wn: ["kwota wn", "wn kwota"],
  amount_ma: ["kwota ma", "ma kwota"],
  journal: ["dziennik"],
  account_number: ["konto", "numer konta", "nr konta"],
  name: ["nazwa konta", "nazwa"],
  account_type: ["typ konta", "rodzaj konta"],
  amount: ["kwota", "wartosc"],
  paid_amount: ["zaplacono", "kwota zaplacona"],
  remaining_amount: ["pozostalo", "saldo", "kwota pozostala"],
  due_date: ["termin platnosci"],
  payment_date: ["data platnosci"],
  operation_date: ["data operacji"],
  account: ["konto rozrachunkowe", "konto"],
  status: ["status"],
};

export const TEMPLATES = {
  FZ_VAT_100: {
    name: "FZ koszt VAT 100%",
    condition: "document_type == 'FZ'",
    lines: [
      ["WN", "{{cost_account}}", "net", "Koszt netto"],
      ["WN", "{{vat_account}}", "vat", "VAT naliczony"],
      ["MA", "{{supplier_account}}", "gross", "Rozrachunek z dostawca"],
    ],
  },
  FZ_PALIWO_50: {
    name: "FZ paliwo VAT 50%",
    condition: "document_type == 'FZ' and category == 'PALIWO'",
    lines: [
      ["WN", "{{fuel_account}}", "net + vat_nondeductible", "Koszt paliwa"],
      ["WN", "{{vat_account}}", "vat_deductible", "VAT odliczalny"],
      ["MA", "{{supplier_account}}", "gross", "Rozrachunek z dostawca"],
    ],
  },
  FZ_BEZ_VAT: {
    name: "FZ bez VAT",
    condition: "document_type == 'FZ' and vat == 0",
    lines: [
      ["WN", "{{cost_account}}", "gross", "Koszt brutto"],
      ["MA", "{{supplier_account}}", "gross", "Rozrachunek z dostawca"],
    ],
  },
  FS_23: {
    name: "FS sprzedaz krajowa 23%",
    condition: "document_type == 'FS' and vat_rate == '23%'",
    lines: [
      ["WN", "{{customer_account}}", "gross", "Naleznosc od odbiorcy"],
      ["MA", "{{revenue_account}}", "net", "Przychod"],
      ["MA", "{{vat_due_account}}", "vat", "VAT nalezny"],
    ],
  },
  WB_BANK_FEE: {
    name: "WB oplata bankowa",
    condition: "document_type == 'WB' and kind == 'BANK_FEE'",
    lines: [
      ["WN", "{{financial_cost_account}}", "amount", "Koszt bankowy"],
      ["MA", "{{bank_account}}", "amount", "Rachunek bankowy"],
    ],
  },
  AMORT: {
    name: "AMORT",
    condition: "document_type == 'AMORT'",
    lines: [
      ["WN", "{{depreciation_cost_account}}", "amount", "Koszt amortyzacji"],
      ["MA", "{{accumulated_depreciation_account}}", "amount", "Umorzenie"],
    ],
  },
  LP: {
    name: "LP lista plac",
    condition: "document_type == 'LP'",
    lines: [
      ["WN", "{{salary_cost_account}}", "gross_salary", "Koszt wynagrodzen"],
      ["MA", "{{employee_liability_account}}", "net_salary", "Wyplata netto"],
      ["MA", "{{tax_liability_account}}", "tax", "Podatek"],
      ["MA", "{{social_security_account}}", "social_security", "ZUS"],
    ],
  },
};

export const VIEW_TITLES = {
  audit: ["Audyt", "Import, podglad i szybka walidacja eksportu."],
  mapping: ["Mapowanie", "Dopasowanie kolumn z pliku do modelu kanonicznego."],
  schema: ["Schemat", "Projekt dekretow bez importu do Optimy."],
  report: ["Raport", "Eksport wynikow lokalnie z przegladarki."],
};

export const VAT_RATES = new Set(["0", "0%", "5", "5%", "8", "8%", "23", "23%", "zw", "np", "oo"]);

