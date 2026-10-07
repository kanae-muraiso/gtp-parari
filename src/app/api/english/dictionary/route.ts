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
