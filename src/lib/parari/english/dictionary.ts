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

// 2026-10-07 JST — One meaning for dictionary marks in editor and reader.
// A missing response (loading, failure or batch limit) is not an unregistered word.
export function dictionaryStatus(result: DictionaryResult | undefined): "known" | "missing" | "unchecked" {
  if (result?.found && result.best) return "known";
  if (result?.found === false && result.best === null) return "missing";
  return "unchecked";
}

export const DICTIONARY_MARK_CLASSES = {
  known: "underline decoration-dotted decoration-neutral-400",
  missing: "bg-red-200 hover:bg-red-300",
} as const;

export const DICTIONARY_MISSING_BACKGROUND = "#fecaca";
