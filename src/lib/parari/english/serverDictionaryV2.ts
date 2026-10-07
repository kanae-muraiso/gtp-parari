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

function loadEntries(): ParariEnglishDictionaryV2ServerEntry[] {
  const filePath = path.join(
    process.cwd(),
    "data",
    "parari_english_dictionary_master_v2.csv",
  );

  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = String(values[index] ?? "").trim();
    });

    return {
      word: row.word,
      lemma: row.lemma,
      pos: row.pos,
      formType: row.form_type,
      senseId: row.sense_id,
      meaningJa: row.meaning_ja,
      eikenLevel: row.eiken_level || null,
      eikenLevels: String(row.eiken_levels || "").split(";").filter(Boolean),
      level: row.level,
      importance: Number(row.importance || 1),
      entryKind: row.entry_kind || "word",
      source: row.source || "legacy",
      category: row.category || null,
    };
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

const index = new Map<string, ParariEnglishDictionaryV2ServerEntry[]>();

for (const entry of loadEntries()) {
  const key = normalize(entry.word);
  const existing = index.get(key);

  if (existing) {
    existing.push(entry);
  } else {
    index.set(key, [entry]);
  }
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
