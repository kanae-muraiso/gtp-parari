// scripts/build-parari-english-glossary.mjs
// scripts/build-parari-english-glossary.mjs
// 2026-06-16 JST
// PART: Build PARARI English glossary TypeScript data from master CSV
// NOTE: CSV正本 + 規則複数形 + 現在分詞を生成する

import fs from "node:fs";
import path from "node:path";

const INPUT_PATH = path.resolve("data/parari_english_dictionary_master_v0.csv");

const OUTPUT_PATH = path.resolve(
  "src/lib/parari/english/parariEnglishGlossary.generated.ts"
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

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

function normalizeAction(action) {
  return String(action ?? "").trim();
}

function normalizeLevel(level) {
  const value = String(level ?? "").trim();

  if (value === "junior-high") return "junior_high";
  if (value === "junior_high") return "junior_high";
  if (value === "high_school") return "high_school";
  if (value === "exam") return "exam";

  return "junior_high";
}

function normalizeImportance(value) {
  const number = Number.parseInt(String(value ?? "1"), 10);

  if (number === 2) return 2;
  if (number === 3) return 3;

  return 1;
}

function escapeTsString(value) {
  return JSON.stringify(String(value ?? ""));
}

function shouldUseRow(row) {
  const action = normalizeAction(row.action);

  if (action !== "add" && action !== "add_pos_variant") {
    return false;
  }

  if (!String(row.word ?? "").trim()) {
    return false;
  }

  if (!String(row.meaning_ja ?? "").trim()) {
    return false;
  }

  return true;
}

function makeEntry(row) {
  const word = String(row.word ?? "").trim();
  const lemma = String(row.lemma ?? "").trim() || word;
  const pos = String(row.pos ?? "").trim() || "noun";
  const formType = String(row.form_type ?? "").trim() || "base";
  const senseId = String(row.sense_id ?? "").trim() || "1";
  const meaningJa = String(row.meaning_ja ?? "").trim();
  const level = normalizeLevel(row.level);
  const importance = normalizeImportance(row.importance);
  const category = String(row.category ?? "").trim();
  const note = String(row.note ?? "").trim();
  const note2 = String(row.note2 ?? "").trim();

  return {
      word,
      lemma,
      pos,
      formType,
      senseId,
      meaningJa,
      level,
      importance,
      category,
      note,
      note2,
  };
}

function isVowel(char) {
  return /^[aeiou]$/i.test(char);
}

function isConsonant(char) {
  return /^[bcdfghjklmnpqrstvwxyz]$/i.test(char);
}

function hasBadAutoGenerationNote(entry) {
  const text = `${entry.note ?? ""} ${entry.note2 ?? ""}`;

  return (
    text.includes("不可算") ||
    text.includes("単複同形") ||
    text.includes("複数扱い") ||
    text.includes("通常は複数") ||
    text.includes("要確認") ||
    text.includes("review")
  );
}

const NO_AUTO_PLURAL_NOUNS = new Set([
  "advice",
  "air",
  "coffee",
  "homework",
  "information",
  "money",
  "music",
  "news",
  "rice",
  "tea",
  "traffic",
  "water",
  "weather",
  "work",
]);

const O_ENDING_PLURAL_S_NOUNS = new Set([
  "photo",
  "piano",
  "radio",
  "video",
  "zoo",
  "studio",
  "kangaroo",
  "bamboo",
]);

const DOUBLE_FINAL_CONSONANT_VERBS = new Set([
  "begin",
  "get",
  "sit",
  "run",
  "swim",
  "stop",
  "plan",
  "drop",
  "shop",
  "clap",
  "chat",
  "fit",
  "hit",
  "put",
  "cut",
  "set",
]);

function makeRegularPlural(word) {
  const lower = word.toLowerCase();

  if (lower.endsWith("s")) {
    return "";
  }

  if (
    lower.endsWith("s") ||
    lower.endsWith("x") ||
    lower.endsWith("z") ||
    lower.endsWith("ch") ||
    lower.endsWith("sh")
  ) {
    return `${word}es`;
  }

  if (
    lower.endsWith("y") &&
    word.length >= 2 &&
    isConsonant(word[word.length - 2])
  ) {
    return `${word.slice(0, -1)}ies`;
  }

  if (lower.endsWith("fe")) {
    return `${word.slice(0, -2)}ves`;
  }

  if (lower.endsWith("f")) {
    return `${word.slice(0, -1)}ves`;
  }

    if (lower.endsWith("o")) {
      if (O_ENDING_PLURAL_S_NOUNS.has(lower)) {
        return `${word}s`;
      }

      return `${word}es`;
    }

  return `${word}s`;
}

function shouldGenerateRegularPlural(entry) {
  if (entry.pos !== "noun") return false;
  if (entry.formType !== "base") return false;
  if (!entry.word) return false;

  const lower = entry.word.toLowerCase();

  if (NO_AUTO_PLURAL_NOUNS.has(lower)) return false;
  if (hasBadAutoGenerationNote(entry)) return false;

  // 固有名詞っぽいものは、いったん自動複数化しない
  if (/^[A-Z]/.test(entry.word)) return false;

  return true;
}

function makePresentParticiple(word) {
  const lower = word.toLowerCase();

  if (lower.endsWith("ie")) {
    return `${word.slice(0, -2)}ying`;
  }

  if (
    lower.endsWith("e") &&
    !lower.endsWith("ee") &&
    !lower.endsWith("ye") &&
    !lower.endsWith("oe")
  ) {
    return `${word.slice(0, -1)}ing`;
  }

  if (DOUBLE_FINAL_CONSONANT_VERBS.has(lower)) {
    const last = word[word.length - 1];
    return `${word}${last}ing`;
  }

  return `${word}ing`;
}

function shouldGeneratePresentParticiple(entry) {
  if (entry.pos !== "verb") return false;
  if (entry.formType !== "base") return false;
  if (!entry.word) return false;

  const text = `${entry.note ?? ""} ${entry.note2 ?? ""}`;

  if (text.includes("要確認") || text.includes("review")) {
    return false;
  }

  return true;
}

function makeManualFormIndex(entries) {
  const index = new Set();

  for (const entry of entries) {
    index.add(
      [
        entry.lemma.toLowerCase(),
        entry.pos,
        entry.formType,
        String(entry.senseId ?? "1"),
      ].join("|")
    );
  }

  return index;
}

function hasManualForm(manualFormIndex, entry, formType) {
  return manualFormIndex.has(
    [
      entry.lemma.toLowerCase(),
      entry.pos,
      formType,
      String(entry.senseId ?? "1"),
    ].join("|")
  );
}

function makeThirdPersonSingular(word) {
  const lower = word.toLowerCase();

  if (lower === "be") return "is";
  if (lower === "have") return "has";

  if (
    lower.endsWith("s") ||
    lower.endsWith("x") ||
    lower.endsWith("z") ||
    lower.endsWith("ch") ||
    lower.endsWith("sh") ||
    lower.endsWith("o")
  ) {
    return `${word}es`;
  }

  if (
    lower.endsWith("y") &&
    word.length >= 2 &&
    isConsonant(word[word.length - 2])
  ) {
    return `${word.slice(0, -1)}ies`;
  }

  return `${word}s`;
}

function makeRegularPast(word) {
  const lower = word.toLowerCase();

  if (lower.endsWith("e")) {
    return `${word}d`;
  }

  if (
    lower.endsWith("y") &&
    word.length >= 2 &&
    isConsonant(word[word.length - 2])
  ) {
    return `${word.slice(0, -1)}ied`;
  }

  if (DOUBLE_FINAL_CONSONANT_VERBS.has(lower)) {
    const last = word[word.length - 1];
    return `${word}${last}ed`;
  }

  return `${word}ed`;
}

// scripts/build-parari-english-glossary.mjs
// 2026-06-17 JST
// PART: adjective comparative / superlative generation helpers

const DOUBLE_FINAL_CONSONANT_ADJECTIVES = new Set([
  "big",
  "hot",
  "thin",
  "fat",
  "sad",
  "red",
  "wet",
]);

function shouldSkipAdjectiveDegree(entry) {
  const word = String(entry.word ?? "");
  const lower = word.toLowerCase();
  const text = `${entry.note ?? ""} ${entry.note2 ?? ""}`;

  if (entry.pos !== "adjective") return true;
  if (entry.formType !== "base") return true;
  if (!word) return true;

  if (text.includes("要確認") || text.includes("review")) return true;
  if (text.includes("more/most")) return true;
  if (text.includes("more most")) return true;
  if (text.includes("不規則比較")) return true;

  // tired / interested / exciting などは more/most 型になりやすいので、いったん自動生成しない
  if (lower.endsWith("ed") || lower.endsWith("ing")) return true;

  // beautiful / important など長い形容詞は more/most 型として扱う
  if (lower.length >= 7) return true;

  // 固有名詞由来っぽいものは除外
  if (/^[A-Z]/.test(word)) return true;

  return false;
}

function makeAdjectiveComparative(word) {
  const lower = word.toLowerCase();

  if (
    lower.endsWith("y") &&
    word.length >= 2 &&
    isConsonant(word[word.length - 2])
  ) {
    return `${word.slice(0, -1)}ier`;
  }

  if (lower.endsWith("e")) {
    return `${word}r`;
  }

  if (DOUBLE_FINAL_CONSONANT_ADJECTIVES.has(lower)) {
    const last = word[word.length - 1];
    return `${word}${last}er`;
  }

  return `${word}er`;
}

function makeAdjectiveSuperlative(word) {
  const lower = word.toLowerCase();

  if (
    lower.endsWith("y") &&
    word.length >= 2 &&
    isConsonant(word[word.length - 2])
  ) {
    return `${word.slice(0, -1)}iest`;
  }

  if (lower.endsWith("e")) {
    return `${word}st`;
  }

  if (DOUBLE_FINAL_CONSONANT_ADJECTIVES.has(lower)) {
    const last = word[word.length - 1];
    return `${word}${last}est`;
  }

  return `${word}est`;
}

function shouldGenerateAdjectiveComparative(entry, manualFormIndex) {
  if (shouldSkipAdjectiveDegree(entry)) return false;

  if (hasManualForm(manualFormIndex, entry, "comparative")) {
    return false;
  }

  return true;
}

function shouldGenerateAdjectiveSuperlative(entry, manualFormIndex) {
  if (shouldSkipAdjectiveDegree(entry)) return false;

  if (hasManualForm(manualFormIndex, entry, "superlative")) {
    return false;
  }

  return true;
}

const AUTO_DEGREE_ADVERBS = new Set([
  "fast",
  "hard",
  "early",
  "late",
  "near",
  "soon",
]);

function shouldSkipAdverbDegree(entry) {
  const word = String(entry.word ?? "");
  const lower = word.toLowerCase();
  const text = `${entry.note ?? ""} ${entry.note2 ?? ""}`;

  if (entry.pos !== "adverb") return true;
  if (entry.formType !== "base") return true;
  if (!word) return true;

  if (text.includes("要確認") || text.includes("review")) return true;
  if (text.includes("more/most")) return true;
  if (text.includes("不規則比較")) return true;

  // -ly 副詞は more/most 型が多いので自動生成しない
  if (lower.endsWith("ly")) return true;

  // 安全なものだけ生成する
  if (!AUTO_DEGREE_ADVERBS.has(lower)) return true;

  return false;
}

function makeAdverbComparative(word) {
  const lower = word.toLowerCase();

  if (
    lower.endsWith("y") &&
    word.length >= 2 &&
    isConsonant(word[word.length - 2])
  ) {
    return `${word.slice(0, -1)}ier`;
  }

  if (lower.endsWith("e")) {
    return `${word}r`;
  }

  return `${word}er`;
}

function makeAdverbSuperlative(word) {
  const lower = word.toLowerCase();

  if (
    lower.endsWith("y") &&
    word.length >= 2 &&
    isConsonant(word[word.length - 2])
  ) {
    return `${word.slice(0, -1)}iest`;
  }

  if (lower.endsWith("e")) {
    return `${word}st`;
  }

  return `${word}est`;
}

function shouldGenerateAdverbComparative(entry, manualFormIndex) {
  if (shouldSkipAdverbDegree(entry)) return false;

  if (hasManualForm(manualFormIndex, entry, "comparative")) {
    return false;
  }

  return true;
}

function shouldGenerateAdverbSuperlative(entry, manualFormIndex) {
  if (shouldSkipAdverbDegree(entry)) return false;

  if (hasManualForm(manualFormIndex, entry, "superlative")) {
    return false;
  }

  return true;
}

function shouldGenerateThirdPersonSingular(entry, manualFormIndex) {
  if (entry.pos !== "verb") return false;
  if (entry.formType !== "base") return false;
  if (!entry.word) return false;

  const text = `${entry.note ?? ""} ${entry.note2 ?? ""}`;

  if (text.includes("要確認") || text.includes("review")) {
    return false;
  }

  if (hasManualForm(manualFormIndex, entry, "third_person_singular")) {
    return false;
  }

  return true;
}

function shouldGenerateRegularPast(entry, manualFormIndex) {
  if (entry.pos !== "verb") return false;
  if (entry.formType !== "base") return false;
  if (!entry.word) return false;

  const text = `${entry.note ?? ""} ${entry.note2 ?? ""}`;

  if (text.includes("要確認") || text.includes("review")) {
    return false;
  }

  // すでに不規則 past が手動登録されている動詞には、looked 型を作らない
  if (hasManualForm(manualFormIndex, entry, "past")) {
    return false;
  }

  return true;
}

function shouldGenerateRegularPastParticiple(entry, manualFormIndex) {
  if (entry.pos !== "verb") return false;
  if (entry.formType !== "base") return false;
  if (!entry.word) return false;

  const text = `${entry.note ?? ""} ${entry.note2 ?? ""}`;

  if (text.includes("要確認") || text.includes("review")) {
    return false;
  }

  // すでに不規則 past_participle が手動登録されている動詞には、looked 型を作らない
  if (hasManualForm(manualFormIndex, entry, "past_participle")) {
    return false;
  }

  return true;
}

function generateRegularEntries(entries) {
  const generated = [];
  const manualFormIndex = makeManualFormIndex(entries);

  for (const entry of entries) {
    if (shouldGenerateRegularPlural(entry)) {
      const plural = makeRegularPlural(entry.word);

      if (plural) {
        generated.push({
          ...entry,
          word: plural,
          lemma: entry.lemma || entry.word,
          formType: "plural",
          note: `${entry.word} の複数形`,
          note2: "規則複数形を自動生成",
        });
      }
    }

    if (shouldGeneratePresentParticiple(entry)) {
      const ing = makePresentParticiple(entry.word);

      generated.push({
        ...entry,
        word: ing,
        lemma: entry.lemma || entry.word,
        formType: "present_participle",
        note: `${entry.word} の現在分詞・動名詞`,
        note2: "現在分詞・動名詞を自動生成",
      });
    }

    if (shouldGenerateThirdPersonSingular(entry, manualFormIndex)) {
      const thirdPersonSingular = makeThirdPersonSingular(entry.word);

      generated.push({
        ...entry,
        word: thirdPersonSingular,
        lemma: entry.lemma || entry.word,
        formType: "third_person_singular",
        note: `${entry.word} の三人称単数現在形`,
        note2: "三人称単数現在形を自動生成",
      });
    }

    if (shouldGenerateRegularPast(entry, manualFormIndex)) {
      const past = makeRegularPast(entry.word);

      generated.push({
        ...entry,
        word: past,
        lemma: entry.lemma || entry.word,
        formType: "past",
        note: `${entry.word} の過去形`,
        note2: "規則過去形を自動生成",
      });
    }

    if (shouldGenerateRegularPastParticiple(entry, manualFormIndex)) {
      const pastParticiple = makeRegularPast(entry.word);

      generated.push({
        ...entry,
        word: pastParticiple,
        lemma: entry.lemma || entry.word,
        formType: "past_participle",
        note: `${entry.word} の過去分詞`,
        note2: "規則過去分詞を自動生成",
      });
    }

      if (shouldGenerateAdjectiveComparative(entry, manualFormIndex)) {
        const comparative = makeAdjectiveComparative(entry.word);

        generated.push({
          ...entry,
          word: comparative,
          lemma: entry.lemma || entry.word,
          formType: "comparative",
          note: `${entry.word} の比較級`,
          note2: "形容詞の比較級を自動生成",
        });
      }

      if (shouldGenerateAdjectiveSuperlative(entry, manualFormIndex)) {
        const superlative = makeAdjectiveSuperlative(entry.word);

        generated.push({
          ...entry,
          word: superlative,
          lemma: entry.lemma || entry.word,
          formType: "superlative",
          note: `${entry.word} の最上級`,
          note2: "形容詞の最上級を自動生成",
        });
      }
      
      if (shouldGenerateAdverbComparative(entry, manualFormIndex)) {
        const comparative = makeAdverbComparative(entry.word);

        generated.push({
          ...entry,
          word: comparative,
          lemma: entry.lemma || entry.word,
          formType: "comparative",
          note: `${entry.word} の比較級`,
          note2: "副詞の比較級を自動生成",
        });
      }

      if (shouldGenerateAdverbSuperlative(entry, manualFormIndex)) {
        const superlative = makeAdverbSuperlative(entry.word);

        generated.push({
          ...entry,
          word: superlative,
          lemma: entry.lemma || entry.word,
          formType: "superlative",
          note: `${entry.word} の最上級`,
          note2: "副詞の最上級を自動生成",
        });
      }
      
  }

  return generated;
}

function entryToTs(entry) {
  const lines = [
    "  {",
    `    word: ${escapeTsString(entry.word)},`,
    `    lemma: ${escapeTsString(entry.lemma)},`,
    `    pos: ${escapeTsString(entry.pos)} as ParariEnglishGlossaryEntry["pos"],`,
    `    formType: ${escapeTsString(
      entry.formType
    )} as ParariEnglishGlossaryEntry["formType"],`,
    `    senseId: ${escapeTsString(entry.senseId)},`,
    `    meaningJa: ${escapeTsString(entry.meaningJa)},`,
    `    level: ${escapeTsString(entry.level)} as ParariEnglishLevel,`,
    `    importance: ${entry.importance} as ParariEnglishImportance,`,
  ];

  if (entry.category) {
    lines.push(`    category: ${escapeTsString(entry.category)},`);
  }

  if (entry.note) {
    lines.push(`    note: ${escapeTsString(entry.note)},`);
  }

  if (entry.note2) {
    lines.push(`    note2: ${escapeTsString(entry.note2)},`);
  }

  lines.push("  },");

  return lines.join("\n");
}

function makeEntryKey(entry) {
  return [
    entry.word.toLowerCase(),
    entry.lemma.toLowerCase(),
    entry.pos,
    entry.formType,
    String(entry.senseId ?? "1"),
  ].join("|");
}

function dedupeEntries(entries) {
  const seen = new Set();
  const deduped = [];

  for (const entry of entries) {
    const key = makeEntryKey(entry);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(entry);
  }

  return deduped;
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const aw = a.word.toLowerCase();
    const bw = b.word.toLowerCase();

    if (aw !== bw) return aw.localeCompare(bw);
    if (a.pos !== b.pos) return a.pos.localeCompare(b.pos);
    return a.formType.localeCompare(b.formType);
  });
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`CSV not found: ${INPUT_PATH}`);
  }

  const csvText = fs.readFileSync(INPUT_PATH, "utf8");
  const rows = parseCsv(csvText);

  const manualEntries = rows.filter(shouldUseRow).map(makeEntry);
  const generatedEntries = generateRegularEntries(manualEntries);

  const deduped = sortEntries(dedupeEntries([...manualEntries, ...generatedEntries]));

  const output = `// src/lib/parari/english/parariEnglishGlossary.generated.ts
// AUTO-GENERATED by scripts/build-parari-english-glossary.mjs
// Do not edit by hand.

import type {
  ParariEnglishGlossaryEntry,
  ParariEnglishImportance,
  ParariEnglishLevel,
} from "./basicWordGlossary";

export const PARARI_ENGLISH_GLOSSARY_ENTRIES: ParariEnglishGlossaryEntry[] = [
${deduped.map(entryToTs).join("\n")}
];
`;

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, output, "utf8");

  console.log(`Generated: ${OUTPUT_PATH}`);
  console.log(`Rows read: ${rows.length}`);
  console.log(`Manual entries: ${manualEntries.length}`);
  console.log(`Generated entries: ${generatedEntries.length}`);
  console.log(`Entries generated total: ${deduped.length}`);
}

main();
