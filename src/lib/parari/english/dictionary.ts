// 2026-10-07 JST — Shared dictionary response types; no author content is stored here.
export type DictionaryEntry = {
  word: string;
  lemma: string;
  pos: string;
  formType: string;
  senseId: string;
  meaningJa: string;
  eikenLevel: string | null;
  eikenLevels: string[];
  entryKind: string;
};

export type DictionaryResult = {
  found: boolean;
  matched: string | null;
  best: DictionaryEntry | null;
};

export type DictionaryResults = Record<string, DictionaryResult>;
export type DictionaryLookup = (words: string[], signal?: AbortSignal) => Promise<DictionaryResults>;

export function normalizeEnglishWord(word: string): string {
  return word.trim().replace(/[’‘`]/g, "'").toLowerCase();
}

export const ENGLISH_AUTHORING_PREFERENCE = "english_authoring_enabled";
