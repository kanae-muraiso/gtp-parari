import { NextResponse } from "next/server";
import { lookupParariEnglishDictionaryV2 } from "@/lib/parari/english/serverDictionaryV2";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") ?? "").trim();

  if (!query) {
    return NextResponse.json(
      { found: false, error: "q is required" },
      { status: 400 },
    );
  }

  const result = lookupParariEnglishDictionaryV2(query);
  const best = result.entries[0] ?? null;

  return NextResponse.json({
    found: Boolean(best),
    query,
    matched: result.matched,
    best,
    entries: result.entries,
  });
}


export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { words?: unknown }
    | null;

  const inputWords = Array.isArray(body?.words)
    ? body.words
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 500)
    : [];

  const uniqueWords = Array.from(
    new Set(inputWords.map((word) => word.toLowerCase())),
  );

  const results: Record<
    string,
    {
      found: boolean;
      matched: string | null;
      best: ReturnType<typeof lookupParariEnglishDictionaryV2>["entries"][number] | null;
    }
  > = {};

  for (const word of uniqueWords) {
    const lookup = lookupParariEnglishDictionaryV2(word);
    results[word] = {
      found: lookup.entries.length > 0,
      matched: lookup.matched,
      best: lookup.entries[0] ?? null,
    };
  }

  return NextResponse.json({
    count: uniqueWords.length,
    results,
  });
}
