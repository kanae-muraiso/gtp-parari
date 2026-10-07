import "server-only";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

type DictionaryRow = {
  word: string;
  lemma: string;
  pos: string;
  form_type: string;
  sense_id: string;
  meaning_ja: string;
  eiken_level: string | null;
  eiken_levels: string[] | null;
  entry_kind: string;
  importance: number;
};

function normalize(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/[’‘`]/g, "'")
    .toLowerCase();
}

function toEntry(row: DictionaryRow) {
  return {
    word: row.word,
    lemma: row.lemma,
    pos: row.pos,
    formType: row.form_type,
    senseId: row.sense_id,
    meaningJa: row.meaning_ja,
    eikenLevel: row.eiken_level,
    eikenLevels: row.eiken_levels ?? [],
    entryKind: row.entry_kind,
    importance: row.importance,
  };
}

function sortRows(rows: DictionaryRow[]): DictionaryRow[] {
  return [...rows].sort((a, b) => {
    if (a.importance !== b.importance) return a.importance - b.importance;
    if (a.form_type === "base" && b.form_type !== "base") return -1;
    if (b.form_type === "base" && a.form_type !== "base") return 1;
    return Number(a.sense_id || "1") - Number(b.sense_id || "1");
  });
}

export async function lookupWord(query: string) {
  const normalized = normalize(query);

  if (!normalized) {
    return { matched: null, entries: [] as ReturnType<typeof toEntry>[] };
  }

  const { data, error } = await supabaseAdmin
    .from("parari_english_dictionary")
    .select(
      "word,lemma,pos,form_type,sense_id,meaning_ja,eiken_level,eiken_levels,entry_kind,importance",
    )
    .eq("normalized_word", normalized)
    .eq("active", true);

  if (error || !data) {
    return { matched: null, entries: [] as ReturnType<typeof toEntry>[] };
  }

  const rows = sortRows(data as DictionaryRow[]);

  return {
    matched: rows.length > 0 ? normalized : null,
    entries: rows.map(toEntry),
  };
}

export async function lookupDictionaryBatch(words: unknown) {
  const inputWords = Array.isArray(words)
    ? words
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalize(value))
        .filter(Boolean)
        .slice(0, 500)
    : [];

  const uniqueWords = Array.from(new Set(inputWords));

  if (uniqueWords.length === 0) {
    return { count: 0, results: {} };
  }

  const { data, error } = await supabaseAdmin
    .from("parari_english_dictionary")
    .select(
      "word,normalized_word,lemma,pos,form_type,sense_id,meaning_ja,eiken_level,eiken_levels,entry_kind,importance",
    )
    .in("normalized_word", uniqueWords)
    .eq("active", true);

  if (error) {
    throw new Error("dictionary lookup failed");
  }

  const grouped = new Map<string, DictionaryRow[]>();

  for (const raw of data ?? []) {
    const row = raw as DictionaryRow & { normalized_word: string };
    const key = row.normalized_word;
    const current = grouped.get(key);
    if (current) current.push(row);
    else grouped.set(key, [row]);
  }

  const results: Record<
    string,
    {
      found: boolean;
      matched: string | null;
      best: ReturnType<typeof toEntry> | null;
    }
  > = {};

  for (const word of uniqueWords) {
    const rows = sortRows(grouped.get(word) ?? []);
    const best = rows[0] ? toEntry(rows[0]) : null;

    results[word] = {
      found: Boolean(best),
      matched: best ? word : null,
      best,
    };
  }

  return { count: uniqueWords.length, results };
}
