import { ALIASES, FIELD_HELP_TEXTS, FIELD_LABELS, FIELDS_BY_KIND, REQUIRED_BY_KIND, VIEW_TITLES } from "./config.js";
import { buildSummary, runAudit } from "./audit.js";
import { exportExcel, exportHtml, exportJson } from "./exporters.js";
import { generateSchemaDraft } from "./schema.js";
import { $, $$, escapeHtml, normalizeHeader } from "./utils.js";

const SQL_SUPPORTED_KINDS = new Set([
  "VAT_PURCHASE",
  "VAT_SALE",
  "LEDGER",
  "ACCOUNT_PLAN",
  "SETTLEMENTS",
  "BANK",
  "JPK_DECLARATIONS",
  "CONTRACTORS",
  "DOCUMENTS",
  "FIXED_ASSETS",
  "HR_PAYROLL",
]);
const PERIODLESS_KINDS = new Set(["ACCOUNT_PLAN", "CONTRACTORS", "FIXED_ASSETS", "HR_PAYROLL"]);

export function initApp(state) {
  bindEvents(state);
  updateSqlControls();
  loadAvailableData(state);
  renderMapping(state);
  renderPreview(state);
  updateReport(state);
  renderSchemaDraft();
  updateBadges(state);
}

function bindEvents(state) {
  $("#loadSql").addEventListener("click", () => loadSqlData(state));
  $("#scanBackups").addEventListener("click", () => scanBackups(state));
  $("#backupSelect").addEventListener("change", () => {
    if ($("#backupSelect").value) $("#backupPath").value = $("#backupSelect").value;
  });
  $("#inspectBackup").addEventListener("click", () => inspectBackup(state));
  $("#connectBackup").addEventListener("click", () => connectBackup(state));
  $("#refreshDataCatalog").addEventListener("click", () => loadAvailableData(state));
  $("#refreshDataCatalogPanel").addEventListener("click", () => loadAvailableData(state));
  $("#sqlDatabase").addEventListener("change", () => loadAvailableData(state));
  $("#dataKind").addEventListener("change", () => {
    updateSqlControls();
    autoMap(state);
    renderMapping(state);
  });
  $("#autoMap").addEventListener("click", () => autoMap(state));
  $("#runAudit").addEventListener("click", () => {
    const result = runAudit($("#dataKind").value, state.rows, state.mapping);
    state.issues = result.issues;
    renderIssues(state);
    updateSummary(buildSummary(state.issues, result.records));
    updateReport(state);
    switchView("audit");
  });
  $("#clearData").addEventListener("click", () => reset(state));
  $("#levelFilter").addEventListener("change", () => renderIssues(state));
  $("#searchFilter").addEventListener("input", () => renderIssues(state));
  $("#generateSchema").addEventListener("click", renderSchemaDraft);
  $("#exportJson").addEventListener("click", () => exportJson($("#reportPreview").textContent));
  $("#exportHtml").addEventListener("click", () => exportHtml(state.issues));
  $("#exportExcel").addEventListener("click", () => exportExcel($("#issueRows").closest("table").outerHTML));
  $$(".nav-tab").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
}

async function loadSqlData(state) {
  const kind = $("#dataKind").value;
  await loadModuleData(state, kind);
}

async function loadModuleData(state, kind) {
  if (!SQL_SUPPORTED_KINDS.has(kind)) {
    $("#sqlMeta").textContent = "Ten typ danych nie ma jeszcze jawnego mapowania SQL.";
    return;
  }

  const request = {
    module: kind,
    server: $("#sqlServer").value.trim(),
    database: $("#sqlDatabase").value.trim(),
    period: $("#sqlPeriod").value.trim(),
  };

  $("#loadSql").disabled = true;
  $("#sqlMeta").textContent = "Pobieram dane z SQL...";

  try {
    const response = await fetch("/api/module-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(payload.error || "Nie udało się pobrać danych z SQL.");
    }

    state.headers = payload.headers || [];
    state.rows = payload.rows || [];
    state.format = "SQL";
    state.fileName = `${request.database}:${kind}${request.period ? `:${request.period}` : ""}`;
    state.issues = [];
    if ($(`#dataKind option[value="${kind}"]`)) $("#dataKind").value = kind;
    $("#sqlMeta").textContent = `SQL OK: ${state.rows.length} wierszy. ${(payload.notes || [])[0] || ""}`;
    autoMap(state);
    renderPreview(state);
    updateSummary(buildSummary([], []));
    renderIssues(state);
    updateReport(state);
    switchView("mapping");
  } catch (error) {
    $("#sqlMeta").textContent = `Błąd SQL: ${error.message}`;
  } finally {
    $("#loadSql").disabled = false;
  }
}

async function scanBackups(state) {
  $("#backupMeta").textContent = "Skanuję lokalne dyski w poszukiwaniu .BAK/.BAC...";
  try {
    const response = await fetch("/api/backups");
    const payload = await response.json();
    state.backups = payload.backups || [];
    renderBackupOptions(state.backups);
    $("#backupMeta").textContent = state.backups.length
      ? `Znaleziono ${state.backups.length} backupów. Wybierz z listy.`
      : "Nie znaleziono backupów w głównych katalogach dysków i profilu użytkownika.";
  } catch (error) {
    $("#backupMeta").textContent = `Błąd skanowania: ${error.message}`;
  }
}

function renderBackupOptions(backups) {
  $("#backupSelect").innerHTML = [
    '<option value="">Wykryte backupy...</option>',
    ...backups.map((backup) => (
      `<option value="${escapeHtml(backup.path)}">${escapeHtml(backup.name)} (${escapeHtml(backup.size_mb)} MB)</option>`
    )),
  ].join("");
  if (backups[0]) {
    $("#backupSelect").value = backups[0].path;
    $("#backupPath").value = backups[0].path;
  }
}

async function inspectBackup() {
  const request = {
    path: $("#backupPath").value.trim(),
    server: $("#sqlServer").value.trim(),
  };
  $("#backupMeta").textContent = "Sprawdzam backup...";
  try {
    const response = await fetch("/api/backup-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się sprawdzić backupu.");
    $("#sqlDatabase").value = payload.suggested_database || $("#sqlDatabase").value;
    $("#backupInfo").textContent = JSON.stringify({
      plik: payload.path,
      baza_z_backupu: payload.database_name,
      nazwa_backupu: payload.backup_name,
      serwer_zrodlowy: payload.server_name,
      data_start: payload.backup_start_date,
      data_koniec: payload.backup_finish_date,
      sugerowana_baza_robocza: payload.suggested_database,
      pliki: payload.files,
    }, null, 2);
    $("#backupMeta").textContent = "Backup sprawdzony. Możesz podłączyć kopię read-only.";
    switchView("database");
  } catch (error) {
    $("#backupMeta").textContent = `Błąd backupu: ${error.message}`;
    $("#backupInfo").textContent = error.message;
  }
}

async function connectBackup(state) {
  const request = {
    path: $("#backupPath").value.trim(),
    server: $("#sqlServer").value.trim(),
    target_database: $("#sqlDatabase").value.trim(),
  };
  $("#backupMeta").textContent = "Odtwarzam backup do bazy roboczej read-only. To może potrwać...";
  $("#connectBackup").disabled = true;
  try {
    const response = await fetch("/api/connect-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się podłączyć backupu.");
    $("#sqlDatabase").value = payload.database;
    $("#backupInfo").textContent = JSON.stringify(payload, null, 2);
    $("#backupMeta").textContent = `Podłączono bazę ${payload.database} jako read-only.`;
    await loadAvailableData(state);
    switchView("database");
  } catch (error) {
    $("#backupMeta").textContent = `Błąd podłączenia: ${error.message}`;
    $("#backupInfo").textContent = error.message;
  } finally {
    $("#connectBackup").disabled = false;
  }
}

async function loadAvailableData(state) {
  const request = {
    server: $("#sqlServer").value.trim(),
    database: $("#sqlDatabase").value.trim(),
  };
  try {
    const response = await fetch("/api/available-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się pobrać katalogu danych.");
    state.availableData = payload.modules || [];
    renderAvailableData(state);
  } catch (error) {
    const message = `<div class="available-card is-empty">Brak połączenia: ${escapeHtml(error.message)}</div>`;
    $("#availableDataList").innerHTML = message;
    $("#databaseDataList").innerHTML = message;
  }
}

function renderAvailableData(state) {
  const modules = (state.availableData || []).filter((item) => Number(item.record_count || 0) > 0);
  const html = modules.length
    ? modules.map((item) => availableDataCard(item)).join("")
    : '<div class="available-card is-empty">W tej bazie nie wykryto pewnych modułów do pobrania.</div>';
  $("#availableDataList").innerHTML = html;
  $("#databaseDataList").innerHTML = html;
  $$(".available-card[data-module]").forEach((card) => {
    card.addEventListener("click", () => loadModuleData(state, card.dataset.module));
  });
}

function availableDataCard(item) {
  const count = Number(item.record_count || 0).toLocaleString("pl-PL");
  const sensitive = Number(item.sensitive || 0) ? '<span class="available-note">dane wrażliwe</span>' : "";
  return `
    <div class="available-card" data-module="${escapeHtml(item.code)}">
      <div class="available-title">
        <span>${escapeHtml(item.label)}</span>
        <span class="available-count">${escapeHtml(count)}</span>
      </div>
      <span class="available-desc">${escapeHtml(item.description)}</span>
      ${sensitive}
    </div>`;
}

function updateSqlControls() {
  const kind = $("#dataKind").value;
  const supported = SQL_SUPPORTED_KINDS.has(kind);
  $("#loadSql").disabled = !supported;
  $("#sqlPeriod").disabled = PERIODLESS_KINDS.has(kind) || !supported;
  if (!supported) {
    $("#sqlMeta").textContent = "SQL: brak jawnego mapowania dla tego typu danych.";
  } else if (PERIODLESS_KINDS.has(kind)) {
    $("#sqlMeta").textContent = "SQL: ten moduł nie wymaga okresu.";
  } else {
    $("#sqlMeta").textContent = "SQL: podaj okres RRRRMM i pobierz dane.";
  }
}

function autoMap(state) {
  const kind = $("#dataKind").value;
  const fields = FIELDS_BY_KIND[kind] || [];
  const lookup = new Map(state.headers.map((header) => [normalizeHeader(header), header]));
  state.mapping = {};

  fields.forEach((field) => {
    const candidates = ALIASES[field] || [field];
    for (const candidate of candidates) {
      const match = lookup.get(normalizeHeader(candidate));
      if (match) {
        state.mapping[field] = match;
        break;
      }
    }
  });
  renderMapping(state);
}

function renderMapping(state) {
  const kind = $("#dataKind").value;
  const fields = FIELDS_BY_KIND[kind] || [];
  const required = requiredFieldsForKind(kind, state.mapping);
  $("#mappingFields").innerHTML = fields.map((field) => {
    const label = FIELD_LABELS[field] || field;
    const helpText = FIELD_HELP_TEXTS[field] || "Pole używane przez wewnętrzny model aplikacji.";
    const options = ["", ...state.headers].map((header) => (
      `<option value="${escapeHtml(header)}" ${state.mapping[field] === header ? "selected" : ""}>${escapeHtml(header || "-")}</option>`
    )).join("");
    return `
      <div class="mapping-row">
        <div class="field-copy">
          <span class="field-label">${escapeHtml(label)}${required.has(field) ? ' <span class="required">*</span>' : ""}</span>
          <span class="field-help">${escapeHtml(helpText)}</span>
          <span class="field-code">${escapeHtml(field)}</span>
        </div>
        <select data-field="${field}">${options}</select>
      </div>`;
  }).join("");

  $$("#mappingFields select").forEach((select) => {
    select.addEventListener("change", () => {
      const field = select.dataset.field;
      if (select.value) state.mapping[field] = select.value;
      else delete state.mapping[field];
      updateBadges(state);
    });
  });
  updateBadges(state);
}

function renderPreview(state) {
  $("#previewHead").innerHTML = state.headers.length
    ? `<tr>${state.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`
    : "";
  $("#previewRows").innerHTML = state.rows.length
    ? state.rows.slice(0, 20).map((row) => `<tr>${state.headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`).join("")
    : '<tr><td class="empty">Brak danych do podgladu.</td></tr>';
}

function renderIssues(state) {
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

function updateSummary(summary) {
  $("#criticalCount").textContent = summary.critical_count;
  $("#warningCount").textContent = summary.warning_count;
  $("#infoCount").textContent = summary.info_count;
  $("#documentCount").textContent = summary.document_count;
  $("#contractorCount").textContent = summary.contractor_count;
  $("#grossTotal").textContent = summary.gross_total;
}

function updateBadges(state) {
  const kind = $("#dataKind").value;
  const missingFields = missingRequiredFields(kind, state.mapping);
  const missing = missingFields.length;
  const fieldCount = (FIELDS_BY_KIND[kind] || []).length;
  $("#formatBadge").textContent = `Format: ${state.format}`;
  $("#mappingBadge").textContent = `Mapowanie: ${missing ? `brakuje ${missing}` : "OK"}`;
  $("#recordBadge").textContent = `Wiersze: ${state.rows.length}`;
  $("#mappingCompleteness").textContent = `${Object.keys(state.mapping).length} / ${fieldCount}`;
  updateMappingStatus(state, missingFields);
}

function requiredFieldsForKind(kind, mapping = {}) {
  const required = new Set(REQUIRED_BY_KIND[kind] || []);
  if (kind === "LEDGER") {
    if (mapping.account_wn || mapping.account_ma) {
      required.add("account_wn");
      required.add("account_ma");
    } else {
      required.add("account");
      required.add("account_opposite");
    }
  }
  return required;
}

function missingRequiredFields(kind, mapping) {
  const baseRequired = REQUIRED_BY_KIND[kind] || new Set();
  const missing = [...baseRequired].filter((field) => !mapping[field]);
  if (kind === "LEDGER") {
    const hasOptimaAccounts = mapping.account && mapping.account_opposite;
    const hasExplicitSides = mapping.account_wn && mapping.account_ma;
    if (!hasOptimaAccounts && !hasExplicitSides) {
      if (mapping.account_wn || mapping.account_ma) {
        if (!mapping.account_wn) missing.push("account_wn");
        if (!mapping.account_ma) missing.push("account_ma");
      } else {
        if (!mapping.account) missing.push("account");
        if (!mapping.account_opposite) missing.push("account_opposite");
      }
    }
  }
  return missing;
}

function updateMappingStatus(state, missingFields) {
  const status = $("#mappingStatus");
  if (!status) return;

  status.classList.remove("is-idle", "is-success", "is-fail");
  if (!state.headers.length) {
    status.classList.add("is-idle");
    status.textContent = "Mapowanie oczekuje na dane z SQL.";
    return;
  }

  if (!missingFields.length) {
    status.classList.add("is-success");
    status.textContent = "Mapowanie zakończone sukcesem. Wszystkie wymagane pola są przypisane.";
    return;
  }

  const missingLabels = missingFields.map((field) => FIELD_LABELS[field] || field).join(", ");
  status.classList.add("is-fail");
  status.textContent = `Mapowanie zakończone niepowodzeniem. Brakuje: ${missingLabels}.`;
}

function updateReport(state) {
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

function renderSchemaDraft() {
  const draft = generateSchemaDraft($("#schemaTemplate").value);
  $("#schemaOutput").textContent = JSON.stringify(draft, null, 2);
}

function reset(state) {
  state.headers = [];
  state.rows = [];
  state.issues = [];
  state.mapping = {};
  state.format = "-";
  state.fileName = "";
  updateSqlControls();
  renderPreview(state);
  renderMapping(state);
  renderIssues(state);
  updateSummary(buildSummary([], []));
  updateReport(state);
  updateBadges(state);
}

function switchView(name) {
  $$(".nav-tab").forEach((button) => button.classList.toggle("is-active", button.dataset.view === name));
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.id === `view-${name}`));
  $("#viewTitle").textContent = VIEW_TITLES[name][0];
  $("#viewSubtitle").textContent = VIEW_TITLES[name][1];
}
