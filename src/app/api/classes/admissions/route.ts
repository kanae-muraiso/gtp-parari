import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";
import { classAdmissionMail } from "@/lib/classAdmissionMail";
import { defaultAdmissionSettings } from "@/lib/classAdmissions";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const send = (body: object, status = 200) => NextResponse.json(body, { status, headers });
const fail = (message: string, status = 400) => send({ ok: false, message }, status);
const trim = (value: unknown) => typeof value === "string" ? value.trim() : "";
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
const validId = (value: unknown): value is string => typeof value === "string" && classIdPattern.test(value);

async function handle(request: NextRequest, write: boolean) {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return fail("ログインが必要です。", 401);
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return fail("ログインが必要です。", 401);

    const [profile, school] = await Promise.all([
      db.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle(),
      db.from("class_schools").select("id").eq("owner_user_id", user.id).eq("tier", "a").maybeSingle(),
    ]);
    if (profile.error || school.error) throw profile.error ?? school.error;
    if (profile.data?.is_monitor !== true || !school.data) return fail("教室が見つかりません。", 404);

    const schoolId = school.data.id;
    const setting = await db.from("school_admission_settings").select("labels,briefing,test,proxy,terms").eq("school_id", schoolId).maybeSingle();
    if (setting.error) throw setting.error;
    const settings = setting.data ?? defaultAdmissionSettings;

    if (!write) {
      const cases = await db.from("school_admission_cases").select("*").eq("school_id", schoolId).order("created_at", { ascending: false });
      if (cases.error) throw cases.error;
      return send({ ok: true, settings, cases: cases.data });
    }

    const input = await request.json().catch(() => null);
    if (input?.action === "settings") {
      const labels = Object.fromEntries(Object.keys(defaultAdmissionSettings.labels).map(key => [key, trim(input.labels?.[key])]));
      const terms = trim(input.terms);
      if (Object.values(labels).some(label => !label || label.length > 24) || terms.length > 8000) return fail("呼び方と規約を確認してください。");
      const result = await db.from("school_admission_settings").upsert({
        school_id: schoolId, labels, terms, briefing: input.briefing === true, test: input.test === true, proxy: input.proxy === true,
      });
      if (result.error) throw result.error;
    } else if (input?.action === "create") {
      const name = trim(input.name);
      const contact = trim(input.contact);
      if (!validId(input.id) || !name || name.length > 120 || contact.length > 300 || !["public", "referral", "invite"].includes(input.source)) return fail("候補者の入力を確認してください。");
      const result = await db.from("school_admission_cases").upsert({
        id: input.id, school_id: schoolId, name, contact, source: input.source,
        briefing: settings.briefing ? "pending" : "skip", test: settings.test ? "pending" : "skip", decision: "pending", payment: "free",
      }, { onConflict: "id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    } else if (input?.action === "email" && validId(input.id)) {
      const row = await db.from("school_admission_cases")
        .select("id,applicant_email,invite_token,decision,briefing,test,starts_on,deadline,consent_at,agreed_terms,payment,enrollment_id,revision")
        .eq("school_id", schoolId).eq("id", input.id).maybeSingle();
      if (row.error) throw row.error;
      const candidate = row.data;
      if (!candidate?.applicant_email) return fail("公開受付で登録されたメールアドレスが必要です。");
      const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.parari.app";
      const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      let subject: string;
      let body: string;
      if (input.kind === "invite" && candidate.invite_token && candidate.decision === "approved" &&
          !candidate.enrollment_id && candidate.starts_on && candidate.deadline >= today &&
          ["skip", "done"].includes(candidate.briefing) && ["skip", "graded"].includes(candidate.test)) {
        subject = settings.labels.admission + "手続きのご案内";
        body = "案内をご確認のうえ、期限までに手続きをお願いします。\n" +
          new URL("/class-admission#" + candidate.invite_token, base).href;
      } else if (input.kind === "payment" && candidate.consent_at && candidate.agreed_terms === settings.terms &&
          candidate.decision === "approved" && !candidate.enrollment_id && candidate.payment !== "free") {
        const instructions = trim(input.instructions);
        if (!instructions || instructions.length > 2000) return fail("金額・支払方法・期限を入力してください。");
        subject = "初回費用のご案内";
        body = instructions;
      } else if (input.kind === "start" && candidate.enrollment_id && candidate.starts_on) {
        const instructions = trim(input.instructions);
        if (!instructions || instructions.length > 2000) return fail("初回の日時と会場を入力してください。");
        subject = "初回レッスンのご案内";
        body = `在籍開始日 ${candidate.starts_on}\n${instructions}`;
      } else return fail("手続きの状態を確認してください。");
      if (!(await classAdmissionMail(candidate.applicant_email, subject, body,
          `class-${input.kind}-${candidate.id}-${candidate.revision}`))) return fail("メールを送信できませんでした。", 502);
    } else if (input?.action === "finish" && validId(input.id)) {
      const { error } = await db.rpc("finish_class_admission", { p_owner: user.id, p_school: schoolId, p_case: input.id });
      if (error?.code === "22023") return fail("工程・承認・開始日・同意・支払条件と期限を確認してください。");
      if (error?.code === "P0002") return fail("候補者が見つかりません。", 404);
      if (error) throw error;
    } else if (input?.action === "update" && validId(input.id) && Number.isInteger(input.revision)) {
      const name = trim(input.name);
      const contact = trim(input.contact);
      const score = trim(input.score);
      if (!name || name.length > 120 || contact.length > 300 || score.length > 120 ||
        !["skip", "pending", "booked", "done", "missed"].includes(input.briefing) ||
        !["skip", "pending", "booked", "taken", "graded"].includes(input.test) ||
        !["pending", "approved", "held", "rejected", "waitlist", "withdrawn"].includes(input.decision) ||
        !["free", "advance", "onsite"].includes(input.payment) ||
        (input.starts_on && !date(input.starts_on)) || (input.deadline && !date(input.deadline)) ||
        (input.briefing_at && !timestamp(input.briefing_at)) || (input.test_at && !timestamp(input.test_at)) ||
        (input.briefing === "booked" && !input.briefing_at) || (input.test === "booked" && !input.test_at) ||
        (input.test === "graded" && !score)) return fail("候補者情報と工程を確認してください。");

      const now = new Date().toISOString();
      const changes = {
        name, contact, score, briefing: input.briefing, briefing_at: input.briefing_at || null,
        test: input.test, test_at: input.test_at || null, decision: input.decision,
        starts_on: input.starts_on || null, deadline: input.deadline || null, payment: input.payment,
        revision: input.revision + 1,
        ...(input.issueInvite === true && input.decision === "approved" ? { invite_token: crypto.randomUUID() } : {}),
        ...(input.decision !== "approved" ? { invite_token: null } : {}),
        ...(input.confirmConsent === true ? { consent_at: now, agreed_terms: settings.terms } : {}),
        ...(input.confirmReceipt === true ? { received_at: now } : {}),
      };
      const { data, error } = await db.from("school_admission_cases").update(changes)
        .eq("school_id", schoolId).eq("id", input.id).eq("revision", input.revision).is("enrollment_id", null).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return fail("候補者が更新されています。再読み込みしてください。", 409);
    } else return fail("操作を確認してください。");

    return send({ ok: true });
  } catch (error) {
    console.error("[class admissions] failed", error);
    return fail("入会情報を処理できませんでした。", 500);
  }
}
export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
