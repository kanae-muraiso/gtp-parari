import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern, nextLessonDate, type ClassSchool } from "@/lib/classes";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const send = (body: object, status = 200) => NextResponse.json(body, { status, headers });
const fail = (message: string, status = 400) => send({ ok: false, message }, status);
const missing = () => fail("教室が見つかりません。", 404);
const isId = (value: unknown): value is string => typeof value === "string" && classIdPattern.test(value);
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
};

async function handle(request: NextRequest, write: boolean) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return fail("ログインが必要です。", 401);
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return fail("ログインが必要です。", 401);
    const profile = await db.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle();
    if (profile.error) throw profile.error;
    if (profile.data?.is_monitor !== true) return missing();

    const schoolId = request.nextUrl.searchParams.get("school");
    const classId = request.nextUrl.searchParams.get("class");
    const date = request.nextUrl.searchParams.get("date");
    if (!isId(schoolId) || !isId(classId) || !validDate(date)) return fail("クラスと日付を指定してください。");
    const [access, ownership, self] = await Promise.all([
      db.rpc("read_class_school", { p_school: schoolId, p_user: user.id }),
      db.from("class_schools").select("id").eq("id", schoolId).eq("owner_user_id", user.id).maybeSingle(),
      db.from("school_enrollments").select("id").eq("school_id", schoolId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    ]);
    for (const result of [access, ownership, self]) if (result.error) throw result.error;
    const item = (access.data as ClassSchool | null)?.classes.find(entry => entry.id === classId);
    const owner = Boolean(ownership.data);
    if (!item || (!owner && !self.data)) return missing();

    if (!write) {
      let attendance = db.from("school_attendance").select("enrollment_id,absence_reported,actual")
        .eq("school_id", schoolId).eq("class_id", classId).eq("lesson_date", date);
      let charges = db.from("school_charges").select("id,enrollment_id,title,amount_yen,due_on,received_at,received_by").eq("school_id", schoolId);
      if (!owner) {
        attendance = attendance.eq("enrollment_id", self.data.id);
        charges = charges.eq("enrollment_id", self.data.id);
      }
      const [notices, roll, ledger] = await Promise.all([
        db.from("school_notices").select("id,body,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(30),
        attendance, charges.order("due_on", { ascending: false }),
      ]);
      for (const result of [notices, roll, ledger]) if (result.error) throw result.error;
      return send({ ok: true, userId: user.id, notices: notices.data, attendance: roll.data, charges: ledger.data });
    }

    const input = await request.json().catch(() => null);
    if (input?.action === "absence") {
      if (!self.data || typeof input.absent !== "boolean" || date !== nextLessonDate(item)) return fail("次回のレッスンを確認してください。");
      const result = await db.from("school_attendance").upsert({
        school_id: schoolId, class_id: classId, lesson_date: date, enrollment_id: self.data.id, absence_reported: input.absent,
      });
      if (result.error) throw result.error;
      return send({ ok: true });
    }
    if (!owner) return missing();
    if (input?.action === "notice") {
      const body = typeof input.body === "string" ? input.body.trim() : "";
      if (!body || body.length > 2000 || !isId(input.id)) return fail("お知らせは1〜2000文字で入力してください。");
      const result = await db.from("school_notices").upsert({ id: input.id, school_id: schoolId, body }, { onConflict: "id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    } else if (input?.action === "deleteNotice") {
      if (!isId(input.id)) return fail("お知らせを指定してください。");
      const result = await db.from("school_notices").delete().eq("id", input.id).eq("school_id", schoolId);
      if (result.error) throw result.error;
    } else if (input?.action === "receipt") {
      if (!isId(input.id) || !["cash", "transfer", "other"].includes(input.method)) return fail("受領方法を選んでください。");
      const result = await db.from("school_charges").update({ received_at: new Date().toISOString(), received_by: input.method })
        .eq("school_id", schoolId).eq("id", input.id).is("received_at", null);
      if (result.error) throw result.error;
    } else {
      if (!isId(input?.memberId)) return fail("受講者を指定してください。");
      const member = await db.from("school_enrollments").select("id").eq("school_id", schoolId).eq("id", input.memberId).maybeSingle();
      if (member.error) throw member.error;
      if (!member.data) return missing();
      if (input.action === "actual") {
        if (![null, "present", "absent"].includes(input.actual)) return fail("出欠を選んでください。");
        const result = await db.from("school_attendance").upsert({
          school_id: schoolId, class_id: classId, lesson_date: date, enrollment_id: input.memberId, actual: input.actual,
        });
        if (result.error) throw result.error;
      } else if (input.action === "charge") {
        const title = typeof input.title === "string" ? input.title.trim() : "";
        if (!isId(input.id) || !title || title.length > 120 || !validDate(input.due) ||
            !Number.isInteger(input.amount) || input.amount < 1 || input.amount > 10000000) return fail("請求名・金額・期限を確認してください。");
        const result = await db.from("school_charges").upsert({
          id: input.id, school_id: schoolId, enrollment_id: input.memberId, title, amount_yen: input.amount, due_on: input.due,
        }, { onConflict: "id", ignoreDuplicates: true });
        if (result.error) throw result.error;
      } else return fail("操作を確認してください。");
    }
    return send({ ok: true });
  } catch (error) {
    console.error("[class daily] failed", error);
    return fail("教室の情報を処理できませんでした。", 500);
  }
}

export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
