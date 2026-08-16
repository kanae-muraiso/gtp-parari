// scripts/prepare-eiken-v2-base-candidates-for-master.mjs
// scripts/prepare-eiken-v2-base-candidates-for-master.mjs
// 2026-06-17 JST
// PART: convert EIKEN v2 base word candidates into PARARI dictionary master v2 candidate format
// NOTE: improved version uses v0 master as POS fallback

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const INPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_base_word_candidates_5_to_2.csv",
);

const V0_MASTER_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v0.csv",
);

const OUT_MASTER_CANDIDATES_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_base_candidates.csv",
);

const OUT_POS_REVIEW_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_pos_review.csv",
);

const MASTER_HEADERS = [
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

const POS_PRIORITY = [
  "article",
  "pronoun",
  "preposition",
  "conjunction",
  "numeral",
  "ordinal",
  "auxiliary",
  "interjection",
  "noun",
  "verb",
  "adjective",
  "adverb",
];

const BASIC_POS_MAP = new Map([
  // articles
  ["a", "article"],
  ["an", "article"],
  ["the", "article"],

  // pronouns
  ["i", "pronoun"],
  ["me", "pronoun"],
  ["my", "pronoun"],
  ["mine", "pronoun"],
  ["you", "pronoun"],
  ["your", "pronoun"],
  ["yours", "pronoun"],
  ["he", "pronoun"],
  ["him", "pronoun"],
  ["his", "pronoun"],
  ["she", "pronoun"],
  ["her", "pronoun"],
  ["hers", "pronoun"],
  ["it", "pronoun"],
  ["its", "pronoun"],
  ["we", "pronoun"],
  ["us", "pronoun"],
  ["our", "pronoun"],
  ["ours", "pronoun"],
  ["they", "pronoun"],
  ["them", "pronoun"],
  ["their", "pronoun"],
  ["theirs", "pronoun"],
  ["this", "pronoun"],
  ["that", "pronoun"],
  ["these", "pronoun"],
  ["those", "pronoun"],
  ["who", "pronoun"],
  ["what", "pronoun"],

  // auxiliaries
  ["am", "auxiliary"],
  ["is", "auxiliary"],
  ["are", "auxiliary"],
  ["be", "auxiliary"],
  ["can", "auxiliary"],
  ["could", "auxiliary"],
  ["may", "auxiliary"],
  ["might", "auxiliary"],
  ["must", "auxiliary"],
  ["shall", "auxiliary"],
  ["should", "auxiliary"],
  ["will", "auxiliary"],
  ["would", "auxiliary"],

  // conjunctions
  ["and", "conjunction"],
  ["but", "conjunction"],
  ["or", "conjunction"],
  ["because", "conjunction"],
  ["if", "conjunction"],
  ["when", "conjunction"],
  ["while", "conjunction"],
  ["although", "conjunction"],
  ["though", "conjunction"],
  ["whereas", "conjunction"],

  // prepositions
  ["about", "preposition"],
  ["above", "preposition"],
  ["across", "preposition"],
  ["after", "preposition"],
  ["against", "preposition"],
  ["along", "preposition"],
  ["around", "preposition"],
  ["at", "preposition"],
  ["before", "preposition"],
  ["behind", "preposition"],
  ["below", "preposition"],
  ["beside", "preposition"],
  ["between", "preposition"],
  ["by", "preposition"],
  ["during", "preposition"],
  ["for", "preposition"],
  ["from", "preposition"],
  ["in", "preposition"],
  ["inside", "preposition"],
  ["into", "preposition"],
  ["near", "preposition"],
  ["of", "preposition"],
  ["off", "preposition"],
  ["on", "preposition"],
  ["over", "preposition"],
  ["through", "preposition"],
  ["to", "preposition"],
  ["under", "preposition"],
  ["until", "preposition"],
  ["with", "preposition"],
  ["without", "preposition"],

  // adverbs / common function words
  ["again", "adverb"],
  ["almost", "adverb"],
  ["already", "adverb"],
  ["always", "adverb"],
  ["away", "adverb"],
  ["down", "adverb"],
  ["early", "adverb"],
  ["enough", "adverb"],
  ["even", "adverb"],
  ["ever", "adverb"],
  ["here", "adverb"],
  ["just", "adverb"],
  ["later", "adverb"],
  ["maybe", "adverb"],
  ["never", "adverb"],
  ["not", "adverb"],
  ["now", "adverb"],
  ["often", "adverb"],
  ["once", "adverb"],
  ["really", "adverb"],
  ["soon", "adverb"],
  ["sometimes", "adverb"],
  ["still", "adverb"],
  ["then", "adverb"],
  ["there", "adverb"],
  ["today", "adverb"],
  ["together", "adverb"],
  ["tomorrow", "adverb"],
  ["too", "adverb"],
  ["usually", "adverb"],
  ["very", "adverb"],
  ["well", "adverb"],
  ["where", "adverb"],
  ["why", "adverb"],
  ["yesterday", "adverb"],

  // numerals
  ["one", "numeral"],
  ["two", "numeral"],
  ["three", "numeral"],
  ["four", "numeral"],
  ["five", "numeral"],
  ["six", "numeral"],
  ["seven", "numeral"],
  ["eight", "numeral"],
  ["nine", "numeral"],
  ["ten", "numeral"],
  ["eleven", "numeral"],
  ["twelve", "numeral"],
  ["thirteen", "numeral"],
  ["fourteen", "numeral"],
  ["fifteen", "numeral"],
  ["sixteen", "numeral"],
  ["seventeen", "numeral"],
  ["eighteen", "numeral"],
  ["nineteen", "numeral"],
  ["twenty", "numeral"],
  ["thirty", "numeral"],
  ["forty", "numeral"],
  ["fifty", "numeral"],
  ["hundred", "numeral"],
  ["thousand", "numeral"],
  ["million", "numeral"],

  // ordinals
  ["first", "ordinal"],
  ["second", "ordinal"],
  ["third", "ordinal"],
  ["fourth", "ordinal"],
]);

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

function normalizeWord(value) {
  return String(value ?? "")
    .trim()
    .replace(/[’‘`]/g, "'")
    .toLowerCase();
}

function cleanMeaning(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLabel(value) {
  return String(value ?? "").trim();
}

function buildV0PosIndex(v0Rows) {
  const index = new Map();

  for (const row of v0Rows) {
    const action = String(row.action ?? "").trim();

    if (action !== "add" && action !== "add_pos_variant") {
      continue;
    }

    const pos = String(row.pos ?? "").trim();
    if (!pos || pos === "review") continue;

    const keys = [
      normalizeWord(row.word),
      normalizeWord(row.lemma),
    ].filter(Boolean);

    for (const key of keys) {
      if (!index.has(key)) {
        index.set(key, new Set());
      }
      index.get(key).add(pos);
    }
  }

  return index;
}

function chooseSinglePosFromSet(posSet) {
  const poses = [...posSet].filter(Boolean);

  if (poses.length === 0) return "";
  if (poses.length === 1) return poses[0];

  // 複数ある場合、機能語を優先し、内容語は review に逃がしすぎないため優先順位で1つ選ぶ。
  // ただし多義・多品詞情報は note2 に残す。
  for (const pos of POS_PRIORITY) {
    if (poses.includes(pos)) return pos;
  }

  return poses[0];
}

function guessPosFromLabel(labelRawAll) {
  const label = normalizeLabel(labelRawAll);

  if (!label) {
    return { pos: "", reason: "" };
  }

  // 複数品詞の場合でも、最初から review にせず、優先順位で代表posを選ぶ。
  const found = [];

  if (label.includes("冠詞")) found.push("article");
  if (label.includes("代名詞")) found.push("pronoun");
  if (label.includes("前置詞")) found.push("preposition");
  if (label.includes("接続詞")) found.push("conjunction");
  if (label.includes("数詞")) found.push("numeral");
  if (label.includes("助動詞")) found.push("auxiliary");
  if (label.includes("間投詞")) found.push("interjection");
  if (label.includes("名詞")) found.push("noun");
  if (label.includes("動詞")) found.push("verb");
  if (label.includes("形容詞")) found.push("adjective");
  if (label.includes("副詞")) found.push("adverb");

  if (found.length === 0) {
    return { pos: "", reason: "label_present_but_unknown" };
  }

  const chosen = chooseSinglePosFromSet(new Set(found));
  const reason = found.length === 1
    ? "label_raw_all"
    : `label_raw_all_multi:${found.join("|")}`;

  return { pos: chosen, reason };
}

function guessPosByMeaningShape(meaningText) {
  const meaning = String(meaningText ?? "");

  if (!meaning) return { pos: "", reason: "" };

  if (meaning.includes("～できる") || meaning.includes("すべき")) {
    return { pos: "auxiliary", reason: "meaning_shape_auxiliary_guess" };
  }

  if (/^～/.test(meaning) || meaning.includes("～の") || meaning.includes("～で") || meaning.includes("～へ") || meaning.includes("～から")) {
    return { pos: "preposition", reason: "meaning_shape_preposition_guess" };
  }

  return { pos: "", reason: "" };
}

function resolvePos(row, v0PosIndex) {
  const word = normalizeWord(row.expression);
  const meaningJa = cleanMeaning(row.meaning_ja_primary || row.meaning_ja_all);

  const byLabel = guessPosFromLabel(row.label_raw_all);
  if (byLabel.pos) {
    return byLabel;
  }

  const v0PosSet = v0PosIndex.get(word);
  if (v0PosSet && v0PosSet.size > 0) {
    const chosen = chooseSinglePosFromSet(v0PosSet);
    return {
      pos: chosen,
      reason: `v0_master_pos:${[...v0PosSet].join("|")}`,
    };
  }

  const basicPos = BASIC_POS_MAP.get(word);
  if (basicPos) {
    return {
      pos: basicPos,
      reason: "basic_pos_map",
    };
  }

  const byMeaning = guessPosByMeaningShape(meaningJa);
  if (byMeaning.pos) {
    return byMeaning;
  }

  return {
    pos: "review",
    reason: byLabel.reason || "missing_or_unknown_pos_label",
  };
}

function toNote(row, posReason) {
  const parts = [];

  parts.push("英検語彙由来のv2正本候補");

  if (row.min_eiken_level) {
    parts.push(`英検最小級=${row.min_eiken_level}`);
  }

  if (row.eiken_levels) {
    parts.push(`出現級=${row.eiken_levels}`);
  }

  if (posReason) {
    parts.push(`pos判定=${posReason}`);
  }

  return parts.join("。");
}

function toNote2(row) {
  const parts = [];

  if (row.source_refs) {
    parts.push(`source_refs=${row.source_refs}`);
  }

  if (row.row_count) {
    parts.push(`row_count=${row.row_count}`);
  }

  if (row.label_raw_all) {
    parts.push(`label_raw_all=${row.label_raw_all}`);
  }

  if (row.meaning_ja_all && row.meaning_ja_all !== row.meaning_ja_primary) {
    parts.push(`meaning_ja_all=${row.meaning_ja_all}`);
  }

  return parts.join("; ");
}

const { rows } = readCsv(INPUT_PATH);
const { rows: v0Rows } = readCsv(V0_MASTER_PATH);
const v0PosIndex = buildV0PosIndex(v0Rows);

const masterRows = [];
const posReviewRows = [];

rows.forEach((row, index) => {
  const word = normalizeWord(row.expression);
  const meaningJa = cleanMeaning(row.meaning_ja_primary || row.meaning_ja_all);
  const { pos, reason } = resolvePos(row, v0PosIndex);

  const masterRow = {
    action: pos === "review" ? "review" : "add",
    source_rank: String(index + 1),
    word,
    lemma: word,
    pos,
    form_type: "base",
    sense_id: "1",
    meaning_ja: meaningJa,
    level: row.parari_level || "review",
    importance: row.importance || "3",
    category: "eiken",
    note: toNote(row, reason),
    note2: toNote2(row),
  };

  masterRows.push(masterRow);

  if (pos === "review") {
    posReviewRows.push({
      ...masterRow,
      original_expression: row.expression,
      original_label_raw_all: row.label_raw_all,
      original_meaning_ja_all: row.meaning_ja_all,
      pos_review_reason: reason,
    });
  }
});

writeCsv(OUT_MASTER_CANDIDATES_PATH, masterRows, MASTER_HEADERS);

writeCsv(OUT_POS_REVIEW_PATH, posReviewRows, [
  ...MASTER_HEADERS,
  "original_expression",
  "original_label_raw_all",
  "original_meaning_ja_all",
  "pos_review_reason",
]);

const counts = new Map();
for (const row of masterRows) {
  counts.set(row.pos, (counts.get(row.pos) ?? 0) + 1);
}

console.log("PARARI EIKEN v2 master candidate preparation finished.");
console.log(`input base rows: ${rows.length}`);
console.log(`v0 master rows: ${v0Rows.length}`);
console.log(`master candidate rows: ${masterRows.length}`);
console.log(`pos review rows: ${posReviewRows.length}`);

console.log("\npos counts:");
for (const [pos, count] of [...counts.entries()].sort((a, b) =>
  String(a[0]).localeCompare(String(b[0])),
)) {
  console.log(`  ${pos}: ${count}`);
}

console.log(`\nwrote: ${OUT_MASTER_CANDIDATES_PATH}`);
console.log(`wrote: ${OUT_POS_REVIEW_PATH}`);
