// 2026-10-07 JST — Editor-only access. Public reader dictionary remains independent.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/billing/supabaseAdmin";
import { getUserPlanAccess } from "@/lib/billing/access";
import { ENGLISH_AUTHORING_PREFERENCE } from "@/lib/parari/english/dictionary";
import { lookupDictionaryBatch } from "@/lib/parari/english/dictionaryServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function access(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  // User-editable metadata is a preference only, never a billing entitlement.
  const { entitlements } = await getUserPlanAccess(user.id);
  const allowed = entitlements.canUseEnglishAuthoring;
  return { allowed, enabled: allowed && user.user_metadata?.[ENGLISH_AUTHORING_PREFERENCE] === true };
}

export async function GET(request: Request) {
  try {
    const state = await access(request);
    return state ? json(state) : json({ error: "ログインしてください。" }, 401);
  } catch {
    return json({ error: "英語教材支援の利用設定を確認できませんでした。" }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const state = await access(request);
    if (!state) return json({ error: "ログインしてください。" }, 401);
    if (!state.allowed) return json({ error: "英語教材支援はPlus以上で利用できます。" }, 403);
    if (!state.enabled) return json({ error: "設定で英語教材支援を有効にしてください。" }, 403);
    const body = await request.json().catch(() => null);
    if (!Array.isArray(body?.words)) return json({ error: "英単語を指定してください。" }, 400);
    return json(await lookupDictionaryBatch(body.words));
  } catch {
    return json({ error: "辞書を取得できませんでした。時間をおいて再度お試しください。" }, 503);
  }
}
