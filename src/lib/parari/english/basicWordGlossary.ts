// src/lib/parari/english/basicWordGlossary.ts
// src/lib/parari/english/basicWordGlossary.ts
// 2026-06-16 JST
// PART: PARARI English glossary bridge for word note mode

export type ParariEnglishLevel = "junior_high" | "high_school" | "exam";

export type ParariEnglishImportance = 1 | 2 | 3;

export type ParariEnglishGlossaryEntry = {
  word: string;
  lemma: string;
  pos:
    | "article"
    | "pronoun"
    | "preposition"
    | "conjunction"
    | "numeral"
    | "ordinal"
    | "auxiliary"
    | "interjection"
    | "noun"
    | "verb"
    | "adjective"
    | "adverb";
  formType:
    | "base"
    | "variant"
    | "plural"
    | "third_person_singular"
    | "past"
    | "past_participle"
    | "present_participle"
    | "comparative"
    | "superlative"
    | "archaic"
    | "contracted";
  senseId: string;
  meaningJa: string;
  level: ParariEnglishLevel;
  importance: ParariEnglishImportance;
  category?: string;
  note?: string;
  note2?: string;
};

export type BasicWordGlossaryEntry = {
  word: string;
  meaning: string;
  level: "junior-high";
};

export type ParariEnglishPhraseGlossaryEntry = {
  phrase: string;
  lemma: string;
  meaningJa: string;
  level: ParariEnglishLevel;
  importance: ParariEnglishImportance;
  category?: string;
  note?: string;
  note2?: string;
};

import { PARARI_ENGLISH_GLOSSARY_ENTRIES } from "./parariEnglishGlossary.generated";

export function normalizeEnglishLookupWord(word: string): string {
  return String(word ?? "")
    .trim()
    .replace(/[’‘`]/g, "'")
    .replace(/^[^A-Za-z']+/, "")
    .replace(/[^A-Za-z']+$/, "")
    .toLowerCase();
}

function buildParariEnglishGlossaryIndex() {
  const index: Record<string, ParariEnglishGlossaryEntry[]> = {};

  for (const entry of PARARI_ENGLISH_GLOSSARY_ENTRIES) {
    const key = normalizeEnglishLookupWord(entry.word);

    if (!key) continue;

    if (!index[key]) {
      index[key] = [];
    }

    index[key].push(entry);
  }

  return index;
}

export const PARARI_ENGLISH_GLOSSARY_INDEX: Record<
  string,
  ParariEnglishGlossaryEntry[]
> = buildParariEnglishGlossaryIndex();

export function getParariEnglishGlossaryEntries(
  word: string
): ParariEnglishGlossaryEntry[] {
  const key = normalizeEnglishLookupWord(word);

  if (!key) {
    return [];
  }

  return PARARI_ENGLISH_GLOSSARY_INDEX[key] ?? [];
}

  export const PARARI_ENGLISH_PHRASE_GLOSSARY_ENTRIES: ParariEnglishPhraseGlossaryEntry[] =
    [
      {
        phrase: "a lot of",
        lemma: "a lot of",
        meaningJa: "たくさんの",
        level: "junior_high",
        importance: 1,
        note: "複数語表現",
      },
      {
        phrase: "and so on",
        lemma: "and so on",
        meaningJa: "などなど",
        level: "junior_high",
        importance: 1,
        note: "複数語表現",
      },
      {
        phrase: "be able to",
        lemma: "be able to",
        meaningJa: "〜できる",
        level: "junior_high",
        importance: 1,
        note: "複数語表現",
      },
      {
        phrase: "elementary school",
        lemma: "elementary school",
        meaningJa: "小学校",
        level: "junior_high",
        importance: 1,
        note: "複数語表現",
      },
      {
        phrase: "in addition to",
        lemma: "in addition to",
        meaningJa: "〜に加えて",
        level: "high_school",
        importance: 2,
        note: "複数語表現",
      },
    ];  
  
function getFormTypeLabelJa(formType: ParariEnglishGlossaryEntry["formType"]) {
  switch (formType) {
    case "plural":
      return "複数形";
    case "third_person_singular":
      return "三人称単数現在形";
    case "past":
      return "過去形";
    case "past_participle":
      return "過去分詞";
    case "present_participle":
      return "現在分詞・動名詞";
    case "comparative":
      return "比較級";
    case "superlative":
      return "最上級";
    case "archaic":
      return "古語";
    case "contracted":
      return "短縮形";
    case "variant":
      return "異形";
    case "base":
    default:
      return "";
  }
}

export function formatParariEnglishGlossaryMeaning(
  entry: ParariEnglishGlossaryEntry
): string {
  const formLabel = getFormTypeLabelJa(entry.formType);

  if (!formLabel || entry.word.toLowerCase() === entry.lemma.toLowerCase()) {
    return entry.meaningJa;
  }

  return `${entry.lemma} の${formLabel}。${entry.meaningJa}`;
}

export function getBestParariEnglishGlossaryEntry(
  word: string
): ParariEnglishGlossaryEntry | null {
  const entries = getParariEnglishGlossaryEntries(word);

  if (entries.length === 0) {
    return null;
  }

  return [...entries].sort((a, b) => a.importance - b.importance)[0] ?? null;
}

export function getBasicWordGlossaryEntry(
  word: string
): BasicWordGlossaryEntry | null {
  const entries = getParariEnglishGlossaryEntries(word);

  if (entries.length === 0) {
    return null;
  }

  const meanings = entries
    .map((entry) => formatParariEnglishGlossaryMeaning(entry))
    .filter(Boolean);

  const uniqueMeanings = Array.from(new Set(meanings));

  return {
    word: entries[0].word,
    meaning: uniqueMeanings.join(" / "),
    level: "junior-high",
  };
}

    export function normalizeEnglishLookupPhrase(phrase: string): string {
      return String(phrase ?? "")
        .trim()
        .replace(/[’‘`]/g, "'")
        .replace(/\s+/g, " ")
        .toLowerCase();
    }

function buildParariEnglishPhraseGlossaryIndex() {
  const index: Record<string, ParariEnglishPhraseGlossaryEntry> = {};

  for (const entry of PARARI_ENGLISH_PHRASE_GLOSSARY_ENTRIES) {
    const key = normalizeEnglishLookupPhrase(entry.phrase);

    if (!key) continue;

    index[key] = entry;
  }

  return index;
}

export const PARARI_ENGLISH_PHRASE_GLOSSARY_INDEX: Record<
  string,
  ParariEnglishPhraseGlossaryEntry
> = buildParariEnglishPhraseGlossaryIndex();

export function getParariEnglishPhraseGlossaryEntry(
  phrase: string
): ParariEnglishPhraseGlossaryEntry | null {
  const key = normalizeEnglishLookupPhrase(phrase);

  if (!key) {
    return null;
  }

  return PARARI_ENGLISH_PHRASE_GLOSSARY_INDEX[key] ?? null;
}

export type ParariEnglishDictionaryDisplayMode =
  | "standard"
  | "study";

export function shouldAnnotateParariEnglishWord(
  word: string,
  mode: ParariEnglishDictionaryDisplayMode,
): boolean {
  const normalized = String(word ?? "").trim();

  if (normalized.length === 0) {
    return false;
  }

  if (mode === "standard" && normalized.length < 4) {
    return false;
  }

  if (mode === "study" && normalized.length < 2) {
    return false;
  }

  return true;
}

export function checkParariEnglishDictionaryWord(word: string) {
  const cleanWord = String(word ?? "")
    .replace(/[’]/g, "'")
    .trim();

  const entry = getBestParariEnglishGlossaryEntry(cleanWord);

  return {
    word: cleanWord,
    entry,
    meaning: entry
      ? formatParariEnglishGlossaryMeaning(entry)
      : "",
    visibleInStandard:
      Boolean(entry) &&
      shouldAnnotateParariEnglishWord(cleanWord, "standard"),
    visibleInStudy:
      Boolean(entry) &&
      shouldAnnotateParariEnglishWord(cleanWord, "study"),
  };
}
