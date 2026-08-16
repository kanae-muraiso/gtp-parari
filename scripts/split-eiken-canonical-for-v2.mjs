// scripts/split-eiken-canonical-for-v2.mjs
// 2026-06-17 JST
// PART: split EIKEN canonical expressions into word / phrase / conversation candidates for PARARI dictionary v2

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const INPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "eiken_canonical_expressions_all_levels.csv",
);

const OUT_WORD_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_word_candidates.csv",
);

const OUT_PHRASE_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_phrase_candidates.csv",
);

const OUT_CONVERSATION_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_conversation_candidates.csv",
);

const OUT_REVIEW_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_review_candidates.csv",
);

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

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
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

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toParariLevel(minEikenLevel) {
  const level = String(minEikenLevel ?? "").trim();

  if (level === "5" || level === "4" || level === "3") {
    return "junior_high";
  }

  if (level === "pre2" || level === "2") {
    return "high_school";
  }

  if (level === "pre1" || level === "1") {
    return "exam";
  }

  return "review";
}

function toImportance(row) {
  const minLevel = String(row.min_eiken_level ?? "").trim();
  const rowCount = Number(row.row_count ?? 1);

  // 複数級にまたがる基本語は重要度を上げる
  if (rowCount >= 3) return "1";
  if (minLevel === "5" || minLevel === "4") return "1";
  if (minLevel === "3" || minLevel === "pre2") return "2";
  return "3";
}

function isSuspiciousWord(expression) {
  const text = String(expression ?? "").trim();

  if (!text) return true;

  // 単語候補なのに空白がある場合
  if (/\s/.test(text)) return true;

  // 文記号がある場合
  if (/[.!?]/.test(text)) return true;

  // A/B型やAなどを含むものは後で確認
  if (/[\/]/.test(text)) return true;

  return false;
}

const rows = readCsv(INPUT_PATH);

const wordRows = [];
const phraseRows = [];
const conversationRows = [];
const reviewRows = [];

for (const row of rows) {
  const expression = normalizeText(row.expression);
  const entryKind = normalizeText(row.entry_kind);
  const parariLevel = toParariLevel(row.min_eiken_level);

  const baseRow = {
    expression,
    normalized_expression: normalizeText(row.normalized_expression),
    entry_kind: entryKind,
    meaning_ja_primary: normalizeText(row.meaning_ja_primary),
    meaning_ja_all: normalizeText(row.meaning_ja_all),
    parari_level: parariLevel,
    importance: toImportance(row),
    min_eiken_level: normalizeText(row.min_eiken_level),
    eiken_levels: normalizeText(row.eiken_levels),
    label_raw_all: normalizeText(row.label_raw_all),
    source_refs: normalizeText(row.source_refs),
    row_count: normalizeText(row.row_count),
  };

  if (entryKind === "word") {
    if (isSuspiciousWord(expression)) {
      reviewRows.push({
        ...baseRow,
        review_reason: "word entry has suspicious shape",
      });
    } else {
      wordRows.push(baseRow);
    }
    continue;
  }

  if (entryKind === "phrase") {
    phraseRows.push(baseRow);
    continue;
  }

  if (entryKind === "conversation") {
    conversationRows.push(baseRow);
    continue;
  }

  reviewRows.push({
    ...baseRow,
    review_reason: "unknown entry_kind",
  });
}

const headers = [
  "expression",
  "normalized_expression",
  "entry_kind",
  "meaning_ja_primary",
  "meaning_ja_all",
  "parari_level",
  "importance",
  "min_eiken_level",
  "eiken_levels",
  "label_raw_all",
  "source_refs",
  "row_count",
];

writeCsv(OUT_WORD_PATH, wordRows, headers);
writeCsv(OUT_PHRASE_PATH, phraseRows, headers);
writeCsv(OUT_CONVERSATION_PATH, conversationRows, headers);
writeCsv(OUT_REVIEW_PATH, reviewRows, [...headers, "review_reason"]);

console.log("PARARI EIKEN v2 split finished.");
console.log(`input rows: ${rows.length}`);
console.log(`word candidates: ${wordRows.length}`);
console.log(`phrase candidates: ${phraseRows.length}`);
console.log(`conversation candidates: ${conversationRows.length}`);
console.log(`review candidates: ${reviewRows.length}`);
console.log(`wrote: ${OUT_WORD_PATH}`);
console.log(`wrote: ${OUT_PHRASE_PATH}`);
console.log(`wrote: ${OUT_CONVERSATION_PATH}`);
console.log(`wrote: ${OUT_REVIEW_PATH}`);
