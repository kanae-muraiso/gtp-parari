// scripts/compare-school-words-with-master.mjs
// 2026-06-17 JST
// PART: merge junior/high school word lists and compare with PARARI dictionary master

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const JUNIOR_PATH = path.join(ROOT_DIR, "data", "中学英単語.csv");
const HIGH_PATH = path.join(ROOT_DIR, "data", "高校英単語.csv");
const MASTER_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v0.csv",
);

const OUT_MERGED_PATH = path.join(ROOT_DIR, "data", "school_words_merged.csv");
const OUT_EXISTING_PATH = path.join(
  ROOT_DIR,
  "data",
  "school_words_existing_in_master.csv",
);
const OUT_MISSING_PATH = path.join(
  ROOT_DIR,
  "data",
  "school_words_missing_from_master.csv",
);
const OUT_LEVEL_MISMATCH_PATH = path.join(
  ROOT_DIR,
  "data",
  "school_words_level_mismatch.csv",
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

function mergeSourceRows() {
  const juniorRows = readTable(JUNIOR_PATH);
  const highRows = readTable(HIGH_PATH);

  const mergedMap = new Map();

  function addWord({ word, meaning, sourceLevel, sourceName, sourceRank }) {
    const normalized = normalizeWord(word);
    if (!normalized) return;

    const existing = mergedMap.get(normalized);

    if (!existing) {
      mergedMap.set(normalized, {
        word: normalized,
        suggested_level: sourceLevel,
        junior_meaning_ja: sourceLevel === "junior_high" ? meaning : "",
        high_meaning_ja: sourceLevel === "high_school" ? meaning : "",
        source_names: sourceName,
        source_ranks: String(sourceRank ?? ""),
      });
      return;
    }

    if (sourceLevel === "junior_high") {
      existing.suggested_level = "junior_high";
      existing.junior_meaning_ja ||= meaning;
    }

    if (sourceLevel === "high_school") {
      existing.high_meaning_ja ||= meaning;
    }

    if (!existing.source_names.split(";").includes(sourceName)) {
      existing.source_names = `${existing.source_names};${sourceName}`;
    }

    existing.source_ranks = [existing.source_ranks, sourceRank]
      .filter(Boolean)
      .join(";");
  }

  for (const row of juniorRows) {
    addWord({
      word: row["英単語"],
      meaning: row["日本語訳"],
      sourceLevel: "junior_high",
      sourceName: "junior_word_list",
      sourceRank: row["No"] || row["no"] || "",
    });
  }

  for (const row of highRows) {
    addWord({
      word: row["英語"],
      meaning: row["日本語"],
      sourceLevel: "high_school",
      sourceName: "high_word_list",
      sourceRank: row["No"] || row["no"] || "",
    });
  }

  return [...mergedMap.values()].sort((a, b) => {
    if (a.suggested_level !== b.suggested_level) {
      return a.suggested_level === "junior_high" ? -1 : 1;
    }
    return a.word.localeCompare(b.word);
  });
}

function buildMasterIndex(masterRows) {
  const index = new Map();

  for (const row of masterRows) {
    const action = String(row.action ?? "").trim();

    if (action !== "add" && action !== "add_pos_variant") {
      continue;
    }

    const word = normalizeWord(row.word);
    const lemma = normalizeWord(row.lemma);

    for (const key of [word, lemma]) {
      if (!key) continue;

      if (!index.has(key)) {
        index.set(key, []);
      }

      index.get(key).push(row);
    }
  }

  return index;
}

const schoolRows = mergeSourceRows();
const masterRows = readTable(MASTER_PATH);
const masterIndex = buildMasterIndex(masterRows);

const existingRows = [];
const missingRows = [];
const levelMismatchRows = [];

for (const schoolRow of schoolRows) {
  const matches = masterIndex.get(schoolRow.word) ?? [];

  if (matches.length === 0) {
    missingRows.push({
      ...schoolRow,
      master_status: "missing",
    });
    continue;
  }

  const masterLevels = [...new Set(matches.map((row) => row.level).filter(Boolean))];
  const masterPos = [...new Set(matches.map((row) => row.pos).filter(Boolean))];
  const masterMeanings = [
    ...new Set(matches.map((row) => row.meaning_ja).filter(Boolean)),
  ];

  const existingRow = {
    ...schoolRow,
    master_status: "existing",
    master_levels: masterLevels.join(";"),
    master_pos: masterPos.join(";"),
    master_meaning_ja: masterMeanings.join(" / "),
    match_count: String(matches.length),
  };

  existingRows.push(existingRow);

  if (!masterLevels.includes(schoolRow.suggested_level)) {
    levelMismatchRows.push({
      ...existingRow,
      mismatch_reason: `school=${schoolRow.suggested_level}; master=${masterLevels.join(";")}`,
    });
  }
}

const mergedHeaders = [
  "word",
  "suggested_level",
  "junior_meaning_ja",
  "high_meaning_ja",
  "source_names",
  "source_ranks",
];

const existingHeaders = [
  ...mergedHeaders,
  "master_status",
  "master_levels",
  "master_pos",
  "master_meaning_ja",
  "match_count",
];

const missingHeaders = [...mergedHeaders, "master_status"];

const mismatchHeaders = [...existingHeaders, "mismatch_reason"];

writeCsv(OUT_MERGED_PATH, schoolRows, mergedHeaders);
writeCsv(OUT_EXISTING_PATH, existingRows, existingHeaders);
writeCsv(OUT_MISSING_PATH, missingRows, missingHeaders);
writeCsv(OUT_LEVEL_MISMATCH_PATH, levelMismatchRows, mismatchHeaders);

console.log("PARARI school word comparison finished.");
console.log(`school merged words: ${schoolRows.length}`);
console.log(`master rows: ${masterRows.length}`);
console.log(`existing in master: ${existingRows.length}`);
console.log(`missing from master: ${missingRows.length}`);
console.log(`level mismatch: ${levelMismatchRows.length}`);
console.log(`wrote: ${OUT_MERGED_PATH}`);
console.log(`wrote: ${OUT_EXISTING_PATH}`);
console.log(`wrote: ${OUT_MISSING_PATH}`);
console.log(`wrote: ${OUT_LEVEL_MISMATCH_PATH}`);
