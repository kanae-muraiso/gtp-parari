import "server-only";

import {
  PARARI_ENGLISH_DICTIONARY_V2_SERVER_ENTRIES,
  type ParariEnglishDictionaryV2ServerEntry,
} from "./parariEnglishDictionaryV2.server.generated";

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

for (const entry of PARARI_ENGLISH_DICTIONARY_V2_SERVER_ENTRIES) {
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
