// scripts/diff-center-exam-words.mjs
// 2026-06-17 JST
// PART: diff center exam word list against PARARI English dictionary master

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const MASTER_PATH = path.join(
  ROOT_DIR,
  "data",
  "parari_english_dictionary_master_v0.csv",
);

const CENTER_PATH = path.join(ROOT_DIR, "data", "center_exam_words.csv");

const OUT_AUTO_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_diff_auto_candidates.csv",
);

const OUT_REVIEW_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_diff_review.csv",
);

const OUT_EXISTING_PATH = path.join(
  ROOT_DIR,
  "data",
  "center_exam_diff_existing.csv",
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

  if (lines.length === 0) {
    return [];
  }

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

function parsePmw(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/\d+/);

  return match ? Number(match[0]) : 0;
}

function isMultiWordOrSymbolWord(word) {
  return (
    /\s/.test(word) ||
    /[()/]/.test(word) ||
    /[^A-Za-z0-9'&.-]/.test(word)
  );
}

function isLikelyAcronym(word) {
  return /^[A-Z0-9]{2,}$/.test(word);
}

function isLikelyProperNoun(word, centerPos) {
  if (centerPos === "NP") return true;

  return /^[A-Z][a-z]+/.test(word);
}

function mapCenterPosToParari(centerPos) {
  const pos = String(centerPos ?? "").trim();

  switch (pos) {
    case "NN":
      return { parariPos: "noun", formType: "base", review: false };

    case "JJ":
      return { parariPos: "adjective", formType: "base", review: false };

    case "RB":
      return { parariPos: "adverb", formType: "base", review: false };

    case "VV":
    case "VVP":
    case "VB":
      return { parariPos: "verb", formType: "base", review: false };

    case "CD":
      return { parariPos: "numeral", formType: "base", review: false };

    case "UH":
      return { parariPos: "interjection", formType: "base", review: false };

    case "MD":
      return { parariPos: "auxiliary", formType: "base", review: true };

    case "NNS":
      return { parariPos: "noun", formType: "plural", review: true };

    case "JJR":
      return { parariPos: "adjective", formType: "comparative", review: true };

    case "JJS":
      return { parariPos: "adjective", formType: "superlative", review: true };

    case "RBR":
      return { parariPos: "adverb", formType: "comparative", review: true };

    case "RBS":
      return { parariPos: "adverb", formType: "superlative", review: true };

    case "VVD":
      return { parariPos: "verb", formType: "past", review: true };

    case "VVN":
      return { parariPos: "verb", formType: "past_participle", review: true };

    case "VVG":
    case "VBG":
      return { parariPos: "verb", formType: "present_participle", review: true };

    case "IN":
      return { parariPos: "preposition", formType: "base", review: true };

    case "CC":
      return { parariPos: "conjunction", formType: "base", review: true };

    case "TO":
      return { parariPos: "preposition", formType: "base", review: true };

    case "DT":
    case "WDT":
    case "PP":
    case "PP$":
    case "WP":
    case "WP$":
    case "WRB":
      return { parariPos: "pronoun", formType: "base", review: true };

    case "NP":
      return { parariPos: "noun", formType: "base", review: true };

    default:
      return { parariPos: "", formType: "", review: true };
  }
}

function suggestLevel(pmwNumber) {
  if (pmwNumber >= 1000) return "high_school";
  if (pmwNumber >= 100) return "high_school";
  return "exam";
}

function suggestImportance(pmwNumber) {
  if (pmwNumber >= 1000) return "2";
  if (pmwNumber >= 100) return "2";
  return "2";
}

const masterRows = readTable(MASTER_PATH);
const centerRows = readTable(CENTER_PATH);

const existingWords = new Set();
const existingLemmas = new Set();

for (const row of masterRows) {
  const action = String(row.action ?? "").trim();

  if (action !== "add" && action !== "add_pos_variant") {
    continue;
  }

  const word = normalizeWord(row.word);
  const lemma = normalizeWord(row.lemma);

  if (word) existingWords.add(word);
  if (lemma) existingLemmas.add(lemma);
}

const autoRows = [];
const reviewRows = [];
const existingRows = [];

for (const row of centerRows) {
  const sourceRank = row["#"] || row.rank || row.RANK || "";
  const rawWord = row.WORD || row.word || "";
  const centerPos = String(row.POS || row.pos || "").trim();
  const pmw = row.PMW || row.pmw || "";

  const normalized = normalizeWord(rawWord);

  if (!normalized) {
    continue;
  }

  const matchedByWord = existingWords.has(normalized);
  const matchedByLemma = existingLemmas.has(normalized);

  if (matchedByWord || matchedByLemma) {
    existingRows.push({
      source_rank: sourceRank,
      word: rawWord,
      normalized_word: normalized,
      center_pos: centerPos,
      center_pmw: pmw,
      matched_by: matchedByWord ? "word" : "lemma",
    });
    continue;
  }

  const pmwNumber = parsePmw(pmw);
  const mapped = mapCenterPosToParari(centerPos);

  const reviewReasons = [];

  if (mapped.review) {
    reviewReasons.push("pos_review");
  }

  if (isMultiWordOrSymbolWord(rawWord)) {
    reviewReasons.push("multiword_or_symbol");
  }

  if (isLikelyAcronym(rawWord)) {
    reviewReasons.push("acronym");
  }

  if (isLikelyProperNoun(rawWord, centerPos)) {
    reviewReasons.push("proper_noun");
  }

  if (!mapped.parariPos || !mapped.formType) {
    reviewReasons.push("unknown_pos");
  }

  const baseOutput = {
    action: "add",
    source_rank: sourceRank,
    word: normalized,
    lemma: normalized,
    pos: mapped.parariPos,
    form_type: mapped.formType,
    sense_id: "1",
    meaning_ja: "",
    level: suggestLevel(pmwNumber),
    importance: suggestImportance(pmwNumber),
    category: "center_exam",
    note: "センター試験語彙リスト由来。意味は要補充",
    note2: `center_pos=${centerPos}; center_pmw=${pmw}`,
    center_word_original: rawWord,
    center_pos: centerPos,
    center_pmw: pmw,
    review_reason: reviewReasons.join(";"),
  };

  if (reviewReasons.length > 0) {
    reviewRows.push(baseOutput);
  } else {
    autoRows.push(baseOutput);
  }
}

const candidateHeaders = [
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

writeCsv(OUT_AUTO_PATH, autoRows, candidateHeaders);
writeCsv(OUT_REVIEW_PATH, reviewRows, candidateHeaders);

writeCsv(OUT_EXISTING_PATH, existingRows, [
  "source_rank",
  "word",
  "normalized_word",
  "center_pos",
  "center_pmw",
  "matched_by",
]);

console.log("PARARI center exam diff finished.");
console.log(`master rows: ${masterRows.length}`);
console.log(`center rows: ${centerRows.length}`);
console.log(`existing: ${existingRows.length}`);
console.log(`auto candidates: ${autoRows.length}`);
console.log(`review: ${reviewRows.length}`);
console.log(`wrote: ${OUT_AUTO_PATH}`);
console.log(`wrote: ${OUT_REVIEW_PATH}`);
console.log(`wrote: ${OUT_EXISTING_PATH}`);
