export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

export function normalizeHeader(value) {
  return String(value || "")
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => ({
      "ą": "a",
      "ć": "c",
      "ę": "e",
      "ł": "l",
      "ń": "n",
      "ó": "o",
      "ś": "s",
      "ź": "z",
      "ż": "z",
      "Ą": "a",
      "Ć": "c",
      "Ę": "e",
      "Ł": "l",
      "Ń": "n",
      "Ó": "o",
      "Ś": "s",
      "Ź": "z",
      "Ż": "z",
    }[char]))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseAmount(value) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  let text = String(value).trim();
  const isNegative = text.startsWith("(") && text.endsWith(")");
  if (isNegative) text = text.slice(1, -1);

  text = text.replace(/\s/g, "").replace(/\u00a0/g, "");
  const commaIndex = text.lastIndexOf(",");
  const dotIndex = text.lastIndexOf(".");
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    text = text.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
  } else if (commaIndex >= 0) {
    text = text.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replaceAll(".", "");
  }

  const number = Number.parseFloat(text);
  if (!Number.isFinite(number)) return 0;
  return isNegative ? -number : number;
}

export function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

export function mapped(row, field, mapping) {
  const source = mapping[field];
  return source ? row[source] : "";
}

export function download(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
