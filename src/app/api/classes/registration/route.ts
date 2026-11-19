import { classApplicationReturn, sendClassEnrollmentNotice } from "@/lib/classEnrollmentNotice";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
async function handle(request: NextRequest, write: boolean) {
  try {
    const token = request.headers.get("x-class-registration");
    const access = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token || !classIdPattern.test(token)) return reply({ ok: false, message: "案内リンクを確認してください。" }, 404);
    if (!access) return reply({ ok: false, loginRequired: true, message: "案内メールを受け取ったアドレスでPARARIに登録・ログインしてください。" }, 401);
    const account = await db.auth.getUser(access);
    const user = account.data.user;
    if (account.error || !user?.email_confirmed_at) return reply({ ok: false, loginRequired: true, message: "メール確認済みのアカウントでログインしてください。" }, 401);
    const result = await db.from("school_admission_cases").select("id,school_id,name,applicant_email,learner_email,applicant_audience,applicant_user_id,learner_user_id,registration_token,learner_token,enrollment_id,starts_on,decision,recruitment_offer_id,briefing,intake_slot_id")
      .or(`registration_token.eq.${token},learner_token.eq.${token}`).maybeSingle();
    if (result.error) throw result.error;
    let row = result.data;
    const learner = row?.learner_token === token;
    const expected = learner ? row?.learner_email : row?.applicant_email;
    if (!row || ((learner ? row.learner_user_id : row.applicant_user_id) && (learner ? row.learner_user_id : row.applicant_user_id) !== user.id) || ["rejected", "withdrawn"].includes(row.decision) || !expected || user.email?.toLowerCase() !== expected.toLowerCase() ||
        (learner && (row.applicant_audience !== "minor" || row.learner_email?.toLowerCase() === row.applicant_email?.toLowerCase())))
      return reply({ ok: false, wrongAccount: true, message: "この案内は利用できません。メールを受け取ったアカウントをご確認ください。" }, 404);
    const school = await db.from("class_schools").select("name,owner_user_id").eq("id", row.school_id).is("archived_at", null).maybeSingle();
    if (school.error) throw school.error;
    if (!school.data) return reply({ ok: false, message: "この案内は利用できません。" }, 404);
    let mailed: boolean | null = null;
    if (write) {
      const input = await request.json().catch(() => null);
      if (input?.agree !== true) return reply({ ok: false, message: "申込情報との接続に同意してください。" }, 400);
      const updated = await db.rpc("connect_and_complete_class_registration", { p_token: token, p_user: user.id });
      if (updated.error?.code === "23505") return reply({ ok: false, message: "同じ教室に登録済みの情報があります。教室にご確認ください。" }, 409);
      if (updated.error) return reply({ ok: false, message: "登録情報が変更されました。案内をご確認ください。" }, 409);
      const current = await db.from("school_admission_cases").select("enrollment_id,starts_on").eq("id", row.id).single();
      if (current.error) throw current.error;
      if (!row.enrollment_id && current.data.enrollment_id) mailed = await sendClassEnrollmentNotice(row.school_id, row.id, request.nextUrl.origin);
      row = { ...row, ...current.data };
    }
    const returnHref = await classApplicationReturn(row.school_id, row.recruitment_offer_id).catch(() => null);
    return reply({ ok: true, returnHref, mailed, interviewReserved: Boolean(row.intake_slot_id && row.briefing === "booked"), school: school.data.name, name: row.name, schoolId: row.school_id, startsOn: row.starts_on,
      enrolled: Boolean(row.enrollment_id), connected: write || (learner ? row.learner_user_id === user.id : row.applicant_user_id === user.id),
      role: learner ? "learner" : row.applicant_audience === "minor" ? "guardian" : "learner" });
  } catch {
    return reply({ ok: false, message: "登録情報を確認できませんでした。" }, 500);
  }
}
export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
