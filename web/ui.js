import { $, $$, escapeHtml } from "./utils.js";

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

export function initApp(state) {
  bindEvents(state);
  updateSqlControls();
  updateTimeFilterMeta();
  renderPreview(state);
  updateBadges(state);
}

function bindEvents(state) {
  $("#loadSql").addEventListener("click", () => loadSqlData(state));
  $("#scanBackups").addEventListener("click", () => scanBackups(state));
  $("#connectBackup").addEventListener("click", () => connectBackup(state));
  $("#refreshDataCatalogPanel").addEventListener("click", () => loadAvailableData(state));
  $("#sqlDatabase").addEventListener("change", () => {
    updateBadges(state);
    loadAvailableData(state);
  });
  $("#dataKind").addEventListener("change", () => updateSqlControls());
  $("#applyTimeFilter").addEventListener("click", () => applyTimeFilter(state));
  ["#filterYear", "#filterMonth", "#filterDateFrom", "#filterDateTo"].forEach((selector) => {
    $(selector).addEventListener("change", updateTimeFilterMeta);
    $(selector).addEventListener("input", updateTimeFilterMeta);
  });
}

async function loadSqlData(state) {
  const kind = $("#dataKind").value;
  await loadModuleData(state, kind);
}

async function loadModuleData(state, kind) {
  if (!SQL_SUPPORTED_KINDS.has(kind)) {
    $("#sqlMeta").textContent = "Ten typ danych nie ma jeszcze jawnego pobierania z SQL.";
    return;
  }
  if (!$("#sqlDatabase").value.trim()) {
    $("#sqlMeta").textContent = "Najpierw podłącz bazę.";
    return;
  }

  const request = {
    module: kind,
    server: $("#sqlServer").value.trim(),
    database: $("#sqlDatabase").value.trim(),
    ...getTimeFilterPayload(),
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
    state.fileName = `${request.database}:${kind}:${describeTimeFilter()}`;
    state.currentModule = kind;
    if ($(`#dataKind option[value="${kind}"]`)) $("#dataKind").value = kind;
    $("#sqlMeta").textContent = `SQL OK: ${state.rows.length} wierszy. ${(payload.notes || [])[0] || ""}`;
    renderPreview(state);
    updateBadges(state);
  } catch (error) {
    $("#sqlMeta").textContent = `Błąd SQL: ${error.message}`;
  } finally {
    $("#loadSql").disabled = false;
  }
}

async function scanBackups(state) {
  const directory = $("#backupDirectory").value.trim();
  $("#backupPath").value = "";
  $("#connectBackup").disabled = true;
  $("#backupMeta").textContent = "Status: szukam pliku .BAK/.BAC w wybranym katalogu...";
  $("#backupInfo").textContent = "Status: skanowanie katalogu.";
  try {
    const query = directory ? `?root=${encodeURIComponent(directory)}` : "";
    const response = await fetch(`/api/backups${query}`);
    const payload = await response.json();
    state.backups = payload.backups || [];
    selectNewestBackup(state.backups);
  } catch (error) {
    $("#backupMeta").textContent = `Status: błąd wgrywania pliku: ${error.message}`;
    $("#backupInfo").textContent = `Status: błąd - ${error.message}`;
  }
}

function selectNewestBackup(backups) {
  const selected = backups[0];
  if (!selected) {
    $("#backupMeta").textContent = "Status: nie znaleziono pliku .BAK/.BAC w tym katalogu.";
    $("#backupInfo").textContent = "Status: brak backupu do podłączenia.";
    return;
  }
  $("#backupPath").value = selected.path;
  $("#connectBackup").disabled = false;
  $("#backupMeta").textContent = `Status: wybrano ${selected.name} (${selected.size_mb} MB).`;
  $("#backupInfo").textContent = `Status: plik gotowy do podłączenia.\nPlik: ${selected.path}`;
}

async function connectBackup(state) {
  const path = $("#backupPath").value.trim();
  const previousDatabase = $("#sqlDatabase").value.trim();
  if (!path) {
    $("#backupMeta").textContent = "Status: najpierw kliknij „Wgraj plik” i wybierz backup.";
    $("#backupInfo").textContent = "Status: brak wybranego pliku backupu.";
    return;
  }
  $("#backupMeta").textContent = "Status: sprawdzam backup...";
  $("#backupInfo").textContent = "Status: sprawdzam strukturę backupu.";
  $("#connectBackup").disabled = true;
  try {
    const inspected = await inspectSelectedBackup(path);
    const request = {
      path,
      server: $("#sqlServer").value.trim(),
      target_database: inspected.suggested_database || $("#sqlDatabase").value.trim(),
    };
    $("#backupMeta").textContent = "Status: podłączam bazę read-only. To może potrwać...";
    $("#backupInfo").textContent = `Status: odtwarzam kopię read-only.\nBaza: ${request.target_database}`;
    const response = await fetch("/api/connect-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Nie udało się podłączyć backupu.");
    $("#sqlDatabase").value = payload.database;
    $("#backupMeta").textContent = `Status: podłączono bazę ${payload.database}.`;
    $("#backupInfo").textContent = `Status: podłączono bazę read-only.\nBaza: ${payload.database}\nPlik: ${payload.source_path}`;
    updateBadges(state);
    updateSqlControls();
    updateTimeFilterMeta();
    await loadAvailableData(state);
  } catch (error) {
    $("#sqlDatabase").value = previousDatabase;
    updateBadges(state);
    updateSqlControls();
    if (!previousDatabase) renderNoDatabase();
    $("#backupMeta").textContent = `Status: błąd podłączenia - ${error.message}`;
    $("#backupInfo").textContent = `Status: błąd - ${error.message}`;
  } finally {
    $("#connectBackup").disabled = !$("#backupPath").value.trim();
  }
}

async function inspectSelectedBackup(path) {
  const response = await fetch("/api/backup-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      server: $("#sqlServer").value.trim(),
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "Nie udało się sprawdzić backupu.");
  }
  return payload;
}

async function loadAvailableData(state) {
  if (!$("#sqlDatabase").value.trim()) {
    renderNoDatabase();
    return;
  }

  const request = {
    server: $("#sqlServer").value.trim(),
    database: $("#sqlDatabase").value.trim(),
    ...getTimeFilterPayload(),
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

function renderNoDatabase() {
  const message = '<div class="available-card is-empty">Najpierw podłącz bazę.</div>';
  $("#availableDataList").innerHTML = message;
  $("#databaseDataList").innerHTML = message;
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
  if (!$("#sqlDatabase").value.trim()) {
    $("#sqlMeta").textContent = "Najpierw podłącz bazę.";
  } else if (!supported) {
    $("#sqlMeta").textContent = "SQL: brak jawnego pobierania dla tego typu danych.";
  } else {
    $("#sqlMeta").textContent = `SQL: pobieranie według filtra: ${describeTimeFilter()}.`;
  }
}

function renderPreview(state) {
  $("#previewHead").innerHTML = state.headers.length
    ? `<tr>${state.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`
    : "";
  $("#previewRows").innerHTML = state.rows.length
    ? state.rows.slice(0, 20).map((row) => `<tr>${state.headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`).join("")
    : '<tr><td class="empty">Wybierz kafel z Dostępne dane albo kliknij Pobierz z SQL.</td></tr>';
  $("#previewMeta").textContent = state.rows.length
    ? `${selectedKindLabel()} - ${describeTimeFilter()} - pokazuję pierwsze ${Math.min(state.rows.length, 20)} z ${state.rows.length} wierszy`
    : "Brak danych";
}

function updateBadges(state) {
  $("#connectedDatabaseName").textContent = $("#sqlDatabase").value.trim() || "Brak podłączonej bazy";
  $("#recordBadge").textContent = `Wiersze: ${state.rows.length}`;
}

function selectedKindLabel() {
  const selected = $("#dataKind").selectedOptions[0];
  return selected ? selected.textContent : "Dane SQL";
}

async function applyTimeFilter(state) {
  updateTimeFilterMeta();
  await loadAvailableData(state);
  if (state.currentModule) {
    await loadModuleData(state, state.currentModule);
  }
}

function getTimeFilterPayload() {
  const year = $("#filterYear").value.trim();
  const month = $("#filterMonth").value;
  const dateFrom = $("#filterDateFrom").value;
  const dateTo = $("#filterDateTo").value;

  if (dateFrom || dateTo) {
    return { date_from: dateFrom, date_to: dateTo };
  }
  if (year && month) {
    return { period: `${year}${month}` };
  }
  if (year) {
    return { year };
  }
  return {};
}

function updateTimeFilterMeta() {
  $("#timeFilterMeta").textContent = `Filtr: ${describeTimeFilter()}`;
}

function describeTimeFilter() {
  const year = $("#filterYear").value.trim();
  const month = $("#filterMonth").value;
  const monthLabel = $("#filterMonth").selectedOptions[0]?.textContent.toLowerCase() || "";
  const dateFrom = $("#filterDateFrom").value;
  const dateTo = $("#filterDateTo").value;

  if (dateFrom || dateTo) {
    if (dateFrom && dateTo) return `${dateFrom} - ${dateTo}`;
    if (dateFrom) return `od ${dateFrom}`;
    return `do ${dateTo}`;
  }
  if (year && month) return `${monthLabel} ${year}`;
  if (year) return `rok ${year}`;
  return "bez ograniczenia dat";
}
