import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";
import { classBusinessId } from "@/lib/classBusinessScope";
import { eligibleClassHomePage } from "@/lib/classHomePage";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const send = (body: object, status = 200) => NextResponse.json(body, { status, headers });
const error = (message: string, status = 400) => send({ ok: false, message }, status);
type DraftRow = {
  school_id: string; owner_user_id: string; wizard: Record<string, unknown>;
  sales_answers: string[]; landing_page_id: string | null; revision: number;
};

async function authorize(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return null;
  const { data, error: authError } = await db.auth.getUser(bearer);
  if (authError || !data.user) return null;
  const school = request.nextUrl.searchParams.get("school");
  if (!school || !classIdPattern.test(school)) return null;
  const owned = await classBusinessId(data.user.id, school);
  if (!owned) return null;
  return { userId: data.user.id, schoolId: owned };
}
const validWizard = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const json = JSON.stringify(value);
  return json.length <= 20000 && Object.keys(value).length <= 55 &&
    Object.values(value).every(item => typeof item === "string" || typeof item === "boolean" ||
      typeof item === "number" || item === null);
};
const validAnswers = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length === 16 &&
  value.every(item => typeof item === "string" && item.length <= 5000);

export async function GET(request: NextRequest) {
  try {
    const actor = await authorize(request);
    if (!actor) return error("事業が見つかりません。ログインと所有権をご確認ください。", 404);
    const [draft, school, courses, classes, pages, recruitment, front] = await Promise.all([
      db.from("class_onboarding_drafts").select("wizard,sales_answers,landing_page_id,revision")
        .eq("school_id", actor.schoolId).maybeSingle(),
      db.from("class_schools").select("id,name").eq("id", actor.schoolId).single(),
      db.from("school_class_products").select("id,name,design").eq("school_id", actor.schoolId).order("name"),
      db.from("school_classes").select("id,name,product_id,starts_at,duration_minutes").eq("school_id", actor.schoolId).order("name"),
      db.from("parari_books").select("id,title,is_public,visibility,content").eq("owner", actor.userId)
        .or("is_deleted.is.null,is_deleted.eq.false").order("updated_at", { ascending: false }).limit(100),
      db.from("school_recruitment").select("enabled,public_id,route").eq("school_id", actor.schoolId).maybeSingle(),
      db.from("class_business_fronts").select("published").eq("school_id", actor.schoolId).maybeSingle(),
    ]);
    for (const result of [draft, school, courses, classes, pages, recruitment, front]) if (result.error) throw result.error;
    return send({ ok: true, school: school.data, courses: courses.data, classes: classes.data,
      pages: (pages.data ?? []).filter(page => eligibleClassHomePage(page.content, actor.schoolId))
        .map(({ id,title,is_public,visibility }) => ({ id,title,is_public,visibility })),
      recruitment: recruitment.data, published: Boolean(front.data?.published),
      draft: draft.data ?? { wizard: {}, sales_answers: Array(16).fill(""), landing_page_id: null, revision: 0 } });
  } catch (cause) {
    console.error("[class onboarding] load failed", cause);
    return error("設計データを取得できませんでした。", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await authorize(request);
    if (!actor) return error("事業が見つかりません。", 404);
    const body = await request.json().catch(() => null) as {
      revision?: unknown; action?: unknown; wizard?: unknown;
      answers?: unknown; pageId?: unknown;
    } | null;
    if (!body || !Number.isInteger(body.revision) || (body.revision as number) < 0 ||
      !["saveWizard","saveSales","bindPage"].includes(String(body.action))) {
      return error("保存内容を確認してください。");
    }
    const revision = body.revision as number;
    const current = await db.from("class_onboarding_drafts").select("*").eq("school_id", actor.schoolId).maybeSingle();
    if (current.error) throw current.error;
    if ((current.data?.revision ?? 0) !== revision) return error("別の画面で更新されています。再読み込みしてください。", 409);
    const changes: Partial<DraftRow> = {};
    if (body.action === "saveWizard") {
      if (!validWizard(body.wizard)) return error("設計の回答を確認してください。");
      changes.wizard = body.wizard;
    } else if (body.action === "saveSales") {
      if (!validAnswers(body.answers)) return error("16の回答を確認してください。");
      changes.sales_answers = body.answers;
    } else {
      if (body.pageId !== null && (typeof body.pageId !== "string" || !classIdPattern.test(body.pageId))) return error("PAGEを確認してください。");
      if (body.pageId) {
        const work = await db.from("parari_books").select("id,content").eq("id", body.pageId)
          .eq("owner", actor.userId).or("is_deleted.is.null,is_deleted.eq.false").maybeSingle();
        if (work.error) throw work.error;
        if (!work.data || !eligibleClassHomePage(work.data.content, actor.schoolId))
          return error("この事業のCLASSトップ専用PAGEではありません。通常の作品は関連付けできません。", 403);
      }
      changes.landing_page_id = body.pageId as string | null;
    }
    if (!current.data) {
      if (revision !== 0) return error("別の画面で更新されています。", 409);
      const inserted = await db.from("class_onboarding_drafts")
        .insert({ school_id: actor.schoolId, owner_user_id: actor.userId, ...changes })
        .select("revision").single();
      if (inserted.error?.code === "23505") return error("別の画面で更新されています。", 409);
      if (inserted.error) throw inserted.error;
      return send({ ok: true, revision: inserted.data.revision });
    }
    const updated = await db.from("class_onboarding_drafts")
      .update({ ...changes, revision: revision + 1, updated_at: new Date().toISOString() })
      .eq("school_id", actor.schoolId).eq("owner_user_id", actor.userId).eq("revision", revision)
      .select("revision").maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) return error("別の画面で更新されています。再読み込みしてください。", 409);
    return send({ ok: true, revision: updated.data.revision });
  } catch (cause) {
    console.error("[class onboarding] save failed", cause);
    return error("設計を保存できませんでした。", 500);
  }
}
