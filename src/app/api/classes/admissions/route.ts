import { classBusinessId } from "@/lib/classBusinessScope";
import { classRegistrationMail } from "@/lib/classRegistrationMail";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classIdPattern } from "@/lib/classes";
import { classNotice } from "@/lib/classAdmissionMail";
import { defaultAdmissionSettings } from "@/lib/classAdmissions";
import { classDate, classToday, designForApplicant, parseBriefingDesign, renderBriefingMail } from "@/lib/classBriefingWorkflow";

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

    const businessId = await classBusinessId(user.id, request.nextUrl.searchParams.get("business"));
    if (!businessId) return fail("事業を選択してください。", 404);
    const [profile, school] = await Promise.all([
      db.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle(),
      db.from("class_schools").select("id,name").eq("id", businessId).eq("owner_user_id", user.id).maybeSingle(),
    ]);
    if (profile.error || school.error) throw profile.error ?? school.error;
    if (profile.data?.is_monitor !== true || !school.data) return fail("教室が見つかりません。", 404);

    const schoolId = school.data.id;
    const setting = await db.from("school_admission_settings").select("labels,briefing,test,proxy,terms,briefing_design").eq("school_id", schoolId).maybeSingle();
    if (setting.error) throw setting.error;
    const settings = setting.data ?? defaultAdmissionSettings;
    const design = parseBriefingDesign(setting.data?.briefing_design);
    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.parari.app";

    if (!write) {
      if (request.nextUrl.searchParams.get("settings") === "1") return send({ ok: true, settings, briefingDesign: design, cases: [] });
      const cases = await db.from("school_admission_cases").select("*").eq("school_id", schoolId).order("created_at", { ascending: false });
      if (cases.error) throw cases.error;
      const [recruitment, classes] = await Promise.all([
        db.from("school_recruitment").select("payment_mode").eq("school_id", schoolId).maybeSingle(),
        db.from("school_classes").select("id,name").eq("school_id", schoolId).order("name"),
      ]);
      if (recruitment.error || classes.error) throw recruitment.error ?? classes.error;
      return send({ ok: true, settings, briefingDesign: design, cases: cases.data, classes: classes.data, paymentMode: recruitment.data?.payment_mode ?? "free" });
    }

    const input = await request.json().catch(() => null);
    if (input?.action === "briefingDesign") {
      const blueprint = parseBriefingDesign(input.design);
      if (!blueprint) return fail("説明会の設計図を確認してください。");
      const initial = await db.from("school_admission_settings").upsert(
        { school_id: schoolId, ...defaultAdmissionSettings }, { onConflict: "school_id", ignoreDuplicates: true });
      if (initial.error) throw initial.error;
      const result = await db.from("school_admission_settings").update({ briefing_design: blueprint }).eq("school_id", schoolId);
      if (result.error) throw result.error;
    } else if ((input?.action === "briefingFollowup" || input?.action === "trial") && validId(input.id) && Number.isInteger(input.revision)) {
      if (!design) return fail("入会設定で説明会の設計図を保存してください。");
      const savedDesign = design;
      const result = await db.from("school_admission_cases").select("*").eq("id", input.id).eq("school_id", schoolId).maybeSingle();
      if (result.error) throw result.error;
      const row = result.data;
      const candidateDesign = row?.applicant_audience ? designForApplicant(savedDesign, row.applicant_audience) : savedDesign;
      if (!row?.applicant_email || !row.intake_slot_id || row.enrollment_id || row.consent_at ||
        !["booked", "done"].includes(row.briefing) || ["withdrawn", "rejected"].includes(row.decision)) return fail("説明会の予約情報を確認してください。");
      if (row.revision !== input.revision) return fail("申込情報が更新されています。再読み込みしてください。", 409);
      if (input.action === "trial") {
        const time = typeof input.at === "string" ? Date.parse(input.at) : NaN;
        if (!candidateDesign.allowTrials || !Number.isFinite(time) || time <= Date.now() || row.trial_dates.length >= 24) return fail("体験日時を確認してください。");
        const at = new Date(time).toISOString();
        if (row.trial_dates.includes(at)) return fail("この体験日時は登録済みです。");
        const update = await db.from("school_admission_cases").update({ trial_dates: [...row.trial_dates, at].sort(), revision: row.revision + 1 })
          .eq("id", row.id).eq("school_id", schoolId).eq("revision", row.revision).select("id").maybeSingle();
        if (update.error) throw update.error;
        if (!update.data) return fail("申込情報が更新されています。再読み込みしてください。", 409);
        return send({ ok: true });
      }
      if (!["skip", "graded"].includes(row.test)) return fail("テストの結果を先に確認してください。");
      const dates: string[] = Array.isArray(input.firstDays) ? [...new Set<string>(input.firstDays.filter((value: unknown) => typeof value === "string"))] : [];
      if (!dates.length || dates.length > 12 || (candidateDesign.firstDay === "assigned" && dates.length !== 1) ||
          dates.some(day => !classDate(day) || day < classToday())) return fail("初日の候補日を確認してください。");
      if (candidateDesign.firstDay === "choose") {
        if (row.requested_class_id) {
          const target = await db.from("school_classes").select("starts_on,cadence").eq("id", row.requested_class_id).eq("school_id", schoolId).single();
          if (target.error) throw target.error;
          const wanted = await Promise.all(dates.map(day => db.rpc("school_class_runs_on", {
            p_class: row.requested_class_id, p_first: target.data.starts_on, p_cadence: target.data.cadence, p_day: day,
          })));
          const checkError = wanted.find(result => result.error)?.error;
          if (checkError) throw checkError;
          if (wanted.some(result => result.data !== true)) return fail("希望クラスの開催日を選んでください。");
        }
        const occurrences = await Promise.all(dates.map(day => db.rpc("class_recurrences", { p_school: schoolId, p_day: day })));
        const error = occurrences.find(result => result.error)?.error;
        if (error) throw error;
        if (occurrences.some(result => !result.data?.length)) return fail("初日の候補にはクラスの開催日を指定してください。");
      }
      const deadline = trim(input.deadline);
      if (!classDate(deadline) || deadline < classToday()) return fail("回答期限を確認してください。");
      const followup = { design: candidateDesign, invitedAt: new Date().toISOString(), firstDays: dates.sort() };
      const invitation = row.invite_token ?? crypto.randomUUID();
      const update = await db.from("school_admission_cases").update({
        briefing: "done", decision: "approved", starts_on: candidateDesign.firstDay === "assigned" ? dates[0] : null,
        deadline, invite_token: invitation, briefing_followup: followup, revision: row.revision + 1,
      }).eq("id", row.id).eq("school_id", schoolId).eq("revision", row.revision).select("id").maybeSingle();
      if (update.error) throw update.error;
      if (!update.data) return fail("申込情報が更新されています。再読み込みしてください。", 409);
      const link = new URL("/class-admission#" + invitation, origin).href;
      let mailed: boolean | undefined;
      if (input.email === true) {
        const mail = renderBriefingMail(candidateDesign, "invite", { subject: school.data.name + "からの入会案内",
          body: "入会をご希望の場合は、期限までに以下のフォームからお申し込みください。" }, { school: school.data.name });
        // The application link is delivered to the account holder who can submit it.
        const key = `briefing-invite-${row.id}-${row.revision + 1}`;
        const [primary, learner] = await Promise.all([
          classNotice([row.applicant_email], mail.subject, mail.body + "\n" + link, key),
          candidateDesign.audience === "minor" && row.learner_email && row.learner_email !== row.applicant_email
            ? classNotice([row.learner_email], mail.subject, mail.body + "\n保護者に申込フォームをお送りしました。", key + "-learner")
            : Promise.resolve(true),
        ]);
        mailed = primary && learner;
      }
      return send({ ok: true, link, mailed });
    } else if (input?.action === "settings" || input?.action === "labels") {
      const terms = trim(input.terms);
      const labels = Object.fromEntries(Object.keys(defaultAdmissionSettings.labels).map(key => [key, trim(input.labels?.[key])]));
      if (input.action === "labels" && Object.values(labels).some(label => !label || label.length > 24)) {
        return fail("呼び方はそれぞれ1〜24文字で入力してください。");
      }
      if (input.action === "settings" && terms.length > 8000) return fail("規約は8000文字以内で入力してください。");
      const changes = input.action === "labels" ? { labels } : {
        terms, briefing: input.briefing === true, test: input.test === true, proxy: input.proxy === true,
      };
      if (!setting.data) {
        const initial = await db.from("school_admission_settings").upsert(
          { school_id: schoolId, ...defaultAdmissionSettings, ...changes },
          { onConflict: "school_id", ignoreDuplicates: true },
        );
        if (initial.error) throw initial.error;
      }
      const result = await db.from("school_admission_settings").update(changes).eq("school_id", schoolId);
      if (result.error) throw result.error;
    } else if (input?.action === "create") {
      const name = trim(input.name);
      const contact = trim(input.contact);
      if (!validId(input.id) || !name || name.length > 120 || contact.length > 300 || !["public", "referral", "invite"].includes(input.source)) return fail("候補者の入力を確認してください。");
      const recruitment = await db.from("school_recruitment").select("route").eq("school_id", schoolId).maybeSingle();
      if (recruitment.error) throw recruitment.error;
      const needsBriefing = recruitment.data ? recruitment.data.route === "briefing" : settings.briefing;
      const result = await db.from("school_admission_cases").upsert({
        id: input.id, school_id: schoolId, name, contact, source: input.source,
        briefing: needsBriefing ? "pending" : "skip", test: settings.test ? "pending" : "skip", decision: "pending", payment: "free",
      }, { onConflict: "id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    } else if (input?.action === "email" && validId(input.id)) {
      const row = await db.from("school_admission_cases")
        .select("id,applicant_email,invite_token,decision,briefing,test,starts_on,deadline,consent_at,agreed_terms,payment,enrollment_id,revision,learner_email")
        .eq("school_id", schoolId).eq("id", input.id).maybeSingle();
      if (row.error) throw row.error;
      const candidate = row.data;
      if (!candidate?.applicant_email) return fail("公開受付で登録されたメールアドレスが必要です。");
      const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.parari.app";
      const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      let subject: string;
      let body: string;
      if (input.kind === "account" && !["withdrawn", "rejected"].includes(candidate.decision)) {
        const sent = await classRegistrationMail(schoolId, candidate.id, base, "PARARIの受講者ページのご案内",
          "申込時のメールアドレスでPARARIに登録・ログインし、申込情報との接続を確認してください。", `class-account-${candidate.id}-${candidate.revision}`);
        if (!sent) return fail("メールを送信できませんでした。", 502);
        return send({ ok: true, mailed: true });
      }
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
      const key = `class-${input.kind}-${candidate.id}-${candidate.revision}`;
      if (!(input.kind === "start"
        ? await classRegistrationMail(schoolId, candidate.id, base, subject, body, key)
        : await classNotice([candidate.applicant_email, candidate.learner_email], subject, body, key))) return fail("メールを送信できませんでした。", 502);
    } else if (input?.action === "finish" && validId(input.id)) {
      const { error } = await db.rpc("finish_class_admission", { p_owner: user.id, p_school: schoolId, p_case: input.id });
      if (error?.code === "P0006") return fail("本人または保護者が案内メールからPARARIに登録・ログインし、手続きを完了してください。");
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
      if (input.confirmConsent === true) {
        const candidate = await db.from("school_admission_cases").select("briefing_followup,applicant_audience").eq("school_id", schoolId).eq("id", input.id).maybeSingle();
        if (candidate.error) throw candidate.error;
        if (candidate.data?.briefing_followup || Boolean(candidate.data?.applicant_audience)) return fail("申込者がご自身のアカウントで同意してください。");
      }
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
