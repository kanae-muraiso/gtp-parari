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

const PRE1_1_HOLD_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_word_candidates_pre1_1_hold.csv",
);

const MANUAL_SEED_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_manual_seed.csv",
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

function posFromLabel(label) {
  const value = String(label ?? "").trim();

  const mapping = new Map([
    ["名詞", "noun"],
    ["動詞", "verb"],
    ["形容詞", "adjective"],
    ["副詞", "adverb"],
    ["前置詞", "preposition"],
    ["接続詞", "conjunction"],
    ["代名詞", "pronoun"],
    ["助動詞", "auxiliary"],
    ["間投詞", "interjection"],
    ["冠詞", "article"],
    ["数詞", "numeral"],
  ]);

  if (mapping.has(value)) return mapping.get(value);

  for (const part of value.split(/[\/;]/).map((item) => item.trim())) {
    if (mapping.has(part)) return mapping.get(part);
  }

  return "unknown";
}

function main() {
  if (!fs.existsSync(PROVISIONAL_PATH)) {
    throw new Error(`Missing provisional dictionary: ${PROVISIONAL_PATH}`);
  }

  if (!fs.existsSync(EIKEN_PATH)) {
    throw new Error(`Missing EIKEN source: ${EIKEN_PATH}`);
  }

  if (!fs.existsSync(PRE1_1_HOLD_PATH)) {
    throw new Error(`Missing pre1/1 hold source: ${PRE1_1_HOLD_PATH}`);
  }

  if (!fs.existsSync(MANUAL_SEED_PATH)) {
    throw new Error(`Missing manual seed source: ${MANUAL_SEED_PATH}`);
  }

  const provisionalRows = readCsv(PROVISIONAL_PATH);
  const eikenRows = readCsv(EIKEN_PATH);
  const holdRows = readCsv(PRE1_1_HOLD_PATH);
  const manualRows = readCsv(MANUAL_SEED_PATH);

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

  let nextRank = outputRows.reduce(
    (max, row) => Math.max(max, Number.parseInt(row.source_rank || "0", 10) || 0),
    0,
  ) + 1;

  const existingKeys = new Set(
    outputRows.map((row) => normalizeLookup(row.word)),
  );

  for (const row of holdRows) {
    const word = String(row.normalized_expression || row.expression || "").trim();
    const key = normalizeLookup(word);

    if (!key || existingKeys.has(key)) {
      continue;
    }

    const pos = posFromLabel(row.label_raw_all);

    outputRows.push({
      action: "add",
      source_rank: String(nextRank++),
      word,
      lemma: word,
      pos,
      form_type: "base",
      sense_id: "1",
      meaning_ja: row.meaning_ja_primary || row.meaning_ja_all || "",
      eiken_level: normalizeEikenLevel(row.min_eiken_level),
      eiken_levels: normalizeEikenLevels(row.eiken_levels),
      level: row.parari_level || "exam",
      importance: row.importance || "3",
      entry_kind: row.entry_kind || "word",
      source: "eiken",
      category: "eiken",
      note: "英検準1級・1級保留データからv2正式辞書へ統合",
      note2: pos === "unknown" ? "品詞未確定" : "",
    });

    existingKeys.add(key);

    if (pos === "unknown") {
      reviewRows.push({
        word,
        lemma: word,
        reason: "pos_unknown",
      });
    }
  }

  for (const row of manualRows) {
    const word = String(row.word ?? "").trim();
    if (!word) continue;

    const duplicate = outputRows.some((existing) =>
      normalizeLookup(existing.word) === normalizeLookup(word) &&
      String(existing.pos ?? "") === String(row.pos ?? "") &&
      String(existing.sense_id ?? "1") === String(row.sense_id ?? "1")
    );

    if (duplicate) {
      continue;
    }

    outputRows.push({
      action: row.action || "add",
      source_rank: String(nextRank++),
      word,
      lemma: row.lemma || word,
      pos: row.pos || "unknown",
      form_type: row.form_type || "base",
      sense_id: row.sense_id || "1",
      meaning_ja: row.meaning_ja || "",
      eiken_level: normalizeEikenLevel(row.eiken_level),
      eiken_levels: normalizeEikenLevels(row.eiken_levels),
      level: row.level || "junior_high",
      importance: row.importance || "1",
      entry_kind: row.entry_kind || "word",
      source: row.source || "author",
      category: row.category || "manual",
      note: row.note || "",
      note2: row.note2 || "",
    });
  }

  outputRows.sort((a, b) => normalizeLookup(a.word).localeCompare(normalizeLookup(b.word)));

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
