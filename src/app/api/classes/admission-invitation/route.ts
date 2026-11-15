import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classAdmissionMail, classNotice } from "@/lib/classAdmissionMail";
import { classMeetingUrl, classIdPattern } from "@/lib/classes";

import { classToday, parseApplication, parseBriefingDesign, renderBriefingMail, type BriefingFollowup } from "@/lib/classBriefingWorkflow";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const send = (body: object, status = 200) => NextResponse.json(body, { status, headers });

async function handle(request: NextRequest, write: boolean) {
  const missing = () => send({ ok: false, message: "この案内は利用できません。教室にお問い合わせください。" }, 404);
  const token = request.headers.get("x-class-invitation");
  if (!token || !classIdPattern.test(token)) return missing();
  try {
    const candidate = await db.from("school_admission_cases")
      .select("id,school_id,starts_on,deadline,payment,consent_at,agreed_terms,revision,briefing,test,applicant_email,applicant_name,name,learner_email,briefing_followup,applicant_user_id,application_fields")
      .eq("invite_token", token).eq("decision", "approved").is("enrollment_id", null).maybeSingle();
    if (candidate.error) throw candidate.error;
    const row = candidate.data;
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    if (!row || (!row.starts_on && !row.briefing_followup) || !row.deadline || row.deadline < today ||
      !["skip", "done"].includes(row.briefing) || !["skip", "graded"].includes(row.test)) return missing();
    if (!row.applicant_email) {
      const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!accessToken) return send({ ok: false, message: "モニター用アカウントでログインしてください。" }, 401);
      const { data: { user }, error } = await db.auth.getUser(accessToken);
      if (error || !user) return missing();
      const viewer = await db.from("profiles").select("is_monitor").eq("user_id", user.id).maybeSingle();
      if (viewer.error) throw viewer.error;
      if (viewer.data?.is_monitor !== true) return missing();
    }
    const [setting, school, recruitment] = await Promise.all([
      db.from("school_admission_settings").select("labels,terms").eq("school_id", row.school_id).maybeSingle(),
      db.from("class_schools").select("name,owner_user_id").eq("id", row.school_id).maybeSingle(),
      db.from("school_recruitment").select("application_text,payment_url,arrival_text,payment_mode").eq("school_id", row.school_id).maybeSingle(),
    ]);
    if (setting.error || school.error || recruitment.error) throw setting.error ?? school.error ?? recruitment.error;
    if (!school.data) return missing();
    const terms = setting.data?.terms ?? "";
    const owner = await db.from("profiles").select("is_monitor").eq("user_id", school.data.owner_user_id).maybeSingle();
    if (owner.error) throw owner.error;
    if (owner.data?.is_monitor !== true) return missing();
    if (row.briefing_followup) {
      const flow = row.briefing_followup as BriefingFollowup;
      const design = parseBriefingDesign(flow.design);
      if (!design || !row.applicant_email || !Array.isArray(flow.firstDays)) return missing();
      const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!accessToken) return send({ ok: false, loginRequired: true, message: "申込の案内を受け取ったアカウントでログインしてください。" }, 401);
      const { data: { user }, error } = await db.auth.getUser(accessToken);
      if (error || !user || !user.email_confirmed_at ||
        (row.applicant_user_id ? row.applicant_user_id !== user.id : user.email?.toLowerCase() !== row.applicant_email.toLowerCase()))
        return send({ ok: false, loginRequired: true, message: "案内を受け取ったメールアドレスで登録・ログインしてください。" }, 401);
      const schedule = await db.from("school_classes").select("starts_at,location").eq("school_id", row.school_id).limit(1).maybeSingle();
      if (schedule.error) throw schedule.error;
      const startTime = schedule.data?.starts_at?.slice(0, 5) ?? "";
      const arrival = design.arrival || schedule.data?.location || "";
      const firstDays = flow.firstDays.filter(day => day >= classToday());
      const agreed = Boolean(row.consent_at && row.agreed_terms === terms && row.application_fields);
      const minor = design.audience === "minor";
      if (!write) return send({ ok: true, school: school.data.name, terms, label: setting.data?.labels?.admission ?? "入会",
        startsOn: row.starts_on, deadline: row.deadline, revision: row.revision, agreed, applicationText: recruitment.data?.application_text,
        followup: { design: { rules: design.rules, schoolLabel: design.schoolLabel, audience: design.audience, firstDay: design.firstDay },
          firstDays, startTime, arrival, prefill: { name: row.name, ...(minor ? { guardianName: row.applicant_name, guardianEmail: row.applicant_email,
            email: row.learner_email } : { email: row.applicant_email }) } } });
      const input = await request.json().catch(() => null);
      if (agreed && row.applicant_user_id === user.id) return send({ ok: true, startsOn: row.starts_on });
      const fields = input?.fields && parseApplication(design, input.fields, row.applicant_email);
      const firstDay = design.firstDay === "choose" ? input?.firstDay : row.starts_on;
      if (input?.agree !== true || input.terms !== terms || input.revision !== row.revision || !fields || !firstDays.includes(firstDay))
        return send({ ok: false, message: "必須項目、同意、初日をご確認ください。案内が更新された場合は再読み込みしてください。" }, 409);
      if (design.firstDay === "choose") {
        const occurrence = await db.rpc("class_recurrences", { p_school: row.school_id, p_day: firstDay });
        if (occurrence.error) throw occurrence.error;
        if (!occurrence.data?.length) return send({ ok: false, message: "選んだ初日の予定が変更されました。教室にご確認ください。" }, 409);
      }
      const updated = await db.from("school_admission_cases").update({
        consent_at: new Date().toISOString(), agreed_terms: terms, application_fields: fields, applicant_user_id: user.id,
        starts_on: firstDay, name: fields.name, applicant_name: minor ? fields.guardianName : fields.name,
        learner_email: minor ? fields.email ?? null : null, revision: row.revision + 1,
      }).eq("id", row.id).eq("invite_token", token).eq("revision", row.revision).eq("decision", "approved")
        .is("enrollment_id", null).select("id").maybeSingle();
      if (updated.error) throw updated.error;
      if (!updated.data) return send({ ok: false, message: "案内が更新されました。再読み込みしてください。" }, 409);
      const recipients = [row.applicant_email, minor ? fields.email : null];
      const when = [firstDay, startTime].filter(Boolean).join(" ");
      const mailValues = { school: school.data.name, when, where: arrival };
      const receipt = renderBriefingMail(design, "received", { subject: school.data.name + "の申込受付",
        body: "お申し込みを受け付けました。" }, mailValues);
      const start = renderBriefingMail(design, "booked", { subject: school.data.name + "の初日のご案内",
        body: "初日のご案内です。" }, mailValues);
      const [confirmed, scheduled] = await Promise.all([
        classNotice(recipients, receipt.subject, receipt.body, `briefing-receipt-${row.id}-${row.revision}`),
        classNotice(recipients, start.subject, start.body + "\n初日 " + when + (arrival ? "\n集合場所 " + arrival : ""),
          `briefing-first-day-${row.id}-${row.revision}`),
      ]);
      return send({ ok: true, startsOn: firstDay, confirmation: confirmed && scheduled });
    }
    const options = recruitment.data;
    const paymentUrl = row.payment === "advance" && options?.payment_mode === "advance" ? classMeetingUrl(options.payment_url) : null;
    const arrival = row.payment === "onsite" && options?.payment_mode === "onsite" ? options.arrival_text : null;
    if (!write) return send({ ok: true, school: school.data.name, terms, label: setting.data?.labels?.admission ?? "入会",
      startsOn: row.starts_on, deadline: row.deadline, payment: row.payment, revision: row.revision,
      applicationText: options?.application_text, paymentUrl, arrival, agreed: Boolean(row.consent_at && row.agreed_terms === terms) });

    const input = await request.json().catch(() => null);
    if (input?.agree !== true || input.terms !== terms || input.revision !== row.revision) {
      return send({ ok: false, message: "案内が更新されました。再読み込みしてください。" }, 409);
    }
    const result = await db.from("school_admission_cases")
      .update({ consent_at: new Date().toISOString(), agreed_terms: terms, revision: row.revision + 1 })
      .eq("id", row.id).eq("invite_token", token).eq("revision", row.revision).is("enrollment_id", null).select("id").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return send({ ok: false, message: "案内が更新されました。再読み込みしてください。" }, 409);
    if (row.applicant_email) await classAdmissionMail(row.applicant_email, school.data.name + "の申込確認",
      ["お申し込みを受け付けました。", arrival, paymentUrl ? "支払いページ " + paymentUrl : null].filter(Boolean).join("\n\n"),
      `class-invite-consent-${row.id}-${row.revision}`);
    return send({ ok: true, paymentUrl, arrival });
  } catch (error) {
    console.error("[class invitation] failed", error instanceof Error ? error.name : "database error");
    return send({ ok: false, message: "案内を取得できませんでした。" }, 500);
  }
}

export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
