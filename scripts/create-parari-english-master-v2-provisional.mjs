// scripts/create-parari-english-master-v2-provisional.mjs
// 2026-06-17 JST
// PART: create provisional PARARI English dictionary master v2 from clean candidates

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const INPUT_CLEAN_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_clean_candidates.csv",
);

const OUT_PROVISIONAL_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_provisional.csv",
);

const OUT_SUMMARY_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_provisional_summary.csv",
);

const REQUIRED_HEADERS = [
  "action",
  "source_rank",
  "word",
  "lemma",
  "pos",
  "form_type",
  "sense_id",
  "meaning_ja",
  "level",
  "importance",
  "category",
  "note",
  "note2",
];

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = String(values[index] ?? "").trim();
    });

    return row;
  });

  return { headers, rows };
}

function csvEscape(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function writeCsv(filePath, rows, headers) {
  const body = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");

  fs.writeFileSync(filePath, `${body}\n`, "utf8");
}

function validateHeaders(headers) {
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));

  if (missing.length > 0) {
    throw new Error(`Missing required headers: ${missing.join(", ")}`);
  }
}

function countBy(rows, key) {
  const counts = new Map();

  for (const row of rows) {
    const value = row[key] || "(blank)";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function duplicateKey(row) {
  return [
    row.word,
    row.lemma,
    row.pos,
    row.form_type,
    row.sense_id,
  ].join("|");
}

const { headers, rows } = readCsv(INPUT_CLEAN_PATH);

validateHeaders(headers);

const outputRows = [];
const seen = new Set();
const duplicates = [];

for (const row of rows) {
  if (row.action !== "add") {
    continue;
  }

  const normalizedRow = {};

  for (const header of REQUIRED_HEADERS) {
    normalizedRow[header] = row[header] ?? "";
  }

  const key = duplicateKey(normalizedRow);

  if (seen.has(key)) {
    duplicates.push(normalizedRow);
    continue;
  }

  seen.add(key);
  outputRows.push(normalizedRow);
}

writeCsv(OUT_PROVISIONAL_PATH, outputRows, REQUIRED_HEADERS);

const summaryRows = [
  { item: "input_clean_rows", count: rows.length },
  { item: "output_provisional_rows", count: outputRows.length },
  { item: "duplicate_rows_skipped", count: duplicates.length },
];

for (const [pos, count] of countBy(outputRows, "pos")) {
  summaryRows.push({
    item: `pos:${pos}`,
    count,
  });
}

for (const [level, count] of countBy(outputRows, "level")) {
  summaryRows.push({
    item: `level:${level}`,
    count,
  });
}

for (const [importance, count] of countBy(outputRows, "importance")) {
  summaryRows.push({
    item: `importance:${importance}`,
    count,
  });
}

writeCsv(OUT_SUMMARY_PATH, summaryRows, ["item", "count"]);

console.log("PARARI English dictionary master v2 provisional created.");
console.log(`input clean rows: ${rows.length}`);
console.log(`output provisional rows: ${outputRows.length}`);
console.log(`duplicate rows skipped: ${duplicates.length}`);

console.log("\npos counts:");
for (const [pos, count] of countBy(outputRows, "pos")) {
  console.log(`  ${pos}: ${count}`);
}

console.log("\nlevel counts:");
for (const [level, count] of countBy(outputRows, "level")) {
  console.log(`  ${level}: ${count}`);
}

console.log(`\nwrote: ${OUT_PROVISIONAL_PATH}`);
console.log(`wrote: ${OUT_SUMMARY_PATH}`);
