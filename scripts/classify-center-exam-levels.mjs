// scripts/classify-center-exam-levels.mjs
// 2026-06-17 JST
// PART: classify center exam candidates by junior/high school word lists

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const CENTER_INPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_priority_50plus_candidates.csv",
);

const JUNIOR_WORDS_PATH = path.join(ROOT_DIR, "data", "中学英単語.csv");
const HIGH_WORDS_PATH = path.join(ROOT_DIR, "data", "高校英単語.csv");

const OUT_ALL_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_50plus_level_classified_all.csv",
);

const OUT_JUNIOR_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_50plus_level_junior_high.csv",
);

const OUT_HIGH_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_50plus_level_high_school.csv",
);

const OUT_REVIEW_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_50plus_level_review.csv",
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

function detectDelimiter(line) {
  const tabCount = (line.match(/\t/g) ?? []).length;
  const commaCount = (line.match(/,/g) ?? []).length;

  return tabCount > commaCount ? "\t" : ",";
}

function readTable(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter).map((header) =>
    header.trim(),
  );

  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
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

function normalizeWord(value) {
  return String(value ?? "")
    .trim()
    .replace(/[’‘`]/g, "'")
    .toLowerCase();
}

function buildReferenceMap(rows, wordColumn, meaningColumn) {
  const map = new Map();

  for (const row of rows) {
    const word = normalizeWord(row[wordColumn]);
    const meaning = String(row[meaningColumn] ?? "").trim();

    if (!word) continue;

    if (!map.has(word)) {
      map.set(word, {
        word,
        meaning,
      });
    }
  }

  return map;
}

function appendNote2(oldNote2, extra) {
  const base = String(oldNote2 ?? "").trim();

  if (!base) return extra;
  return `${base}; ${extra}`;
}

const centerRows = readTable(CENTER_INPUT_PATH);
const juniorRows = readTable(JUNIOR_WORDS_PATH);
const highRows = readTable(HIGH_WORDS_PATH);

const juniorMap = buildReferenceMap(juniorRows, "英単語", "日本語訳");
const highMap = buildReferenceMap(highRows, "英語", "日本語");

const allRows = [];
const juniorOut = [];
const highOut = [];
const reviewOut = [];

for (const row of centerRows) {
  const word = normalizeWord(row.word);
  const lemma = normalizeWord(row.lemma);

  const juniorMatch = juniorMap.get(word) || juniorMap.get(lemma);
  const highMatch = highMap.get(word) || highMap.get(lemma);

  let suggestedLevel = "";
  let levelReason = "";
  let referenceMeaning = "";

  if (juniorMatch) {
    suggestedLevel = "junior_high";
    levelReason = "matched_junior_word_list";
    referenceMeaning = juniorMatch.meaning;
  } else if (highMatch) {
    suggestedLevel = "high_school";
    levelReason = "matched_high_word_list";
    referenceMeaning = highMatch.meaning;
  } else {
    suggestedLevel = "review";
    levelReason = "not_found_in_junior_or_high_word_lists";
    referenceMeaning = "";
  }

  const nextRow = {
    ...row,
    suggested_level: suggestedLevel,
    level_reason: levelReason,
    reference_meaning_ja: referenceMeaning,
    level: suggestedLevel === "review" ? row.level : suggestedLevel,
    meaning_ja: row.meaning_ja || referenceMeaning,
    note2: appendNote2(row.note2, levelReason),
  };

  allRows.push(nextRow);

  if (suggestedLevel === "junior_high") {
    juniorOut.push(nextRow);
  } else if (suggestedLevel === "high_school") {
    highOut.push(nextRow);
  } else {
    reviewOut.push(nextRow);
  }
}

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
  "suggested_level",
  "level_reason",
  "reference_meaning_ja",
];

writeCsv(OUT_ALL_PATH, allRows, headers);
writeCsv(OUT_JUNIOR_PATH, juniorOut, headers);
writeCsv(OUT_HIGH_PATH, highOut, headers);
writeCsv(OUT_REVIEW_PATH, reviewOut, headers);

console.log("PARARI center exam level classification finished.");
console.log(`center rows: ${centerRows.length}`);
console.log(`junior reference rows: ${juniorRows.length}`);
console.log(`high reference rows: ${highRows.length}`);
console.log(`matched junior_high: ${juniorOut.length}`);
console.log(`matched high_school: ${highOut.length}`);
console.log(`review: ${reviewOut.length}`);
console.log(`wrote: ${OUT_ALL_PATH}`);
console.log(`wrote: ${OUT_JUNIOR_PATH}`);
console.log(`wrote: ${OUT_HIGH_PATH}`);
console.log(`wrote: ${OUT_REVIEW_PATH}`);
