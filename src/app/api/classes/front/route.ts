import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classBusinessId } from "@/lib/classBusinessScope";
import { parseClassBusinessFront } from "@/lib/classBusinessFront";
import { classBusinessFrontLinks, readClassBusinessFront } from "@/lib/classBusinessFrontServer";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers });
const fail = (message: string, status = 400) => reply({ ok: false, message }, status);

async function authorize(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("business");
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return fail("ログインが必要です。", 401);
  const session = await db.auth.getUser(token);
  const user = session.data.user?.id;
  if (session.error || !user) return fail("ログインが必要です。", 401);
  const profile = await db.from("profiles").select("is_monitor").eq("user_id", user).maybeSingle();
  if (profile.error) throw profile.error;
  const school = scope && profile.data?.is_monitor ? await classBusinessId(user, scope) : null;
  return school ? { school, user } : fail("事業が見つかりません。", 404);
}

export async function GET(request: NextRequest) {
  try {
    const owner = await authorize(request);
    if (owner instanceof Response) return owner;
    const [front, links] = await Promise.all([readClassBusinessFront(owner.school), classBusinessFrontLinks(owner.school, owner.user)]);
    return reply({ ok: true, front, links });
  } catch (error) {
    console.error("[class front] load failed", error);
    return fail("フロントページの設定を取得できませんでした。", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await authorize(request);
    if (owner instanceof Response) return owner;
    const body = await request.json().catch(() => null);
    if (!["saveFront", "publishFront", "unpublishFront"].includes(body?.action) ||
      !Number.isInteger(body.revision) || body.revision < 0) return fail("フロントページの設定を確認してください。");
    const front = await readClassBusinessFront(owner.school);
    const conflict = () => fail("別の画面でフロントページが更新されました。再読み込みしてから保存してください。", 409);
    if (front.revision !== body.revision) return conflict();
    let draft = front.draft;
    let published = front.published;
    if (body.action === "unpublishFront") {
      if (!published) return reply({ ok: true, front });
      published = null;
    } else {
      const content = parseClassBusinessFront(body.content);
      if (!content) return fail("紹介文と掲載項目を確認してください。");
      const links = await classBusinessFrontLinks(owner.school, owner.user);
      const allowed = new Set([...front.draft.entries, ...links.map(link => link.key)]);
      if (content.entries.some(key => !allowed.has(key))) return fail("掲載先が変わりました。再読み込みしてから保存してください。", 409);
      draft = content;
      if (body.action === "publishFront") published = content;
    }
    const changes = { draft, published, revision: front.revision + 1 };
    const table = db.from("class_business_fronts");
    const result = front.revision === 0
      ? await table.insert({ school_id: owner.school, ...changes }).select("revision").maybeSingle()
      : await table.update(changes).eq("school_id", owner.school).eq("revision", front.revision).select("revision").maybeSingle();
    if (result.error?.code === "23505") return conflict();
    if (result.error) throw result.error;
    if (!result.data) return conflict();
    return reply({ ok: true, front: changes });
  } catch (error) {
    console.error("[class front] save failed", error);
    return fail("フロントページを保存できませんでした。", 500);
  }
}
