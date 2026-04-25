import { ALIASES, FIELD_HELP_TEXTS, FIELD_LABELS, FIELDS_BY_KIND, REQUIRED_BY_KIND, VIEW_TITLES } from "./config.js";
import { buildSummary, runAudit } from "./audit.js";
import { exportExcel, exportHtml, exportJson } from "./exporters.js";
import { parseInputFile } from "./parsers.js";
import { generateSchemaDraft } from "./schema.js";
import { $, $$, escapeHtml, normalizeHeader } from "./utils.js";

export function initApp(state) {
  bindEvents(state);
  renderMapping(state);
  renderPreview(state);
  updateReport(state);
  renderSchemaDraft();
  updateBadges(state);
}

function bindEvents(state) {
  $("#fileInput").addEventListener("change", (event) => handleFileChange(event, state));
  $("#dataKind").addEventListener("change", () => {
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

async function handleFileChange(event, state) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  state.fileName = file.name;
  $("#fileMeta").textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;

  try {
    const parsed = parseInputFile(file.name, text);
    state.headers = parsed.headers;
    state.rows = parsed.rows;
    state.format = parsed.format;
    state.issues = [];
    autoMap(state);
    renderPreview(state);
    updateSummary(buildSummary([], []));
    renderIssues(state);
    updateReport(state);
    switchView("mapping");
  } catch (error) {
    $("#fileMeta").textContent = `Blad: ${error.message}`;
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
  const required = REQUIRED_BY_KIND[kind] || new Set();
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
  const required = REQUIRED_BY_KIND[$("#dataKind").value] || new Set();
  const missing = [...required].filter((field) => !state.mapping[field]).length;
  const fieldCount = (FIELDS_BY_KIND[$("#dataKind").value] || []).length;
  $("#formatBadge").textContent = `Format: ${state.format}`;
  $("#mappingBadge").textContent = `Mapowanie: ${missing ? `brakuje ${missing}` : "OK"}`;
  $("#recordBadge").textContent = `Wiersze: ${state.rows.length}`;
  $("#mappingCompleteness").textContent = `${Object.keys(state.mapping).length} / ${fieldCount}`;
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
  $("#fileInput").value = "";
  $("#fileMeta").textContent = "Brak pliku";
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
