import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classRegistrationMail } from "@/lib/classRegistrationMail";
import { classBusinessFrontPath } from "@/lib/classBusinessFront";
import { readClassIntakeSource } from "@/lib/classIntakeSource";
import { matchesClassDateRule } from "@/lib/classRecurrence";

export async function classApplicationReturn(school: string, offer?: string | null) {
  const [recruitment, front] = await Promise.all([
    db.from("school_recruitment").select("public_id").eq("school_id", school).maybeSingle(),
    db.from("class_business_fronts").select("published").eq("school_id", school).maybeSingle(),
  ]);
  const sourceId = offer ?? recruitment.data?.public_id;
  if (sourceId) {
    const source = await readClassIntakeSource(sourceId);
    if (source?.recruitment.school_id === school) return "/class-intake/" + sourceId;
  }
  return front.data?.published ? classBusinessFrontPath(school) : null;
}

export async function sendClassEnrollmentNotice(school: string, caseId: string, origin: string, resend = false) {
  try {
    const record = await db.from("school_admission_cases")
      .select("id,applicant_email,enrollment_id,starts_on,requested_class_id").eq("school_id", school).eq("id", caseId).single();
    if (record.error) throw record.error;
    const entry = record.data;
    if (!entry.enrollment_id || !entry.starts_on || !entry.applicant_email) return null;
    const [schoolInfo, assignment, enrollment] = await Promise.all([
      db.from("class_schools").select("name").eq("id", school).single(),
      db.from("school_class_assignments").select("class_id,self_selected").eq("school_id", school).eq("enrollment_id", entry.enrollment_id).order("class_id"),
      db.from("school_enrollments").select("class_participation").eq("school_id", school).eq("id", entry.enrollment_id).single(),
    ]);
    if (schoolInfo.error || assignment.error || enrollment.error) throw schoolInfo.error ?? assignment.error ?? enrollment.error;
    const assigned = entry.requested_class_id ?? (assignment.data.length === 1 ? assignment.data[0].class_id : null);
    const detail = assigned ? await db.from("school_classes").select("id,name,starts_on,cadence,starts_at,location,delivery,schedule_rules").eq("school_id", school).eq("id", assigned).maybeSingle() : null;
    if (detail?.error) throw detail.error;
    const lesson = detail?.data;
    const needsBooking = enrollment.data.class_participation === "flexible" && !assignment.data.find(row => row.class_id === assigned)?.self_selected;
    const scheduled = lesson ? await db.rpc("school_class_runs_on", { p_class: lesson.id, p_first: lesson.starts_on, p_cadence: lesson.cadence, p_day: entry.starts_on }) : null;
    if (scheduled?.error) throw scheduled.error;
    const override = lesson?.schedule_rules?.overrides?.findLast((item: { rule: Parameters<typeof matchesClassDateRule>[0]; location?: string }) => matchesClassDateRule(item.rule, entry.starts_on));
    const body = [
      "入会が確定しました。", "参加開始日 " + entry.starts_on,
      lesson ? lesson.name : null,
      lesson && scheduled?.data && !needsBooking ? "初回 " + entry.starts_on + " " + lesson.starts_at.slice(0, 5) + "（日本時間）" : null,
      lesson ? "会場 " + (lesson.delivery === "online" ? "オンライン（受講者ページから参加）" : override?.location || lesson.location || "教室にご確認ください") : null,
      needsBooking ? "受講者ページで参加する回を予約してください。" : lesson ? "所属クラスは回ごとの予約が不要です。初回の予定は受講者ページで確認できます。" : "参加するクラスと初回の予定は受講者ページでご確認ください。",
      "受講者ページ " + new URL("/my/classes/" + school, origin).href,
    ].filter(Boolean).join("\n");
    return await classRegistrationMail(school, caseId, origin, schoolInfo.data.name + "の入会確定・初回のご案内", body, "class-enrolled-" + caseId + (resend ? "-" + crypto.randomUUID() : ""));
  } catch {
    console.error("[class enrollment notice] delivery failed");
    return false;
  }
}
