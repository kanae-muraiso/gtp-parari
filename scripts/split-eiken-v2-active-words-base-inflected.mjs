// scripts/split-eiken-v2-active-words-base-inflected.mjs
// 2026-06-17 JST
// PART: split active EIKEN v2 word candidates into base / inflected / review candidates

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const INPUT_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_word_candidates_5_to_2.csv",
);

const OUT_BASE_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_base_word_candidates_5_to_2.csv",
);

const OUT_INFLECTED_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_inflected_word_candidates_5_to_2.csv",
);

const OUT_REVIEW_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_v2_word_review_candidates_5_to_2.csv",
);

// まずは「明らかなものだけ逃がす」ためのリストです。
// 完璧な英語処理ではなく、v2正本化前の安全弁です。

const MONTHS = new Set([
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

const WEEKDAYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

const PROPER_NOUN_LIKE = new Set([
  "america",
  "american",
  "australia",
  "australian",
  "britain",
  "british",
  "canada",
  "canadian",
  "china",
  "chinese",
  "england",
  "english",
  "france",
  "french",
  "germany",
  "german",
  "india",
  "indian",
  "italy",
  "italian",
  "japan",
  "japanese",
  "korea",
  "korean",
  "russia",
  "russian",
  "singapore",
  "taiwan",
  "thai",
  "thailand",
]);

const TITLE_OR_ABBREVIATION_LIKE = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "jr",
  "sr",
  "ok",
  "tv",
  "cd",
  "dvd",
  "pc",
  "ai",
]);

// 英検リスト内に混ざりやすい、明らかな不規則変化形。
// ここでは「正本に直接入れない候補」として逃がすだけです。
const KNOWN_INFLECTED_FORMS = new Map([
  ["ate", "eat"],
  ["began", "begin"],
  ["begun", "begin"],
  ["bought", "buy"],
  ["brought", "bring"],
  ["built", "build"],
  ["came", "come"],
  ["caught", "catch"],
  ["chose", "choose"],
  ["chosen", "choose"],
  ["did", "do"],
  ["done", "do"],
  ["drank", "drink"],
  ["drunk", "drink"],
  ["drew", "draw"],
  ["drawn", "draw"],
  ["drove", "drive"],
  ["driven", "drive"],
  ["eaten", "eat"],
  ["fell", "fall"],
  ["fallen", "fall"],
  ["felt", "feel"],
  ["found", "find"],
  ["gave", "give"],
  ["given", "give"],
  ["got", "get"],
  ["gotten", "get"],
  ["grew", "grow"],
  ["grown", "grow"],
  ["had", "have"],
  ["heard", "hear"],
  ["held", "hold"],
  ["kept", "keep"],
  ["knew", "know"],
  ["known", "know"],
  ["left", "leave"],
  ["lost", "lose"],
  ["made", "make"],
  ["met", "meet"],
  ["paid", "pay"],
  ["put", "put"],
  ["ran", "run"],
  ["read", "read"],
  ["rode", "ride"],
  ["ridden", "ride"],
  ["rose", "rise"],
  ["risen", "rise"],
  ["said", "say"],
  ["saw", "see"],
  ["seen", "see"],
  ["sent", "send"],
  ["sold", "sell"],
  ["spoke", "speak"],
  ["spoken", "speak"],
  ["spent", "spend"],
  ["stood", "stand"],
  ["swam", "swim"],
  ["swum", "swim"],
  ["taught", "teach"],
  ["told", "tell"],
  ["took", "take"],
  ["taken", "take"],
  ["thought", "think"],
  ["threw", "throw"],
  ["thrown", "throw"],
  ["tried", "try"],
  ["understood", "understand"],
  ["was", "be"],
  ["were", "be"],
  ["went", "go"],
  ["gone", "go"],
  ["won", "win"],
  ["wore", "wear"],
  ["worn", "wear"],
  ["wrote", "write"],
  ["written", "write"],

  // 名詞の不規則複数
  ["children", "child"],
  ["feet", "foot"],
  ["geese", "goose"],
  ["men", "man"],
  ["mice", "mouse"],
  ["people", "person"],
  ["teeth", "tooth"],
  ["women", "woman"],
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

function hasSuspiciousShape(word) {
  if (!word) return "blank expression";

  if (/\s/.test(word)) {
    return "contains space";
  }

  if (/[.!?]/.test(word)) {
    return "contains sentence punctuation";
  }

  if (/[~～]/.test(word)) {
    return "contains placeholder mark";
  }

  if (/[\/]/.test(word)) {
    return "contains slash";
  }

  if (!/^[a-z][a-z'-]*$/i.test(word)) {
    return "contains non alphabetic characters";
  }

  return "";
}

function guessInflectedReason(word) {
  const normalized = normalizeWord(word);

  if (KNOWN_INFLECTED_FORMS.has(normalized)) {
    return `known inflected form of ${KNOWN_INFLECTED_FORMS.get(normalized)}`;
  }

  // 規則過去形・過去分詞っぽいもの。
  // ただし、red / tired / excited のような形容詞化した語もあるので「候補」に逃がすだけ。
  if (
    normalized.length >= 5 &&
    normalized.endsWith("ed") &&
    !normalized.endsWith("red")
  ) {
    return "possible -ed form";
  }

  // -ing形っぽいもの。
  // morning / ceiling / thing などは誤判定しうるので、これも候補止まり。
  if (
    normalized.length >= 6 &&
    normalized.endsWith("ing") &&
    !["morning", "ceiling", "thing", "something", "anything", "nothing", "evening"].includes(normalized)
  ) {
    return "possible -ing form";
  }

  return "";
}

function guessReviewReason(row) {
  const word = normalizeWord(row.expression);
  const original = String(row.expression ?? "").trim();

  const shapeReason = hasSuspiciousShape(original);
  if (shapeReason) return shapeReason;

  if (MONTHS.has(word)) {
    return "month name";
  }

  if (WEEKDAYS.has(word)) {
    return "weekday name";
  }

  if (PROPER_NOUN_LIKE.has(word)) {
    return "proper noun or language/country adjective";
  }

  if (TITLE_OR_ABBREVIATION_LIKE.has(word)) {
    return "title or abbreviation";
  }

  // 先頭大文字のまま来ているものは、固有名詞っぽい可能性があります。
  // ただし CSVでは expression が April のように大文字のまま残るため review に逃がします。
  if (/^[A-Z]/.test(original)) {
    return "capitalized word";
  }

  return "";
}

function countBy(rows, key) {
  const counts = new Map();

  for (const row of rows) {
    const value = row[key] || "(blank)";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

const { headers, rows } = readCsv(INPUT_PATH);

const baseRows = [];
const inflectedRows = [];
const reviewRows = [];

for (const row of rows) {
  const expression = String(row.expression ?? "").trim();

  const reviewReason = guessReviewReason(row);
  if (reviewReason) {
    reviewRows.push({
      ...row,
      review_reason: reviewReason,
    });
    continue;
  }

  const inflectedReason = guessInflectedReason(expression);
  if (inflectedReason) {
    inflectedRows.push({
      ...row,
      guessed_lemma: KNOWN_INFLECTED_FORMS.get(normalizeWord(expression)) ?? "",
      inflected_reason: inflectedReason,
    });
    continue;
  }

  baseRows.push(row);
}

writeCsv(OUT_BASE_PATH, baseRows, headers);
writeCsv(OUT_INFLECTED_PATH, inflectedRows, [
  ...headers,
  "guessed_lemma",
  "inflected_reason",
]);
writeCsv(OUT_REVIEW_PATH, reviewRows, [...headers, "review_reason"]);

console.log("PARARI EIKEN v2 active word split finished.");
console.log(`input rows: ${rows.length}`);
console.log(`base candidates: ${baseRows.length}`);
console.log(`inflected candidates: ${inflectedRows.length}`);
console.log(`review candidates: ${reviewRows.length}`);

console.log("\ninflected reasons:");
for (const [reason, count] of countBy(inflectedRows, "inflected_reason")) {
  console.log(`  ${reason}: ${count}`);
}

console.log("\nreview reasons:");
for (const [reason, count] of countBy(reviewRows, "review_reason")) {
  console.log(`  ${reason}: ${count}`);
}

console.log(`\nwrote: ${OUT_BASE_PATH}`);
console.log(`wrote: ${OUT_INFLECTED_PATH}`);
console.log(`wrote: ${OUT_REVIEW_PATH}`);
