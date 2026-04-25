export function parseInputFile(fileName, text) {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".json")) {
    const payload = JSON.parse(text);
    const rows = Array.isArray(payload) ? payload : payload.issues || payload.records || [];
    return {
      format: "JSON",
      headers: [...new Set(rows.flatMap((row) => Object.keys(row)))],
      rows,
    };
  }
  if (lowerName.endsWith(".xml")) {
    return { format: "XML", ...parseXml(text) };
  }
  return { format: "CSV", ...parseCsv(text) };
}

export function parseCsv(text) {
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

export function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error("Niepoprawny XML");
  const leafRows = [...doc.querySelectorAll("*")].slice(0, 200).map((node) => ({
    tag: node.localName,
    text: (node.textContent || "").trim().slice(0, 160),
  }));
  return { headers: ["tag", "text"], rows: leafRows };
}

