// scripts/finalize-parari-english-master-v2.mjs
// 2026-10-07 JST
// PART: Promote provisional PARARI English dictionary v2 into the formal schema.
// NOTE: This does not switch the runtime dictionary. It produces a reviewable formal master CSV.

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const PROVISIONAL_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_provisional.csv",
);

const EIKEN_PATH = path.join(
  ROOT_DIR,
  "data",
  "eiken_canonical_expressions_all_levels.csv",
);

const OUTPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2.csv",
);

const REVIEW_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_level_review.csv",
);

const FORMAL_HEADERS = [
  "action",
  "source_rank",
  "word",
  "lemma",
  "pos",
  "form_type",
  "sense_id",
  "meaning_ja",
  "eiken_level",
  "eiken_levels",
  "level",
  "importance",
  "entry_kind",
  "source",
  "category",
  "note",
  "note2",
];

const VALID_EIKEN_LEVELS = new Set(["5", "4", "3", "pre2", "2", "pre1", "1"]);

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
    return [];
  }

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

function normalizeLookup(value) {
  return String(value ?? "")
    .trim()
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeEikenLevel(value) {
  const level = String(value ?? "").trim();
  return VALID_EIKEN_LEVELS.has(level) ? level : "";
}

function normalizeEikenLevels(value) {
  const seen = new Set();
  const values = String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => VALID_EIKEN_LEVELS.has(item));

  return values.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  }).join(";");
}

function main() {
  if (!fs.existsSync(PROVISIONAL_PATH)) {
    throw new Error(`Missing provisional dictionary: ${PROVISIONAL_PATH}`);
  }

  if (!fs.existsSync(EIKEN_PATH)) {
    throw new Error(`Missing EIKEN source: ${EIKEN_PATH}`);
  }

  const provisionalRows = readCsv(PROVISIONAL_PATH);
  const eikenRows = readCsv(EIKEN_PATH);

  const eikenIndex = new Map();

  for (const row of eikenRows) {
    const key = normalizeLookup(row.normalized_expression || row.expression);
    if (!key) continue;

    eikenIndex.set(key, {
      eikenLevel: normalizeEikenLevel(row.min_eiken_level),
      eikenLevels: normalizeEikenLevels(row.eiken_levels),
      entryKind: String(row.entry_kind ?? "").trim() || "word",
    });
  }

  const reviewRows = [];
  const outputRows = provisionalRows.map((row) => {
    const key = normalizeLookup(row.word);
    const eiken = eikenIndex.get(key);

    if (!eiken) {
      reviewRows.push({
        word: row.word,
        lemma: row.lemma,
        reason: "no_eiken_match",
      });
    }

    return {
      action: row.action || "add",
      source_rank: row.source_rank,
      word: row.word,
      lemma: row.lemma || row.word,
      pos: row.pos,
      form_type: row.form_type || "base",
      sense_id: row.sense_id || "1",
      meaning_ja: row.meaning_ja,
      eiken_level: eiken?.eikenLevel ?? "",
      eiken_levels: eiken?.eikenLevels ?? "",
      level: row.level,
      importance: row.importance,
      entry_kind: eiken?.entryKind ?? "word",
      source: row.category === "eiken" ? "eiken" : "legacy",
      category: row.category,
      note: row.note,
      note2: row.note2,
    };
  });

  writeCsv(OUTPUT_PATH, outputRows, FORMAL_HEADERS);
  writeCsv(REVIEW_PATH, reviewRows, ["word", "lemma", "reason"]);

  const withEiken = outputRows.filter((row) => row.eiken_level).length;
  const byLevel = new Map();

  for (const row of outputRows) {
    if (!row.eiken_level) continue;
    byLevel.set(row.eiken_level, (byLevel.get(row.eiken_level) ?? 0) + 1);
  }

  console.log("PARARI English dictionary v2 formalization finished.");
  console.log(`rows: ${outputRows.length}`);
  console.log(`rows with EIKEN level: ${withEiken}`);
  console.log(`review rows: ${reviewRows.length}`);

  for (const level of ["5", "4", "3", "pre2", "2", "pre1", "1"]) {
    console.log(`eiken ${level}: ${byLevel.get(level) ?? 0}`);
  }

  console.log(`wrote: ${OUTPUT_PATH}`);
  console.log(`wrote: ${REVIEW_PATH}`);
}

main();
