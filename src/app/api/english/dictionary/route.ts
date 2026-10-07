import { NextResponse } from "next/server";
import { lookupWord, lookupDictionaryBatch } from "@/lib/parari/english/dictionaryServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") ?? "").trim();

  if (!query) {
    return NextResponse.json(
      { found: false, error: "q is required" },
      { status: 400 },
    );
  }

  const result = await lookupWord(query);
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
  const body = await request.json().catch(() => null);
  try {
    return NextResponse.json(await lookupDictionaryBatch(body?.words));
  } catch {
    return NextResponse.json({ error: "dictionary lookup failed" }, { status: 500 });
  }
}
