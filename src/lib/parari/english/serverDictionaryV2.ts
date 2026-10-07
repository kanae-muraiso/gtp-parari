import "server-only";

import fs from "node:fs";
import path from "node:path";

export type ParariEnglishDictionaryV2ServerEntry = {
  word: string;
  lemma: string;
  pos: string;
  formType: string;
  senseId: string;
  meaningJa: string;
  eikenLevel: string | null;
  eikenLevels: string[];
  level: string;
  importance: number;
  entryKind: string;
  source: string;
  category: string | null;
};

type CsvRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
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

function readCsv(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: CsvRow = {};

    headers.forEach((header, index) => {
      row[header] = String(values[index] ?? "").trim();
    });

    return row;
  });
}

function normalize(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/[’‘`]/g, "'")
    .replace(/^[^A-Za-z']+/, "")
    .replace(/[^A-Za-z']+$/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function loadFormalEntries(): ParariEnglishDictionaryV2ServerEntry[] {
  const rows = readCsv(
    path.join(process.cwd(), "data", "parari_english_dictionary_master_v2.csv"),
  );

  return rows
    .filter((row) => row.action === "add" || row.action === "add_pos_variant")
    .map((row) => ({
      word: row.word,
      lemma: row.lemma || row.word,
      pos: row.pos || "unknown",
      formType: row.form_type || "base",
      senseId: row.sense_id || "1",
      meaningJa: row.meaning_ja,
      eikenLevel: row.eiken_level || null,
      eikenLevels: String(row.eiken_levels || "").split(";").filter(Boolean),
      level: row.level,
      importance: Number(row.importance || 1),
      entryKind: row.entry_kind || "word",
      source: row.source || "legacy",
      category: row.category || null,
    }));
}

function loadLegacyManualForms(): CsvRow[] {
  const rows = readCsv(
    path.join(process.cwd(), "data", "parari_english_dictionary_master_v0.csv"),
  );

  return rows.filter((row) => {
    const action = String(row.action ?? "").trim();
    const formType = String(row.form_type ?? "").trim();

    return (
      (action === "add" || action === "add_pos_variant") &&
      formType &&
      formType !== "base" &&
      Boolean(String(row.word ?? "").trim()) &&
      Boolean(String(row.lemma ?? "").trim())
    );
  });
}

function isVowel(char: string): boolean {
  return /^[aeiou]$/i.test(char);
}

function isConsonant(char: string): boolean {
  return /^[bcdfghjklmnpqrstvwxyz]$/i.test(char);
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

const DOUBLE_FINAL_CONSONANT_ADJECTIVES = new Set([
  "big",
  "hot",
  "thin",
  "fat",
  "sad",
  "red",
  "wet",
]);

const AUTO_DEGREE_ADVERBS = new Set([
  "fast",
  "hard",
  "early",
  "late",
  "near",
  "soon",
]);

function makeRegularPlural(word: string): string {
  const lower = word.toLowerCase();

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

  if (lower.endsWith("fe")) return `${word.slice(0, -2)}ves`;
  if (lower.endsWith("f")) return `${word.slice(0, -1)}ves`;

  if (lower.endsWith("o")) {
    return O_ENDING_PLURAL_S_NOUNS.has(lower)
      ? `${word}s`
      : `${word}es`;
  }

  return `${word}s`;
}

function makePresentParticiple(word: string): string {
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

function makeThirdPersonSingular(word: string): string {
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

function makeRegularPast(word: string): string {
  const lower = word.toLowerCase();

  if (lower.endsWith("e")) return `${word}d`;

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

function makeComparative(word: string): string {
  const lower = word.toLowerCase();

  if (
    lower.endsWith("y") &&
    word.length >= 2 &&
    isConsonant(word[word.length - 2])
  ) {
    return `${word.slice(0, -1)}ier`;
  }

  if (lower.endsWith("e")) return `${word}r`;

  if (DOUBLE_FINAL_CONSONANT_ADJECTIVES.has(lower)) {
    const last = word[word.length - 1];
    return `${word}${last}er`;
  }

  return `${word}er`;
}

function makeSuperlative(word: string): string {
  const lower = word.toLowerCase();

  if (
    lower.endsWith("y") &&
    word.length >= 2 &&
    isConsonant(word[word.length - 2])
  ) {
    return `${word.slice(0, -1)}iest`;
  }

  if (lower.endsWith("e")) return `${word}st`;

  if (DOUBLE_FINAL_CONSONANT_ADJECTIVES.has(lower)) {
    const last = word[word.length - 1];
    return `${word}${last}est`;
  }

  return `${word}est`;
}

function entryIdentity(
  lemma: string,
  pos: string,
  formType: string,
  senseId: string,
): string {
  return [
    normalize(lemma),
    String(pos || "unknown"),
    String(formType || "base"),
    String(senseId || "1"),
  ].join("|");
}

function cloneAsForm(
  entry: ParariEnglishDictionaryV2ServerEntry,
  word: string,
  formType: string,
  source: string,
): ParariEnglishDictionaryV2ServerEntry {
  return {
    ...entry,
    word,
    lemma: entry.lemma || entry.word,
    formType,
    source,
  };
}

function buildExpandedEntries(): ParariEnglishDictionaryV2ServerEntry[] {
  const formal = loadFormalEntries();
  const byLemma = new Map<string, ParariEnglishDictionaryV2ServerEntry[]>();

  for (const entry of formal) {
    const key = normalize(entry.lemma || entry.word);
    const existing = byLemma.get(key);

    if (existing) existing.push(entry);
    else byLemma.set(key, [entry]);
  }

  const legacyForms = loadLegacyManualForms();
  const inheritedForms: ParariEnglishDictionaryV2ServerEntry[] = [];
  const manualFormIndex = new Set<string>();

  for (const row of legacyForms) {
    const lemma = normalize(row.lemma);
    const candidates = byLemma.get(lemma) ?? [];

    if (candidates.length === 0) continue;

    const pos = String(row.pos || "unknown");
    const formType = String(row.form_type || "variant");
    const senseId = String(row.sense_id || "1");

    const base =
      candidates.find(
        (entry) =>
          entry.pos === pos &&
          entry.formType === "base" &&
          String(entry.senseId || "1") === senseId,
      ) ??
      candidates.find(
        (entry) => entry.pos === pos && entry.formType === "base",
      ) ??
      candidates.find((entry) => entry.formType === "base") ??
      candidates[0];

    inheritedForms.push(
      cloneAsForm(
        base,
        String(row.word || "").trim(),
        formType,
        "legacy_inflection",
      ),
    );

    manualFormIndex.add(
      entryIdentity(base.lemma, base.pos, formType, base.senseId),
    );
  }

  const generated: ParariEnglishDictionaryV2ServerEntry[] = [];

  for (const entry of formal) {
    if (entry.formType !== "base") continue;

    const lower = entry.word.toLowerCase();

    if (
      entry.pos === "noun" &&
      !NO_AUTO_PLURAL_NOUNS.has(lower) &&
      !/^[A-Z]/.test(entry.word)
    ) {
      generated.push(
        cloneAsForm(entry, makeRegularPlural(entry.word), "plural", "generated_inflection"),
      );
    }

    if (entry.pos === "verb") {
      if (
        !manualFormIndex.has(
          entryIdentity(entry.lemma, entry.pos, "third_person_singular", entry.senseId),
        )
      ) {
        generated.push(
          cloneAsForm(
            entry,
            makeThirdPersonSingular(entry.word),
            "third_person_singular",
            "generated_inflection",
          ),
        );
      }

      if (
        !manualFormIndex.has(
          entryIdentity(entry.lemma, entry.pos, "past", entry.senseId),
        )
      ) {
        generated.push(
          cloneAsForm(
            entry,
            makeRegularPast(entry.word),
            "past",
            "generated_inflection",
          ),
        );
      }

      if (
        !manualFormIndex.has(
          entryIdentity(entry.lemma, entry.pos, "past_participle", entry.senseId),
        )
      ) {
        generated.push(
          cloneAsForm(
            entry,
            makeRegularPast(entry.word),
            "past_participle",
            "generated_inflection",
          ),
        );
      }

      generated.push(
        cloneAsForm(
          entry,
          makePresentParticiple(entry.word),
          "present_participle",
          "generated_inflection",
        ),
      );
    }

    if (
      entry.pos === "adjective" &&
      lower.length < 7 &&
      !lower.endsWith("ed") &&
      !lower.endsWith("ing") &&
      !/^[A-Z]/.test(entry.word)
    ) {
      if (
        !manualFormIndex.has(
          entryIdentity(entry.lemma, entry.pos, "comparative", entry.senseId),
        )
      ) {
        generated.push(
          cloneAsForm(
            entry,
            makeComparative(entry.word),
            "comparative",
            "generated_inflection",
          ),
        );
      }

      if (
        !manualFormIndex.has(
          entryIdentity(entry.lemma, entry.pos, "superlative", entry.senseId),
        )
      ) {
        generated.push(
          cloneAsForm(
            entry,
            makeSuperlative(entry.word),
            "superlative",
            "generated_inflection",
          ),
        );
      }
    }

    if (
      entry.pos === "adverb" &&
      AUTO_DEGREE_ADVERBS.has(lower)
    ) {
      if (
        !manualFormIndex.has(
          entryIdentity(entry.lemma, entry.pos, "comparative", entry.senseId),
        )
      ) {
        generated.push(
          cloneAsForm(
            entry,
            makeComparative(entry.word),
            "comparative",
            "generated_inflection",
          ),
        );
      }

      if (
        !manualFormIndex.has(
          entryIdentity(entry.lemma, entry.pos, "superlative", entry.senseId),
        )
      ) {
        generated.push(
          cloneAsForm(
            entry,
            makeSuperlative(entry.word),
            "superlative",
            "generated_inflection",
          ),
        );
      }
    }
  }

  const seen = new Set<string>();
  const result: ParariEnglishDictionaryV2ServerEntry[] = [];

  for (const entry of [...formal, ...inheritedForms, ...generated]) {
    const key = [
      normalize(entry.word),
      normalize(entry.lemma),
      entry.pos,
      entry.formType,
      entry.senseId,
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  return result;
}

const index = new Map<string, ParariEnglishDictionaryV2ServerEntry[]>();

for (const entry of buildExpandedEntries()) {
  const key = normalize(entry.word);
  const existing = index.get(key);

  if (existing) existing.push(entry);
  else index.set(key, [entry]);
}

function pushCandidate(list: string[], value: string) {
  const key = normalize(value);
  if (key && !list.includes(key)) list.push(key);
}

function candidateKeys(surface: string): string[] {
  const key = normalize(surface);
  const candidates: string[] = [];
  pushCandidate(candidates, key);

  if (key.includes(" ")) return candidates;

  if (key.endsWith("ied") && key.length > 4) {
    pushCandidate(candidates, `${key.slice(0, -3)}y`);
  }

  if (key.endsWith("ed") && key.length > 3) {
    pushCandidate(candidates, key.slice(0, -1));
    pushCandidate(candidates, key.slice(0, -2));

    const stem = key.slice(0, -2);
    if (
      stem.length >= 2 &&
      stem[stem.length - 1] === stem[stem.length - 2]
    ) {
      pushCandidate(candidates, stem.slice(0, -1));
    }
  }

  if (key.endsWith("ing") && key.length > 4) {
    const stem = key.slice(0, -3);
    pushCandidate(candidates, stem);
    pushCandidate(candidates, `${stem}e`);

    if (
      stem.length >= 2 &&
      stem[stem.length - 1] === stem[stem.length - 2]
    ) {
      pushCandidate(candidates, stem.slice(0, -1));
    }
  }

  if (key.endsWith("ies") && key.length > 4) {
    pushCandidate(candidates, `${key.slice(0, -3)}y`);
  }

  if (key.endsWith("es") && key.length > 3) {
    pushCandidate(candidates, key.slice(0, -2));
    pushCandidate(candidates, key.slice(0, -1));
  }

  if (key.endsWith("s") && key.length > 2) {
    pushCandidate(candidates, key.slice(0, -1));
  }

  return candidates;
}

function sortEntries(entries: ParariEnglishDictionaryV2ServerEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.importance !== b.importance) return a.importance - b.importance;
    if (a.formType === "base" && b.formType !== "base") return -1;
    if (b.formType === "base" && a.formType !== "base") return 1;
    return Number(a.senseId || "1") - Number(b.senseId || "1");
  });
}

export function lookupParariEnglishDictionaryV2(surface: string) {
  const candidates = candidateKeys(surface);

  for (const candidate of candidates) {
    const entries = index.get(candidate);
    if (!entries || entries.length === 0) continue;

    return {
      query: surface,
      matched: candidate,
      entries: sortEntries(entries),
    };
  }

  return {
    query: surface,
    matched: null,
    entries: [] as ParariEnglishDictionaryV2ServerEntry[],
  };
}
