// scripts/split-eiken-v2-master-candidates-clean-review.mjs
// scripts/split-eiken-v2-master-candidates-clean-review.mjs
// 2026-06-17 JST
// PART: split PARARI dictionary master v2 candidates into clean candidates and semantic review candidates
// NOTE: improved version avoids false positives from note2 semicolon separators

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const INPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_base_candidates.csv",
);

const OUT_CLEAN_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_clean_candidates.csv",
);

const OUT_REVIEW_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v2_semantic_review.csv",
);

const POS_JA_TO_EN = new Map([
  ["冠詞", "article"],
  ["代名詞", "pronoun"],
  ["前置詞", "preposition"],
  ["接続詞", "conjunction"],
  ["数詞", "numeral"],
  ["序数詞", "ordinal"],
  ["助動詞", "auxiliary"],
  ["間投詞", "interjection"],
  ["名詞", "noun"],
  ["動詞", "verb"],
  ["形容詞", "adjective"],
  ["副詞", "adverb"],
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

function extractNote2Value(note2, key) {
  const text = String(note2 ?? "");
  const marker = `${key}=`;
  const start = text.indexOf(marker);

  if (start === -1) return "";

  const valueStart = start + marker.length;
  const rest = text.slice(valueStart);

  // note2 は "; " 区切り。ただし値の中に日本語読点やスラッシュは残す。
  const nextSeparator = rest.indexOf("; ");
  if (nextSeparator === -1) return rest.trim();

  return rest.slice(0, nextSeparator).trim();
}

function extractPosReason(note) {
  const text = String(note ?? "");
  const marker = "pos判定=";
  const start = text.indexOf(marker);

  if (start === -1) return "";

  return text.slice(start + marker.length).trim();
}

function normalizeJapaneseMeaning(value) {
  return String(value ?? "")
    .trim()
    .replace(/[ 　]/g, "")
    .replace(/[，、]/g, ",")
    .replace(/[。．.]/g, "")
    .replace(/學/g, "学");
}

function splitMeaningVariants(value) {
  return String(value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function hasRealMeaningVariants(row) {
  const meaningAll = extractNote2Value(row.note2, "meaning_ja_all");
  if (!meaningAll) return false;

  const variants = splitMeaningVariants(meaningAll);
  if (variants.length <= 1) return false;

  const normalized = new Set(variants.map(normalizeJapaneseMeaning));

  // 表記揺れだけなら review にしない
  if (normalized.size <= 1) return false;

  const primary = normalizeJapaneseMeaning(row.meaning_ja);

  // primary とほぼ同じ表現が含まれ、他もかなり近いなら一旦 clean に残す
  // ここでは厳密な類似判定はしない。明らかな複数意味だけ拾う。
  const joined = [...normalized].join(" / ");

  // 明らかに別意味が混ざるサイン
  const strongSignals = [
    " / ",
    "我慢",
    "圧迫",
    "直面",
    "言い訳",
    "許す",
    "右",
    "正しい",
    "閉じ",
    "近い",
    "去る",
    "残す",
    "硬い",
    "一生懸命",
    "好む",
    "ような",
  ];

  // slash自体ではなく、normalized sizeがあり、primaryと異質な語があるときだけ拾う
  if (
    normalized.size >= 2 &&
    variants.some((variant) => {
      const n = normalizeJapaneseMeaning(variant);
      if (n === primary) return false;

      // primaryと片方が包含関係なら表記揺れ寄り
      if (n.includes(primary) || primary.includes(n)) return false;

      return true;
    })
  ) {
    return true;
  }

  return strongSignals.some((signal) => joined.includes(signal));
}

function hasMultiplePosFromV0(row) {
  const reason = extractPosReason(row.note);
  return reason.startsWith("v0_master_pos:") && reason.includes("|");
}

function hasMultiplePosFromLabelRaw(row) {
  const labelRaw = extractNote2Value(row.note2, "label_raw_all");
  if (!labelRaw) return false;

  const found = [];

  for (const [ja, en] of POS_JA_TO_EN.entries()) {
    if (labelRaw.includes(ja)) {
      found.push(en);
    }
  }

  return new Set(found).size >= 2;
}

function isProbablyWrongPrimaryMeaning(row) {
  const word = String(row.word ?? "");
  const pos = String(row.pos ?? "");
  const meaning = String(row.meaning_ja ?? "");

  if (word === "bear" && pos === "verb" && meaning.includes("クマ")) {
    return true;
  }

  if (word === "like" && pos === "preposition" && meaning.includes("好")) {
    return true;
  }

  if (word === "excuse" && pos === "noun" && meaning.includes("許")) {
    return true;
  }

  return false;
}

function reviewReason(row) {
  const reasons = [];

  if (String(row.action ?? "") !== "add") {
    reasons.push("action_is_not_add");
  }

  if (hasMultiplePosFromV0(row)) {
    reasons.push("multiple_pos_from_v0");
  }

  if (hasMultiplePosFromLabelRaw(row)) {
    reasons.push("multiple_pos_from_label_raw");
  }

  if (hasRealMeaningVariants(row)) {
    reasons.push("real_meaning_variants");
  }

  if (isProbablyWrongPrimaryMeaning(row)) {
    reasons.push("possible_wrong_primary_meaning_for_pos");
  }

  return reasons.join(";");
}

const { headers, rows } = readCsv(INPUT_PATH);

const cleanRows = [];
const reviewRows = [];

for (const row of rows) {
  const reason = reviewReason(row);

  if (reason) {
    reviewRows.push({
      ...row,
      semantic_review_reason: reason,
    });
  } else {
    cleanRows.push(row);
  }
}

writeCsv(OUT_CLEAN_PATH, cleanRows, headers);
writeCsv(OUT_REVIEW_PATH, reviewRows, [...headers, "semantic_review_reason"]);

const reasonCounts = new Map();

for (const row of reviewRows) {
  for (const reason of String(row.semantic_review_reason ?? "").split(";")) {
    if (!reason) continue;
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
}

console.log("PARARI EIKEN v2 semantic split finished.");
console.log(`input rows: ${rows.length}`);
console.log(`clean candidates: ${cleanRows.length}`);
console.log(`semantic review rows: ${reviewRows.length}`);

console.log("\nsemantic review reasons:");
for (const [reason, count] of [...reasonCounts.entries()].sort((a, b) =>
  String(a[0]).localeCompare(String(b[0])),
)) {
  console.log(`  ${reason}: ${count}`);
}

console.log(`\nwrote: ${OUT_CLEAN_PATH}`);
console.log(`wrote: ${OUT_REVIEW_PATH}`);
