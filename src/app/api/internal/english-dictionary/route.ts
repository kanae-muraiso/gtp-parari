import { NextRequest, NextResponse } from "next/server";
import { authenticateInternalAdmin } from "@/lib/auth/internalAdmin";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE_FIELDS = [
  "word",
  "lemma",
  "pos",
  "form_type",
  "sense_id",
  "meaning_ja",
  "eiken_level",
  "eiken_levels",
  "parari_level",
  "importance",
  "entry_kind",
  "source",
  "category",
  "note",
  "note2",
  "active",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

function cleanPatch(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  for (const key of EDITABLE_FIELDS) {
    if (key in source) patch[key] = source[key];
  }

  if ("eiken_level" in patch) {
    const value = String(patch.eiken_level ?? "").trim();
    patch.eiken_level = value || null;
  }

  if ("eiken_levels" in patch) {
    patch.eiken_levels = Array.isArray(patch.eiken_levels)
      ? patch.eiken_levels.map((value) => String(value).trim()).filter(Boolean)
      : [];
  }

  if ("importance" in patch) {
    patch.importance = Math.min(3, Math.max(1, Number(patch.importance || 1)));
  }

  return patch;
}

async function recordHistory(args: {
  entryId: number | null;
  action: "create" | "update" | "delete" | "import";
  beforeValue: unknown;
  afterValue: unknown;
  userId: string;
}) {
  await supabaseAdmin.from("parari_english_dictionary_history").insert({
    dictionary_entry_id: args.entryId,
    action: args.action,
    before_value: args.beforeValue,
    after_value: args.afterValue,
    changed_by: args.userId,
  });
}

export async function GET(request: NextRequest) {
  const auth = await authenticateInternalAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(20, Number(url.searchParams.get("limit") || 50)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let builder = supabaseAdmin
    .from("parari_english_dictionary")
    .select("*", { count: "exact" })
    .order("normalized_word", { ascending: true })
    .order("lemma", { ascending: true })
    .range(from, to);

  if (query) {
    const escaped = query.replace(/[%_]/g, "\\$&");
    builder = builder.or(
      `word.ilike.%${escaped}%,lemma.ilike.%${escaped}%,meaning_ja.ilike.%${escaped}%`,
    );
  }

  const { data, count, error } = await builder;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: data ?? [],
    count: count ?? 0,
    page,
    limit,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateInternalAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | { entry?: unknown }
    | null;
  const entry = cleanPatch(body?.entry);

  if (!String(entry.word ?? "").trim() || !String(entry.lemma ?? "").trim()) {
    return NextResponse.json(
      { error: "word と lemma は必須です。" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("parari_english_dictionary")
    .insert({ ...entry, updated_by: auth.userId })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "追加できませんでした。" },
      { status: 500 },
    );
  }

  await recordHistory({
    entryId: Number(data.id),
    action: "create",
    beforeValue: null,
    afterValue: data,
    userId: auth.userId,
  });

  return NextResponse.json({ row: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateInternalAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; patch?: unknown }
    | null;
  const id = Number(body?.id);
  const patch = cleanPatch(body?.patch);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id が不正です。" }, { status: 400 });
  }

  const { data: before, error: beforeError } = await supabaseAdmin
    .from("parari_english_dictionary")
    .select("*")
    .eq("id", id)
    .single();

  if (beforeError || !before) {
    return NextResponse.json({ error: "辞書項目が見つかりません。" }, { status: 404 });
  }

  const { data: after, error } = await supabaseAdmin
    .from("parari_english_dictionary")
    .update({ ...patch, updated_by: auth.userId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !after) {
    return NextResponse.json(
      { error: error?.message || "更新できませんでした。" },
      { status: 500 },
    );
  }

  await recordHistory({
    entryId: id,
    action: "update",
    beforeValue: before,
    afterValue: after,
    userId: auth.userId,
  });

  return NextResponse.json({ row: after });
}
