// scripts/pick-center-exam-priority-batch.mjs
// 2026-06-17 JST
// PART: pick priority batch from center exam diff candidates

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const AUTO_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_diff_auto_candidates.csv",
);

const REVIEW_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_diff_review.csv",
);

const OUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_priority_50plus_candidates.csv",
);

function parseDelimitedLine(line, delimiter) {
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

    if (char === delimiter && !inQuotes) {
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

  if (lines.length === 0) return [];

  const headers = parseDelimitedLine(lines[0], ",").map((header) =>
    header.trim(),
  );

  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, ",");
    const row = {};

    headers.forEach((header, index) => {
      row[header] = String(values[index] ?? "").trim();
    });

    return row;
  });
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

function parsePmw(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/\d+/);

  return match ? Number(match[0]) : 0;
}

function shouldPick(row) {
  const pmwNumber = parsePmw(row.center_pmw);

  return pmwNumber >= 50＋の単語;
}

const autoRows = readCsv(AUTO_PATH).map((row) => ({
  ...row,
  source_file: "auto",
}));

const reviewRows = readCsv(REVIEW_PATH).map((row) => ({
  ...row,
  source_file: "review",
}));

const pickedRows = [...autoRows, ...reviewRows]
  .filter(shouldPick)
  .sort((a, b) => {
    const rankA = Number(a.source_rank || 999999);
    const rankB = Number(b.source_rank || 999999);
    return rankA - rankB;
  });

const headers = [
  "source_file",
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
  "center_word_original",
  "center_pos",
  "center_pmw",
  "review_reason",
];

writeCsv(OUT_PATH, pickedRows, headers);

console.log("PARARI center exam priority batch finished.");
console.log(`picked rows: ${pickedRows.length}`);
console.log(`wrote: ${OUT_PATH}`);
