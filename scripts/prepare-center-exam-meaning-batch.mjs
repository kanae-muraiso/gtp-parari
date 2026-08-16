// scripts/prepare-center-exam-meaning-batch.mjs
// 2026-06-17 JST
// PART: prepare first meaning-fill batch from center exam candidates

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const INPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_priority_100plus_candidates.csv",
);

const OUT_TODO_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_batch4_meaning_todo.csv",
);

const OUT_EXCLUDED_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_batch4_excluded.csv",
);

const BATCH_SIZE = 100;

const ALLOWED_POS = new Set(["noun", "verb", "adjective", "adverb"]);

const EXCLUDE_WORDS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "john",
  "tom",
  "ken",
  "sally",
  "bob",
  "ok",
  "okay",
  "accord",
  "clothe",
]);

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

function getExcludeReason(row) {
  if (row.source_file === "review") {
    return "source_file_review";
  }

  if (row.review_reason) {
    return `review_reason:${row.review_reason}`;
  }

  if (!ALLOWED_POS.has(row.pos)) {
    return `pos_not_allowed:${row.pos}`;
  }

  if (EXCLUDE_WORDS.has(row.word)) {
    return "manual_exclude_word";
  }

  if (!row.word || !row.lemma) {
    return "missing_word_or_lemma";
  }

  return "";
}

const rows = readCsv(INPUT_PATH);

const todoRows = [];
const excludedRows = [];

for (const row of rows) {
  const excludeReason = getExcludeReason(row);

  if (excludeReason) {
    excludedRows.push({
      ...row,
      exclude_reason: excludeReason,
    });
    continue;
  }

  todoRows.push({
    ...row,
    decision: "add",
  });
}

const pickedRows = todoRows.slice(300, 400);

const candidateHeaders = [
  "decision",
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
];

const excludedHeaders = [
  "exclude_reason",
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

writeCsv(OUT_TODO_PATH, pickedRows, candidateHeaders);
writeCsv(OUT_EXCLUDED_PATH, excludedRows, excludedHeaders);

console.log("PARARI center exam meaning batch prepared.");
console.log(`input rows: ${rows.length}`);
console.log(`safe todo rows total: ${todoRows.length}`);
console.log(`picked batch rows: ${pickedRows.length}`);
console.log(`excluded rows: ${excludedRows.length}`);
console.log(`wrote: ${OUT_TODO_PATH}`);
console.log(`wrote: ${OUT_EXCLUDED_PATH}`);
