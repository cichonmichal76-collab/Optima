const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;

export async function parseInputFile(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx")) {
    return { format: "XLSX", ...(await parseXlsx(await file.arrayBuffer())) };
  }
  if (lowerName.endsWith(".xls")) {
    return parseLegacySpreadsheet(file);
  }

  const text = await file.text();
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

async function parseLegacySpreadsheet(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/preview", { method: "POST", body: formData });
  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Lokalny serwer nie zwrócił poprawnej odpowiedzi dla pliku XLS.");
  }
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "Nie udało się wczytać pliku XLS przez lokalny serwer.");
  }
  return payload;
}

export async function parseXlsx(arrayBuffer) {
  const zipEntries = await readZipEntries(arrayBuffer);
  const workbookXml = zipEntries.get("xl/workbook.xml");
  const relsXml = zipEntries.get("xl/_rels/workbook.xml.rels");
  const sharedStrings = readSharedStrings(zipEntries.get("xl/sharedStrings.xml"));
  const sheetPath = findFirstWorksheetPath(workbookXml, relsXml, zipEntries);
  const sheetXml = zipEntries.get(sheetPath);

  if (!sheetXml) {
    throw new Error("Nie znaleziono arkusza w pliku XLSX.");
  }

  const sheetRows = readWorksheetRows(sheetXml, sharedStrings);
  const firstDataRowIndex = sheetRows.findIndex((row) => row.some((value) => String(value ?? "").trim() !== ""));
  if (firstDataRowIndex < 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = sheetRows[firstDataRowIndex];
  const headers = makeUniqueHeaders(rawHeaders.map((header, index) => String(header || `Kolumna ${index + 1}`).trim()));
  const rows = sheetRows.slice(firstDataRowIndex + 1)
    .filter((row) => row.some((value) => String(value ?? "").trim() !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));

  return { headers, rows };
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

async function readZipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let cursor = view.getUint32(eocdOffset + 16, true);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== ZIP_CENTRAL_DIRECTORY) {
      throw new Error("Niepoprawna struktura ZIP w pliku XLSX.");
    }

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const name = decodeBytes(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const content = await readZipEntry(bytes, view, localHeaderOffset, compressedSize, method);

    entries.set(name.replace(/\\/g, "/"), decodeBytes(content));
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  throw new Error("Plik XLSX nie wygląda jak poprawne archiwum ZIP.");
}

async function readZipEntry(bytes, view, localHeaderOffset, compressedSize, method) {
  if (view.getUint32(localHeaderOffset, true) !== ZIP_LOCAL_FILE_HEADER) {
    throw new Error("Niepoprawny nagłówek lokalny ZIP w pliku XLSX.");
  }

  const nameLength = view.getUint16(localHeaderOffset + 26, true);
  const extraLength = view.getUint16(localHeaderOffset + 28, true);
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + compressedSize);

  if (method === 0) {
    return compressed;
  }
  if (method !== 8) {
    throw new Error(`Nieobsługiwana metoda kompresji XLSX: ${method}.`);
  }
  if (!("DecompressionStream" in window)) {
    throw new Error("Ta przeglądarka nie obsługuje dekompresji XLSX. Użyj CSV albo aplikacji Python.");
  }

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readSharedStrings(xml) {
  if (!xml) return [];
  const doc = parseXmlDocument(xml);
  return elementsByLocalName(doc, "si").map((item) => (
    elementsByLocalName(item, "t").map((node) => node.textContent || "").join("")
  ));
}

function findFirstWorksheetPath(workbookXml, relsXml, zipEntries) {
  if (!workbookXml || !relsXml) {
    const fallback = [...zipEntries.keys()].find((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path));
    if (!fallback) throw new Error("Nie znaleziono definicji skoroszytu XLSX.");
    return fallback;
  }

  const workbook = parseXmlDocument(workbookXml);
  const rels = parseXmlDocument(relsXml);
  const firstSheet = elementsByLocalName(workbook, "sheet")[0];
  const relationshipId = firstSheet?.getAttribute("r:id")
    || firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");

  const relationship = elementsByLocalName(rels, "Relationship").find((item) => item.getAttribute("Id") === relationshipId);
  const target = relationship?.getAttribute("Target");
  if (!target) {
    throw new Error("Nie znaleziono relacji do pierwszego arkusza XLSX.");
  }

  return normalizeZipPath(target.startsWith("/") ? target.slice(1) : `xl/${target}`);
}

function readWorksheetRows(xml, sharedStrings) {
  const doc = parseXmlDocument(xml);
  return elementsByLocalName(doc, "row").map((row) => {
    const values = [];
    elementsByLocalName(row, "c").forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const columnIndex = columnRefToIndex(ref.replace(/\d+$/g, ""));
      values[columnIndex] = readCellValue(cell, sharedStrings);
    });
    return values.map((value) => value ?? "");
  });
}

function readCellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  const value = firstElementText(cell, "v");
  if (type === "s") return sharedStrings[Number(value)] || "";
  if (type === "inlineStr") return elementsByLocalName(cell, "t").map((node) => node.textContent || "").join("");
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return value || "";
}

function firstElementText(root, localName) {
  return elementsByLocalName(root, localName)[0]?.textContent || "";
}

function elementsByLocalName(root, localName) {
  return [...root.getElementsByTagName("*")].filter((element) => element.localName === localName);
}

function parseXmlDocument(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Niepoprawny XML wewnątrz pliku XLSX.");
  }
  return doc;
}

function columnRefToIndex(ref) {
  let index = 0;
  for (const char of ref.toUpperCase()) {
    index = index * 26 + char.charCodeAt(0) - 64;
  }
  return Math.max(index - 1, 0);
}

function makeUniqueHeaders(headers) {
  const counts = new Map();
  return headers.map((header, index) => {
    const base = header || `Kolumna ${index + 1}`;
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    return count ? `${base} (${count + 1})` : base;
  });
}

function normalizeZipPath(path) {
  const parts = [];
  path.split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}

function decodeBytes(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}
