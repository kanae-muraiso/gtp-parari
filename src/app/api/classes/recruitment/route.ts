import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern, classMeetingUrl } from "@/lib/classes";

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
      db.from("class_schools").select("id,name").eq("owner_user_id", user.id).eq("tier", "a").maybeSingle(),
    ]);
    if (profile.error || school.error) throw profile.error ?? school.error;
    if (profile.data?.is_monitor !== true || !school.data) return fail("教室が見つかりません。", 404);
    const id = school.data.id;

    if (request.method === "GET") {
      const [recruitment, slots] = await Promise.all([
        db.from("school_recruitment").select("public_id,enabled,information,kind,route,application_text,payment_mode,payment_url,arrival_text,confirmation_text").eq("school_id", id).maybeSingle(),
        db.from("school_recruitment_slots").select("id,starts_at,capacity,closed,meeting_url,location,duration_minutes").eq("school_id", id).order("starts_at", { ascending: true }),
      ]);
      if (recruitment.error || slots.error) throw recruitment.error ?? slots.error;
      return reply({ ok: true, school: school.data.name, recruitment: recruitment.data, slots: slots.data });
    }

    const input = await request.json().catch(() => null);
    if (input?.action === "settings") {
      const information = typeof input.information === "string" ? input.information.trim() : "";
      if (!information || information.length > 4000 || !["説明会", "体験", "見学"].includes(input.kind)) return fail("受付の種類と、個人情報の取り扱いを含む案内を入力してください。");
      const text = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
      const route = input.route ?? "briefing";
      const payment = input.paymentMode ?? "free";
      const paymentUrl = payment === "advance" ? classMeetingUrl(input.paymentUrl) : null;
      if (!["briefing", "direct"].includes(route) || !["free", "advance", "onsite"].includes(payment) ||
          (payment === "advance" && !paymentUrl) || (payment === "onsite" && !text("arrivalText")) ||
          ["applicationText", "arrivalText", "confirmationText"].some(key => text(key).length > 4000)) {
        return fail("支払いURL、集合案内、申込書の設定をご確認ください。");
      }
      const result = await db.from("school_recruitment").upsert({ school_id: id, information, kind: input.kind, route,
        application_text: text("applicationText"), payment_mode: payment, payment_url: paymentUrl,
        arrival_text: text("arrivalText"), confirmation_text: text("confirmationText") });
      if (result.error) throw result.error;
    } else if (input?.action === "publish" || input?.action === "unpublish") {
      const draft = await db.from("school_recruitment").select("route").eq("school_id", id).maybeSingle();
      if (draft.error) throw draft.error;
      if (!draft.data) return fail("先に募集設定を保存してください。");
      if (input.action === "publish" && draft.data.route === "briefing") {
        const slots = await db.from("school_recruitment_slots").select("id").eq("school_id", id)
          .eq("closed", false).gt("starts_at", new Date().toISOString()).limit(1);
        if (slots.error) throw slots.error;
        if (!slots.data?.length) return fail("公開前に、受付中の予約枠を追加してください。");
      }
      const result = await db.from("school_recruitment").update({ enabled: input.action === "publish" })
        .eq("school_id", id).select("public_id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return fail("先に募集設定を保存してください。");
    } else if (input?.action === "slot") {
      if (typeof input.id !== "string" || !classIdPattern.test(input.id) || typeof input.startsAt !== "string" ||
        !Number.isFinite(Date.parse(input.startsAt)) || Date.parse(input.startsAt) <= Date.now() ||
        !Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 100) return fail("日時と定員を確認してください。");
      const duration = input.duration ?? 60;
      const location = typeof input.location === "string" ? input.location.trim() : "";
      if (!Number.isInteger(duration) || duration < 5 || duration > 480 || location.length > 300) return fail("会場と所要時間を確認してください。");
      const meeting = classMeetingUrl(input.meetingUrl);
      if (input.meetingUrl && !meeting) return fail("HTTPSの参加リンクを入力してください。");
      const result = await db.from("school_recruitment_slots").upsert({
        school_id: id, id: input.id, starts_at: input.startsAt, capacity: input.capacity, meeting_url: meeting, location: location || null, duration_minutes: duration,
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
