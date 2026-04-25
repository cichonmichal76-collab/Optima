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
const PERIODLESS_KINDS = new Set(["ACCOUNT_PLAN", "CONTRACTORS", "FIXED_ASSETS", "HR_PAYROLL"]);

export function initApp(state) {
  bindEvents(state);
  updateSqlControls();
  loadAvailableData(state);
  renderPreview(state);
  updateBadges(state);
}

function bindEvents(state) {
  $("#loadSql").addEventListener("click", () => loadSqlData(state));
  $("#scanBackups").addEventListener("click", () => scanBackups(state));
  $("#backupSelect").addEventListener("change", () => {
    if ($("#backupSelect").value) $("#backupPath").value = $("#backupSelect").value;
  });
  $("#inspectBackup").addEventListener("click", () => inspectBackup());
  $("#connectBackup").addEventListener("click", () => connectBackup(state));
  $("#refreshDataCatalog").addEventListener("click", () => loadAvailableData(state));
  $("#refreshDataCatalogPanel").addEventListener("click", () => loadAvailableData(state));
  $("#sqlDatabase").addEventListener("change", () => {
    updateBadges(state);
    loadAvailableData(state);
  });
  $("#dataKind").addEventListener("change", () => updateSqlControls());
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
    updateBadges(state);
    await loadAvailableData(state);
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
    $("#sqlMeta").textContent = "SQL: brak jawnego pobierania dla tego typu danych.";
  } else if (PERIODLESS_KINDS.has(kind)) {
    $("#sqlMeta").textContent = "SQL: ten moduł nie wymaga okresu.";
  } else {
    $("#sqlMeta").textContent = "SQL: podaj okres RRRRMM i pobierz dane.";
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
    ? `${selectedKindLabel()} - pokazuję pierwsze ${Math.min(state.rows.length, 20)} z ${state.rows.length} wierszy`
    : "Brak danych";
}

function updateBadges(state) {
  $("#databaseBadge").textContent = `Baza: ${$("#sqlDatabase").value.trim() || "-"}`;
  $("#recordBadge").textContent = `Wiersze: ${state.rows.length}`;
}

function selectedKindLabel() {
  const selected = $("#dataKind").selectedOptions[0];
  return selected ? selected.textContent : "Dane SQL";
}
