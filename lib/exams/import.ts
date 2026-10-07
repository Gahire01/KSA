import { inflateRawSync } from "node:zlib";

/**
 * Question import: CSV text, CSV file, or .xlsx, validated row by row.
 *
 * Dependency-free on purpose. A CSV is parsed by a small RFC 4180 reader, and an
 * .xlsx (a zip of XML) by reading only the handful of parts that hold cell text,
 * with a hard size cap on every part so a crafted "zip bomb" cannot exhaust
 * memory. Nothing here evaluates anything: a cell that is, or starts like, a
 * formula is rejected, never interpreted.
 */

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_PART_BYTES = 20 * 1024 * 1024;

export interface ParsedQuestion {
  row: number;
  text: string;
  explanation: string | null;
  difficulty: number;
  /** Non-empty options in their original a-d order. */
  options: Array<{ text: string; isCorrect: boolean }>;
}

export interface RowError {
  row: number;
  message: string;
}

export interface ValidationResult {
  valid: ParsedQuestion[];
  errors: RowError[];
  /** Data rows seen, blank rows excluded. */
  total: number;
}

/* ------------------------------------------------------------------ CSV */

/** Picks the delimiter from the header line: comma, semicolon or tab. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ----------------------------------------------------------------- XLSX */

function unescapeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Reads only the zip parts that matter, each capped in size. Null if not a valid zip. */
function readZipParts(buf: Buffer): Map<string, Buffer> | null {
  try {
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i -= 1) {
      if (buf.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return null;

    const count = buf.readUInt16LE(eocd + 10);
    let offset = buf.readUInt32LE(eocd + 16);
    const wanted = /^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/sheet\d+\.xml)$/;
    const parts = new Map<string, Buffer>();

    for (let n = 0; n < count; n += 1) {
      if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) return null;

      const method = buf.readUInt16LE(offset + 10);
      const compressedSize = buf.readUInt32LE(offset + 20);
      const uncompressedSize = buf.readUInt32LE(offset + 24);
      const nameLength = buf.readUInt16LE(offset + 28);
      const extraLength = buf.readUInt16LE(offset + 30);
      const commentLength = buf.readUInt16LE(offset + 32);
      const localOffset = buf.readUInt32LE(offset + 42);
      const name = buf.toString("utf8", offset + 46, offset + 46 + nameLength);
      offset += 46 + nameLength + extraLength + commentLength;

      if (!wanted.test(name)) continue;
      if (uncompressedSize > MAX_ZIP_PART_BYTES) return null;
      if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) return null;

      const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
      const data = buf.subarray(start, start + compressedSize);

      if (method === 0) parts.set(name, data);
      else if (method === 8) parts.set(name, inflateRawSync(data, { maxOutputLength: MAX_ZIP_PART_BYTES }));
      else return null;
    }
    return parts;
  } catch {
    return null;
  }
}

function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * First worksheet of an .xlsx as rows of text. A formula cell comes back as
 * "=<formula>" so the normal formula check rejects it.
 */
export function readXlsx(buf: Buffer): string[][] | null {
  const parts = readZipParts(buf);
  if (!parts) return null;

  const shared: string[] = [];
  const sharedXml = parts.get("xl/sharedStrings.xml")?.toString("utf8");
  if (sharedXml) {
    for (const si of sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      const withoutPhonetic = si[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
      let text = "";
      for (const t of withoutPhonetic.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += t[1];
      shared.push(unescapeXml(text));
    }
  }

  /* The first sheet in workbook order, falling back to the lowest sheetN.xml. */
  let sheetName: string | null = null;
  const workbook = parts.get("xl/workbook.xml")?.toString("utf8");
  const rels = parts.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  const firstRid = workbook ? /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1] : undefined;
  if (firstRid && rels) {
    for (const rel of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /\bId="([^"]+)"/.exec(rel[0])?.[1];
      const target = /\bTarget="([^"]+)"/.exec(rel[0])?.[1];
      if (id === firstRid && target) {
        sheetName = `xl/${target.replace(/^\/?(xl\/)?/, "")}`;
        break;
      }
    }
  }
  if (!sheetName || !parts.has(sheetName)) {
    sheetName = [...parts.keys()].filter((k) => k.startsWith("xl/worksheets/")).sort()[0] ?? null;
  }
  const sheetXml = sheetName ? parts.get(sheetName)?.toString("utf8") : undefined;
  if (!sheetXml) return null;

  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const inner = c[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      if (!ref) continue;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];

      let value = "";
      const formula = /<f\b[^>]*>([\s\S]*?)<\/f>|<f\b[^>]*\/>/.exec(inner);
      if (formula) {
        value = `=${unescapeXml(formula[1] ?? "")}`;
      } else if (type === "s") {
        const idx = Number.parseInt(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "", 10);
        value = Number.isFinite(idx) ? (shared[idx] ?? "") : "";
      } else if (type === "inlineStr") {
        let text = "";
        for (const t of inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += t[1];
        value = unescapeXml(text);
      } else {
        value = unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
      }
      cells[columnIndex(ref)] = value;
    }
    rows.push(Array.from(cells, (v) => v ?? ""));
    if (rows.length > MAX_IMPORT_ROWS + 5) break;
  }
  return rows;
}

/* ----------------------------------------------------------- Validation */

const FORMULA_START = /^[=+\-@]/;
const LETTERS = ["a", "b", "c", "d"] as const;

export function validateRows(rows: string[][]): ValidationResult | { fatal: string } {
  if (rows.length === 0) return { fatal: "The file is empty." };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const missing = ["question", "option_a", "option_b", "correct"].filter((c) => col(c) === -1);
  if (missing.length > 0) {
    return { fatal: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` };
  }

  const dataRows = rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return { fatal: `Too many rows (${dataRows.length}). The limit is ${MAX_IMPORT_ROWS} per import.` };
  }

  const valid: ParsedQuestion[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();

  rows.slice(1).forEach((r, i) => {
    if (!r.some((cell) => cell.trim() !== "")) return;
    const rowNumber = i + 2;
    const get = (name: string) => (col(name) === -1 ? "" : (r[col(name)] ?? "").trim());
    const fail = (message: string) => errors.push({ row: rowNumber, message });

    const text = get("question");
    const optionTexts = LETTERS.map((l) => get(`option_${l}`));
    const explanation = get("explanation");

    /* Spreadsheet formula injection: anything that would run when opened. */
    for (const [label, value] of [
      ["question", text],
      ...LETTERS.map((l, k) => [`option_${l}`, optionTexts[k]] as const),
      ["explanation", explanation],
    ] as const) {
      if (value && FORMULA_START.test(value)) {
        return fail(`${label} starts with "${value[0]}", which is not allowed (it could be read as a formula).`);
      }
    }

    if (!text) return fail("The question is empty.");
    if (text.length > 500) return fail(`The question is ${text.length} characters; the limit is 500.`);
    if (optionTexts.some((o) => o.length > 300)) return fail("An option is longer than 300 characters.");
    if (explanation.length > 1000) return fail("The explanation is longer than 1000 characters.");

    if (optionTexts.filter((o) => o !== "").length < 2) return fail("At least two options are needed.");

    const correctRaw = get("correct").toLowerCase();
    const correctIndex = /^[a-d]$/.test(correctRaw)
      ? correctRaw.charCodeAt(0) - 97
      : /^[1-4]$/.test(correctRaw)
        ? Number.parseInt(correctRaw, 10) - 1
        : -1;
    if (correctIndex === -1) return fail('"correct" must be a, b, c, d (or 1 to 4).');
    if (optionTexts[correctIndex] === "") return fail(`"correct" points to option ${LETTERS[correctIndex]}, which is empty.`);

    const difficultyRaw = get("difficulty");
    let difficulty = 2;
    if (difficultyRaw !== "") {
      const d = Number(difficultyRaw);
      if (!Number.isInteger(d) || d < 1 || d > 3) return fail('"difficulty" must be 1, 2 or 3.');
      difficulty = d;
    }

    const key = text.toLowerCase().replace(/\s+/g, " ");
    const earlier = seen.get(key);
    if (earlier !== undefined) return fail(`Duplicate of row ${earlier}.`);
    seen.set(key, rowNumber);

    valid.push({
      row: rowNumber,
      text,
      explanation: explanation || null,
      difficulty,
      options: optionTexts
        .map((o, k) => ({ text: o, isCorrect: k === correctIndex }))
        .filter((o) => o.text !== ""),
    });
  });

  return { valid, errors, total: dataRows.length };
}
