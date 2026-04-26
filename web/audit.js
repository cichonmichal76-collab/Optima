import { VAT_RATES } from "./config.js";
import { formatAmount, mapped, parseAmount } from "./utils.js";

export function runAudit(kind, rows, mapping) {
  if (kind === "VAT_PURCHASE" || kind === "VAT_SALE" || kind === "JPK_XML") {
    return auditVat(rows, mapping);
  }
  if (kind === "LEDGER") {
    return auditLedger(rows, mapping);
  }
  return {
    issues: [{
      level: "INFO",
      area: kind,
      document: "",
      contractor: "",
      issue: "Ten typ danych ma w web GUI tryb podglądu.",
      recommendation: "Pełna walidacja jest w aplikacji Python.",
    }],
    records: [],
  };
}

export function buildSummary(issues, records = []) {
  const counts = issues.reduce((acc, issue) => {
    acc[issue.level] = (acc[issue.level] || 0) + 1;
    return acc;
  }, {});
  const documents = new Set(records.map((record) => record.document).filter(Boolean));
  const contractors = new Set(records.map((record) => record.contractor).filter(Boolean));
  const gross = records.reduce((sum, record) => sum + (record.gross || 0), 0);

  return {
    critical_count: counts.CRITICAL || 0,
    warning_count: counts.WARNING || 0,
    info_count: counts.INFO || 0,
    document_count: documents.size,
    contractor_count: contractors.size,
    gross_total: gross.toFixed(2),
    disclaimer: "Wyniki wymagają weryfikacji przez osobę odpowiedzialną za księgowość.",
  };
}

function auditVat(rows, mapping) {
  const issues = [];
  const seen = new Map();
  const records = rows.map((row, index) => {
    const record = {
      rowIndex: index + 1,
      document: mapped(row, "document_number", mapping),
      contractor: mapped(row, "contractor_name", mapping),
      nip: mapped(row, "contractor_nip", mapping),
      net: parseAmount(mapped(row, "net", mapping)),
      vat: parseAmount(mapped(row, "vat", mapping)),
      gross: parseAmount(mapped(row, "gross", mapping)),
      vatRate: mapped(row, "vat_rate", mapping),
      raw: row,
    };
    const key = `${record.document}|${record.nip}`;
    seen.set(key, (seen.get(key) || 0) + 1);
    return record;
  });

  records.forEach((record) => {
    const base = { area: "VAT", document: record.document, contractor: record.contractor };
    const expectedGross = record.net + record.vat;
    const difference = expectedGross - record.gross;
    if (Math.abs(difference) > 0.02) {
      issues.push({
        level: "CRITICAL",
        ...base,
        issue: `Netto + VAT = ${formatAmount(expectedGross)}, Brutto = ${formatAmount(record.gross)} (różnica ${formatAmount(difference)}).`,
        recommendation: "Zweryfikuj kwoty i mapowanie kolumn Netto, VAT oraz Brutto.",
      });
    }
    if (!record.document) {
      issues.push({ level: "CRITICAL", ...base, issue: "Brak numeru dokumentu.", recommendation: "Uzupełnij numer dokumentu lub mapowanie." });
    }
    if (!record.contractor || !record.nip) {
      issues.push({ level: "WARNING", ...base, issue: "Brak kontrahenta lub NIP.", recommendation: "Zweryfikuj dane kontrahenta." });
    }
    if (record.vatRate && !VAT_RATES.has(String(record.vatRate).toLowerCase().replace(/\s/g, ""))) {
      issues.push({ level: "WARNING", ...base, issue: `Nietypowa stawka VAT: ${record.vatRate}.`, recommendation: "Sprawdź konfigurację stawek." });
    }
    if (record.vat < 0 && !String(record.document).toLowerCase().includes("kor")) {
      issues.push({ level: "WARNING", ...base, issue: "Ujemny VAT bez oznaczenia korekty.", recommendation: "Zweryfikuj typ dokumentu." });
    }
    if (seen.get(`${record.document}|${record.nip}`) > 1) {
      issues.push({ level: "WARNING", ...base, issue: "Duplikat numeru dokumentu i NIP.", recommendation: "Sprawdź, czy dokument nie jest w imporcie wielokrotnie." });
    }
  });
  return { issues, records };
}

function auditLedger(rows, mapping) {
  const issues = [];
  const grouped = new Map();
  const records = rows.map((row) => {
    const amountWn = parseAmount(mapped(row, "amount_wn", mapping));
    const amountMa = parseAmount(mapped(row, "amount_ma", mapping));
    // Do not infer Wn/Ma account sides from Optima's account/opposite columns.
    const mainAccount = mapped(row, "account", mapping);
    const oppositeAccount = mapped(row, "account_opposite", mapping);
    const record = {
      document: mapped(row, "document_number", mapping),
      contractor: mapped(row, "contractor_name", mapping),
      description: mapped(row, "description", mapping),
      account: mainAccount,
      accountOpposite: oppositeAccount,
      accountWn: mapped(row, "account_wn", mapping),
      accountMa: mapped(row, "account_ma", mapping),
      amountWn,
      amountMa,
    };
    if (!grouped.has(record.document)) grouped.set(record.document, []);
    grouped.get(record.document).push(record);
    return record;
  });

  records.forEach((record) => {
    const base = { area: "LEDGER", document: record.document, contractor: record.contractor };
    if (!record.accountWn && !record.account) issues.push({ level: "CRITICAL", ...base, issue: "Brak konta Wn albo konta zapisu.", recommendation: "Uzupełnij mapowanie konta Wn albo pola Konto z Optimy." });
    if (!record.accountMa && !record.accountOpposite) issues.push({ level: "CRITICAL", ...base, issue: "Brak konta Ma albo konta przeciwstawnego.", recommendation: "Uzupełnij mapowanie konta Ma albo pola Konto przeciw. z Optimy." });
    if (!record.amountWn && !record.amountMa) issues.push({ level: "CRITICAL", ...base, issue: "Puste kwoty Wn/Ma.", recommendation: "Sprawdź mapowanie kwot." });
    if (!record.description) issues.push({ level: "WARNING", ...base, issue: "Brak opisu księgowania.", recommendation: "Uzupełnij opis." });
  });

  grouped.forEach((items, document) => {
    const wn = items.reduce((sum, item) => sum + item.amountWn, 0);
    const ma = items.reduce((sum, item) => sum + item.amountMa, 0);
    if (Math.abs(wn - ma) > 0.02) {
      issues.push({ level: "CRITICAL", area: "LEDGER", document, contractor: items[0]?.contractor || "", issue: "Dokument jest niezbilansowany.", recommendation: "Zweryfikuj komplet dekretów." });
    }
  });
  return { issues, records };
}
