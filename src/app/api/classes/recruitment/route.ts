import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
const fail = (message: string, status = 400) => reply({ ok: false, message }, status);

async function handle(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return fail("ログインしてください。", 401);
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return fail("ログインしてください。", 401);
    const [profile, school] = await Promise.all([
      db.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle(),
      db.from("class_schools").select("id").eq("owner_user_id", user.id).eq("tier", "a").maybeSingle(),
    ]);
    if (profile.error || school.error) throw profile.error ?? school.error;
    if (profile.data?.is_monitor !== true || !school.data) return fail("教室が見つかりません。", 404);
    const id = school.data.id;

    if (request.method === "GET") {
      const [recruitment, slots] = await Promise.all([
        db.from("school_recruitment").select("public_id,enabled,information,kind").eq("school_id", id).maybeSingle(),
        db.from("school_recruitment_slots").select("id,starts_at,capacity,closed").eq("school_id", id).order("starts_at", { ascending: true }),
      ]);
      if (recruitment.error || slots.error) throw recruitment.error ?? slots.error;
      return reply({ ok: true, recruitment: recruitment.data, slots: slots.data });
    }

    const input = await request.json().catch(() => null);
    if (input?.action === "settings") {
      const information = typeof input.information === "string" ? input.information.trim() : "";
      if (!information || information.length > 4000 || !["説明会", "体験", "見学"].includes(input.kind)) return fail("受付の種類と、個人情報の取り扱いを含む案内を入力してください。");
      const result = await db.from("school_recruitment").upsert({ school_id: id, information, kind: input.kind, enabled: input.enabled === true });
      if (result.error) throw result.error;
    } else if (input?.action === "slot") {
      if (typeof input.id !== "string" || !classIdPattern.test(input.id) || typeof input.startsAt !== "string" ||
        !Number.isFinite(Date.parse(input.startsAt)) || Date.parse(input.startsAt) <= Date.now() ||
        !Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 100) return fail("日時と定員を確認してください。");
      const result = await db.from("school_recruitment_slots").upsert({
        school_id: id, id: input.id, starts_at: input.startsAt, capacity: input.capacity,
      }, { onConflict: "id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    } else if (input?.action === "close" && typeof input.id === "string" && classIdPattern.test(input.id)) {
      const result = await db.from("school_recruitment_slots").update({ closed: true }).eq("id", input.id).eq("school_id", id);
      if (result.error) throw result.error;
    } else return fail("操作を確認してください。");
    return reply({ ok: true });
  } catch {
    return fail("募集設定を処理できませんでした。", 500);
  }
}

export const GET = handle;
export const POST = handle;
