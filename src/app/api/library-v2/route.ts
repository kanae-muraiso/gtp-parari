import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Action = "follow" | "star" | "reading" | "category" | "category_item" | "directory" | "introduction";
const tables = {
  follow: "parari_author_follows",
  star: "parari_work_stars",
  reading: "parari_reading_states",
  category: "parari_library_categories",
  category_item: "parari_library_category_items",
} as const;
function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status, headers });
}
async function session(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase public configuration is missing");
  // Every DB operation runs as the caller under RLS; no service-role bypass.
  const authClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await authClient.auth.getUser(token);
  const db = createClient(url, key, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return error || !user ? null : { db, user };
}
function actionOf(value: unknown): value is Action {
  return typeof value === "string" && ["follow","star","reading","category","category_item","directory","introduction"].includes(value);
}
async function apply(request: NextRequest, method: "POST" | "DELETE") {
  try {
    const actor = await session(request);
    if (!actor) return fail("ログインが必要です。", 401);
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("入力が不正です。");
    const input = body as Record<string, unknown>;
    const action = input.action;
    if (!actionOf(action)) return fail("操作が不正です。");
    const { db, user } = actor;
    let result: { error: { message: string; code?: string } | null } | null = null;
    if (action === "follow") {
      if (typeof input.authorId !== "string" || !uuid.test(input.authorId) || input.authorId === user.id) return fail("作者を確認してください。");
      if (method === "POST") {
        const author = await db.from("profiles").select("user_id").eq("user_id", input.authorId).not("username", "is", null).maybeSingle();
        if (author.error || !author.data) return fail("作者が見つかりません。", 404);
        result = await db.from(tables.follow).upsert({ follower_user_id: user.id, author_user_id: input.authorId }, { onConflict: "follower_user_id,author_user_id", ignoreDuplicates: true });
      } else result = await db.from(tables.follow).delete().eq("follower_user_id", user.id).eq("author_user_id", input.authorId);
    } else if (action === "star" || action === "reading") {
      if (typeof input.workId !== "string" || !uuid.test(input.workId)) return fail("作品を確認してください。");
      const table = action === "star" ? tables.star : tables.reading;
      if (method === "DELETE") result = await db.from(table).delete().eq("user_id", user.id).eq("work_id", input.workId);
      else {
        if (action === "reading" && !["to_read", "reading", "read"].includes(String(input.state))) return fail("読書状態が不正です。");
        if (action === "star") {
          result = await db.from(tables.star).upsert({ user_id: user.id, work_id: input.workId }, { onConflict: "user_id,work_id" });
        } else {
          result = await db.from(tables.reading).upsert({ user_id: user.id, work_id: input.workId, state: input.state as "to_read" | "reading" | "read", updated_at: new Date().toISOString() }, { onConflict: "user_id,work_id" });
        }
      }
    } else if (action === "category") {
      if (method === "POST") {
        if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80) return fail("カテゴリー名は1〜80文字です。");
        result = await db.from(tables.category).insert({ user_id: user.id, name: input.name.trim() });
      } else {
        if (typeof input.categoryId !== "string" || !uuid.test(input.categoryId)) return fail("カテゴリーを確認してください。");
        result = await db.from(tables.category).delete().eq("id", input.categoryId).eq("user_id", user.id);
      }
    } else if (action === "category_item") {
      if (typeof input.categoryId !== "string" || !uuid.test(input.categoryId) || typeof input.targetId !== "string" || !uuid.test(input.targetId) || !["author","work"].includes(String(input.targetKind))) return fail("分類対象が不正です。");
      if (method === "POST") result = await db.from(tables.category_item).insert({ category_id: input.categoryId, user_id: user.id, target_kind: input.targetKind, target_id: input.targetId });
      else result = await db.from(tables.category_item).delete().eq("category_id", input.categoryId).eq("user_id", user.id).eq("target_kind", input.targetKind).eq("target_id", input.targetId);
    } else if (action === "directory") {
      if (method !== "POST" || typeof input.enabled !== "boolean") return fail("掲載設定が不正です。");
      result = await db.from("profiles").update({ author_directory_opt_in: input.enabled }).eq("user_id", user.id);
    } else if (action === "introduction") {
      if (method !== "POST" || (input.workId !== null && (typeof input.workId !== "string" || !uuid.test(input.workId)))) return fail("自己紹介作品が不正です。");
      if (input.workId) {
        const work = await db.from("parari_books").select("id").eq("id", input.workId).eq("owner", user.id).eq("visibility", "public").eq("is_deleted", false).maybeSingle();
        if (work.error || !work.data) return fail("公開済みの自分の作品を指定してください。");
      }
      result = await db.from("profiles").update({ introduction_work_id: input.workId }).eq("user_id", user.id);
    }
    if (result?.error) {
      if (result.error.code === "23505") return fail("すでに登録されています。", 409);
      if (result.error.code === "23503" || result.error.code === "23514" || result.error.code === "42501") return fail("対象または権限を確認してください。", 403);
      console.error("[library-v2] mutation failed", result.error.code);
      return fail("保存できませんでした。", 500);
    }
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    console.error("[library-v2] request failed", error);
    return fail("処理できませんでした。", 500);
  }
}
export async function POST(request: NextRequest) { return apply(request, "POST"); }
export async function DELETE(request: NextRequest) { return apply(request, "DELETE"); }
export async function GET(request: NextRequest) {
  try {
    const actor = await session(request);
    if (!actor) return fail("ログインが必要です。", 401);
    const { db, user } = actor;
    const [follows, stars, reading, categories, items, profile] = await Promise.all([
      db.from(tables.follow).select("author_user_id,created_at").eq("follower_user_id", user.id),
      db.from(tables.star).select("work_id,created_at").eq("user_id", user.id),
      db.from(tables.reading).select("work_id,state,updated_at").eq("user_id", user.id),
      db.from(tables.category).select("id,name,sort_order").eq("user_id", user.id).order("sort_order"),
      db.from(tables.category_item).select("category_id,target_kind,target_id").eq("user_id", user.id),
      db.from("profiles").select("author_directory_opt_in,introduction_work_id").eq("user_id", user.id).maybeSingle(),
    ]);
    const errors = [follows, stars, reading, categories, items, profile].filter(x => x.error);
    if (errors.length) { console.error("[library-v2] load failed", errors.map(x => x.error?.code)); return fail("書棚を読み込めませんでした。", 500); }
    return NextResponse.json({ ok: true, follows: follows.data, stars: stars.data, reading: reading.data, categories: categories.data, categoryItems: items.data, settings: profile.data }, { headers });
  } catch (error) {
    console.error("[library-v2] load exception", error);
    return fail("書棚を読み込めませんでした。", 500);
  }
}
