const state = {
  headers: [],
  rows: [],
  issues: [],
  mapping: {},
  format: "-",
  fileName: "",
};

const fieldsByKind = {
  VAT_PURCHASE: ["document_number", "issue_date", "receipt_date", "contractor_nip", "contractor_name", "net", "vat", "gross", "vat_rate", "register_name"],
  VAT_SALE: ["document_number", "issue_date", "contractor_nip", "contractor_name", "net", "vat", "gross", "vat_rate", "register_name"],
  LEDGER: ["document_number", "accounting_date", "description", "account_wn", "account_ma", "amount_wn", "amount_ma", "journal", "contractor_name"],
  ACCOUNT_PLAN: ["account_number", "name", "account_type", "is_active", "jpk_s_12_1"],
  SETTLEMENTS: ["document_number", "contractor_name", "contractor_nip", "due_date", "payment_date", "amount", "paid_amount", "remaining_amount", "account", "status"],
  BANK: ["document_number", "operation_date", "description", "amount", "contractor_name", "account", "status"],
  JPK_XML: ["document_number", "contractor_nip", "contractor_name", "net", "vat", "gross"],
  OPTIMA_SCHEMA_XML: ["name", "condition", "account", "amount_expression"],
};

const requiredByKind = {
  VAT_PURCHASE: new Set(["document_number", "net", "vat", "gross"]),
  VAT_SALE: new Set(["document_number", "net", "vat", "gross"]),
  LEDGER: new Set(["document_number", "account_wn", "account_ma", "amount_wn", "amount_ma"]),
  ACCOUNT_PLAN: new Set(["account_number"]),
  SETTLEMENTS: new Set(["document_number", "amount"]),
  BANK: new Set(["amount", "description"]),
};

const aliases = {
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

const templates = {
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

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseAmount(value) {
  if (value === undefined || value === null || value === "") return 0;
  const text = String(value).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const number = Number.parseFloat(text);
  return Number.isFinite(number) ? number : 0;
}

function parseCsv(text) {
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const delimiter = [";", ",", "\t"].sort((a, b) => sample.split(b).length - sample.split(a).length)[0];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((item) => item.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((item) => item.trim() !== "")) rows.push(row);

  const headers = rows.shift()?.map((item) => item.trim()) || [];
  return {
    headers,
    rows: rows.map((items) => Object.fromEntries(headers.map((header, index) => [header, (items[index] || "").trim()]))),
  };
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error("Niepoprawny XML");
  const leafRows = [...doc.querySelectorAll("*")].slice(0, 200).map((node) => ({
    tag: node.localName,
    text: (node.textContent || "").trim().slice(0, 160),
  }));
  return { headers: ["tag", "text"], rows: leafRows };
}

function autoMap() {
  const kind = $("#dataKind").value;
  const fields = fieldsByKind[kind] || [];
  const lookup = new Map(state.headers.map((header) => [normalizeHeader(header), header]));
  state.mapping = {};

  fields.forEach((field) => {
    const candidates = aliases[field] || [field];
    for (const candidate of candidates) {
      const match = lookup.get(normalizeHeader(candidate));
      if (match) {
        state.mapping[field] = match;
        break;
      }
    }
  });
  renderMapping();
}

function renderMapping() {
  const kind = $("#dataKind").value;
  const fields = fieldsByKind[kind] || [];
  const required = requiredByKind[kind] || new Set();
  $("#mappingFields").innerHTML = fields.map((field) => {
    const options = ["", ...state.headers].map((header) => (
      `<option value="${escapeHtml(header)}" ${state.mapping[field] === header ? "selected" : ""}>${escapeHtml(header || "-")}</option>`
    )).join("");
    return `
      <div class="mapping-row">
        <span class="field-name">${field}${required.has(field) ? ' <span class="required">*</span>' : ""}</span>
        <select data-field="${field}">${options}</select>
      </div>`;
  }).join("");

  $$("#mappingFields select").forEach((select) => {
    select.addEventListener("change", () => {
      const field = select.dataset.field;
      if (select.value) state.mapping[field] = select.value;
      else delete state.mapping[field];
      updateBadges();
    });
  });
  $("#mappingCompleteness").textContent = `${Object.keys(state.mapping).length} / ${fields.length}`;
  updateBadges();
}

function renderPreview() {
  $("#previewHead").innerHTML = state.headers.length
    ? `<tr>${state.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`
    : "";
  $("#previewRows").innerHTML = state.rows.length
    ? state.rows.slice(0, 20).map((row) => `<tr>${state.headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`).join("")
    : '<tr><td class="empty">Brak danych do podgladu.</td></tr>';
}

function mapped(row, field) {
  const source = state.mapping[field];
  return source ? row[source] : "";
}

function auditVat() {
  const issues = [];
  const seen = new Map();
  const records = state.rows.map((row, index) => {
    const record = {
      rowIndex: index + 1,
      document: mapped(row, "document_number"),
      contractor: mapped(row, "contractor_name"),
      nip: mapped(row, "contractor_nip"),
      net: parseAmount(mapped(row, "net")),
      vat: parseAmount(mapped(row, "vat")),
      gross: parseAmount(mapped(row, "gross")),
      vatRate: mapped(row, "vat_rate"),
      raw: row,
    };
    const key = `${record.document}|${record.nip}`;
    seen.set(key, (seen.get(key) || 0) + 1);
    return record;
  });

  records.forEach((record) => {
    const base = { area: "VAT", document: record.document, contractor: record.contractor };
    if (Math.abs(record.net + record.vat - record.gross) > 0.02) {
      issues.push({ level: "CRITICAL", ...base, issue: "Netto + VAT nie zgadza sie z brutto.", recommendation: "Zweryfikuj kwoty i mapowanie kolumn." });
    }
    if (!record.document) {
      issues.push({ level: "CRITICAL", ...base, issue: "Brak numeru dokumentu.", recommendation: "Uzupelnij numer dokumentu lub mapowanie." });
    }
    if (!record.contractor || !record.nip) {
      issues.push({ level: "WARNING", ...base, issue: "Brak kontrahenta lub NIP.", recommendation: "Zweryfikuj dane kontrahenta." });
    }
    if (!record.vatRate) {
      issues.push({ level: "WARNING", ...base, issue: "Brak stawki VAT.", recommendation: "Zmapuj stawke VAT lub uzupelnij eksport." });
    } else if (!["0", "0%", "5", "5%", "8", "8%", "23", "23%", "zw", "np", "oo"].includes(String(record.vatRate).toLowerCase().replace(/\s/g, ""))) {
      issues.push({ level: "WARNING", ...base, issue: `Nietypowa stawka VAT: ${record.vatRate}.`, recommendation: "Sprawdz konfiguracje stawek." });
    }
    if (record.vat < 0 && !String(record.document).toLowerCase().includes("kor")) {
      issues.push({ level: "WARNING", ...base, issue: "Ujemny VAT bez oznaczenia korekty.", recommendation: "Zweryfikuj typ dokumentu." });
    }
    if (seen.get(`${record.document}|${record.nip}`) > 1) {
      issues.push({ level: "WARNING", ...base, issue: "Duplikat numeru dokumentu i NIP.", recommendation: "Sprawdz, czy dokument nie jest w imporcie wielokrotnie." });
    }
  });
  return { issues, records };
}

function auditLedger() {
  const issues = [];
  const grouped = new Map();
  const records = state.rows.map((row) => {
    const record = {
      document: mapped(row, "document_number"),
      contractor: mapped(row, "contractor_name"),
      description: mapped(row, "description"),
      accountWn: mapped(row, "account_wn"),
      accountMa: mapped(row, "account_ma"),
      amountWn: parseAmount(mapped(row, "amount_wn")),
      amountMa: parseAmount(mapped(row, "amount_ma")),
    };
    if (!grouped.has(record.document)) grouped.set(record.document, []);
    grouped.get(record.document).push(record);
    return record;
  });

  records.forEach((record) => {
    const base = { area: "LEDGER", document: record.document, contractor: record.contractor };
    if (!record.accountWn) issues.push({ level: "CRITICAL", ...base, issue: "Brak konta Wn.", recommendation: "Uzupelnij konto Wn." });
    if (!record.accountMa) issues.push({ level: "CRITICAL", ...base, issue: "Brak konta Ma.", recommendation: "Uzupelnij konto Ma." });
    if (!record.amountWn && !record.amountMa) issues.push({ level: "CRITICAL", ...base, issue: "Puste kwoty Wn/Ma.", recommendation: "Sprawdz mapowanie kwot." });
    if (!record.description) issues.push({ level: "WARNING", ...base, issue: "Brak opisu ksiegowania.", recommendation: "Uzupelnij opis." });
  });

  grouped.forEach((items, document) => {
    const wn = items.reduce((sum, item) => sum + item.amountWn, 0);
    const ma = items.reduce((sum, item) => sum + item.amountMa, 0);
    if (Math.abs(wn - ma) > 0.02) {
      issues.push({ level: "CRITICAL", area: "LEDGER", document, contractor: items[0]?.contractor || "", issue: "Dokument jest niezbilansowany.", recommendation: "Zweryfikuj komplet dekretow." });
    }
  });
  return { issues, records };
}

function runAudit() {
  const kind = $("#dataKind").value;
  let result = { issues: [], records: [] };
  if (kind === "VAT_PURCHASE" || kind === "VAT_SALE" || kind === "JPK_XML") {
    result = auditVat();
  } else if (kind === "LEDGER") {
    result = auditLedger();
  } else {
    result.issues = [{
      level: "INFO",
      area: kind,
      document: "",
      contractor: "",
      issue: "Ten typ danych ma w web GUI tryb podgladu.",
      recommendation: "Pelna walidacja jest w aplikacji Python.",
    }];
  }
  state.issues = result.issues;
  renderIssues();
  updateSummary(result.records);
  updateReport();
}

function updateSummary(records = []) {
  const counts = state.issues.reduce((acc, issue) => {
    acc[issue.level] = (acc[issue.level] || 0) + 1;
    return acc;
  }, {});
  const docs = new Set(records.map((record) => record.document).filter(Boolean));
  const contractors = new Set(records.map((record) => record.contractor).filter(Boolean));
  const gross = records.reduce((sum, record) => sum + (record.gross || 0), 0);

  $("#criticalCount").textContent = counts.CRITICAL || 0;
  $("#warningCount").textContent = counts.WARNING || 0;
  $("#infoCount").textContent = counts.INFO || 0;
  $("#documentCount").textContent = docs.size;
  $("#contractorCount").textContent = contractors.size;
  $("#grossTotal").textContent = gross.toFixed(2);
}

function renderIssues() {
  const level = $("#levelFilter").value;
  const query = $("#searchFilter").value.toLowerCase();
  const filtered = state.issues.filter((issue) => {
    const text = Object.values(issue).join(" ").toLowerCase();
    return (!level || issue.level === level) && (!query || text.includes(query));
  });

  $("#issueRows").innerHTML = filtered.length
    ? filtered.map((issue) => `
      <tr>
        <td>${escapeHtml(issue.level)}</td>
        <td>${escapeHtml(issue.area)}</td>
        <td>${escapeHtml(issue.document)}</td>
        <td>${escapeHtml(issue.contractor)}</td>
        <td>${escapeHtml(issue.issue)}</td>
        <td>${escapeHtml(issue.recommendation)}</td>
      </tr>`).join("")
    : '<tr><td colspan="6" class="empty">Brak wynikow dla filtra.</td></tr>';
}

function updateBadges() {
  const required = requiredByKind[$("#dataKind").value] || new Set();
  const missing = [...required].filter((field) => !state.mapping[field]).length;
  $("#formatBadge").textContent = `Format: ${state.format}`;
  $("#mappingBadge").textContent = `Mapowanie: ${missing ? `brakuje ${missing}` : "OK"}`;
  $("#recordBadge").textContent = `Wiersze: ${state.rows.length}`;
  $("#mappingCompleteness").textContent = `${Object.keys(state.mapping).length} / ${(fieldsByKind[$("#dataKind").value] || []).length}`;
}

function updateReport() {
  const summary = {
    critical_count: Number($("#criticalCount").textContent),
    warning_count: Number($("#warningCount").textContent),
    info_count: Number($("#infoCount").textContent),
    document_count: Number($("#documentCount").textContent),
    contractor_count: Number($("#contractorCount").textContent),
    gross_total: $("#grossTotal").textContent,
    disclaimer: "Wyniki wymagaja weryfikacji przez osobe odpowiedzialna za ksiegowosc.",
  };
  $("#reportPreview").textContent = JSON.stringify({ summary, issues: state.issues }, null, 2);
}

function generateSchema() {
  const template = templates[$("#schemaTemplate").value];
  const draft = {
    name: template.name,
    condition: template.condition,
    lines: template.lines.map(([side, account, amountExpression, description]) => ({ side, account, amountExpression, description })),
    warnings: ["Koniecznie przetestuj schemat w bazie DEMO."],
  };
  $("#schemaOutput").textContent = JSON.stringify(draft, null, 2);
}

function download(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  download("optima-audit-report.json", "application/json", $("#reportPreview").textContent);
}

function exportHtml() {
  const rows = state.issues.map((issue) => `<tr><td>${escapeHtml(issue.level)}</td><td>${escapeHtml(issue.area)}</td><td>${escapeHtml(issue.document)}</td><td>${escapeHtml(issue.contractor)}</td><td>${escapeHtml(issue.issue)}</td><td>${escapeHtml(issue.recommendation)}</td></tr>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><title>Raport audytu</title><h1>Raport audytu Optima</h1><p>Wyniki wymagaja weryfikacji przez osobe odpowiedzialna za ksiegowosc.</p><table border="1" cellspacing="0" cellpadding="6"><tr><th>Poziom</th><th>Obszar</th><th>Dokument</th><th>Kontrahent</th><th>Problem</th><th>Rekomendacja</th></tr>${rows}</table>`;
  download("optima-audit-report.html", "text/html", html);
}

function exportExcel() {
  const table = $("#issueRows").closest("table").outerHTML;
  download("optima-audit-report.xls", "application/vnd.ms-excel", table);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function reset() {
  state.headers = [];
  state.rows = [];
  state.issues = [];
  state.mapping = {};
  state.format = "-";
  state.fileName = "";
  $("#fileInput").value = "";
  $("#fileMeta").textContent = "Brak pliku";
  renderPreview();
  renderMapping();
  renderIssues();
  updateSummary([]);
  updateReport();
  updateBadges();
}

function switchView(name) {
  $$(".nav-tab").forEach((button) => button.classList.toggle("is-active", button.dataset.view === name));
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === `view-${name}`));
  const titles = {
    audit: ["Audyt", "Import, podglad i szybka walidacja eksportu."],
    mapping: ["Mapowanie", "Dopasowanie kolumn z pliku do modelu kanonicznego."],
    schema: ["Schemat", "Projekt dekretow bez importu do Optimy."],
    report: ["Raport", "Eksport wynikow lokalnie z przegladarki."],
  };
  $("#viewTitle").textContent = titles[name][0];
  $("#viewSubtitle").textContent = titles[name][1];
}

$("#fileInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  state.fileName = file.name;
  $("#fileMeta").textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;

  try {
    if (file.name.toLowerCase().endsWith(".json")) {
      const payload = JSON.parse(text);
      const rows = Array.isArray(payload) ? payload : payload.issues || payload.records || [];
      state.rows = rows;
      state.headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      state.format = "JSON";
    } else if (file.name.toLowerCase().endsWith(".xml")) {
      const parsed = parseXml(text);
      state.headers = parsed.headers;
      state.rows = parsed.rows;
      state.format = "XML";
    } else {
      const parsed = parseCsv(text);
      state.headers = parsed.headers;
      state.rows = parsed.rows;
      state.format = "CSV";
    }
    autoMap();
    renderPreview();
    updateSummary([]);
    state.issues = [];
    renderIssues();
    updateReport();
    switchView("mapping");
  } catch (error) {
    $("#fileMeta").textContent = `Blad: ${error.message}`;
  }
});

$("#dataKind").addEventListener("change", () => {
  autoMap();
  renderMapping();
});

$("#autoMap").addEventListener("click", autoMap);
$("#runAudit").addEventListener("click", () => {
  runAudit();
  switchView("audit");
});
$("#clearData").addEventListener("click", reset);
$("#levelFilter").addEventListener("change", renderIssues);
$("#searchFilter").addEventListener("input", renderIssues);
$("#generateSchema").addEventListener("click", generateSchema);
$("#exportJson").addEventListener("click", exportJson);
$("#exportHtml").addEventListener("click", exportHtml);
$("#exportExcel").addEventListener("click", exportExcel);
$$(".nav-tab").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));

renderMapping();
renderPreview();
updateReport();
generateSchema();
updateBadges();

