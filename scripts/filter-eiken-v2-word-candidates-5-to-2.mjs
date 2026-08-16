// scripts/filter-eiken-v2-word-candidates-5-to-2.mjs
// 2026-06-17 JST
// PART: filter PARARI English v2 word candidates into 5-to-2 active set and pre1/1 hold set

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const INPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_word_candidates.csv",
);

const OUT_ACTIVE_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_word_candidates_5_to_2.csv",
);

const OUT_HOLD_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_word_candidates_pre1_1_hold.csv",
);

const OUT_REVIEW_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_word_candidates_level_review.csv",
);

const ACTIVE_LEVELS = new Set(["5", "4", "3", "pre2", "2"]);
const HOLD_LEVELS = new Set(["pre1", "1"]);

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

function countBy(rows, key) {
  const counts = new Map();

  for (const row of rows) {
    const value = row[key] || "(blank)";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => {
    const order = ["5", "4", "3", "pre2", "2", "pre1", "1"];
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);

    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

const { headers, rows } = readCsv(INPUT_PATH);

const activeRows = [];
const holdRows = [];
const reviewRows = [];

for (const row of rows) {
  const minLevel = String(row.min_eiken_level ?? "").trim();

  if (ACTIVE_LEVELS.has(minLevel)) {
    activeRows.push(row);
    continue;
  }

  if (HOLD_LEVELS.has(minLevel)) {
    holdRows.push({
      ...row,
      hold_reason: "pre1_or_1_deferred",
    });
    continue;
  }

  reviewRows.push({
    ...row,
    review_reason: `unknown_min_eiken_level:${minLevel}`,
  });
}

writeCsv(OUT_ACTIVE_PATH, activeRows, headers);
writeCsv(OUT_HOLD_PATH, holdRows, [...headers, "hold_reason"]);
writeCsv(OUT_REVIEW_PATH, reviewRows, [...headers, "review_reason"]);

console.log("PARARI EIKEN v2 word candidate filter finished.");
console.log(`input rows: ${rows.length}`);
console.log(`active 5-to-2 rows: ${activeRows.length}`);
console.log(`hold pre1/1 rows: ${holdRows.length}`);
console.log(`review rows: ${reviewRows.length}`);

console.log("\nactive min_eiken_level counts:");
for (const [level, count] of countBy(activeRows, "min_eiken_level")) {
  console.log(`  ${level}: ${count}`);
}

console.log("\nhold min_eiken_level counts:");
for (const [level, count] of countBy(holdRows, "min_eiken_level")) {
  console.log(`  ${level}: ${count}`);
}

console.log(`\nwrote: ${OUT_ACTIVE_PATH}`);
console.log(`wrote: ${OUT_HOLD_PATH}`);
console.log(`wrote: ${OUT_REVIEW_PATH}`);
