import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classNotice } from "@/lib/classAdmissionMail";

export async function classRegistrationMail(schoolId: string, caseId: string, origin: string, subject: string, body: string, key: string, scheduledAt?: string) {
  const { data: row, error } = await db.from("school_admission_cases")
    .select("applicant_email,learner_email,applicant_audience,registration_token,learner_token")
    .eq("id", caseId).eq("school_id", schoolId).single();
  if (error) throw error;
  const primary = new URL("/class-registration#" + row.registration_token, origin).href;
  const recipients = [classNotice([row.applicant_email], subject,
    body + "\n\n" + (row.applicant_audience === "minor" ? "保護者の" : "本人の") + "PARARI登録・ログイン\n" + primary, key, scheduledAt)];
  if (row.applicant_audience === "minor" && row.learner_email && row.learner_email.toLowerCase() !== row.applicant_email?.toLowerCase()) {
    const learner = new URL("/class-registration#" + row.learner_token, origin).href;
    recipients.push(classNotice([row.learner_email], subject, body + "\n\n保護者に入会手続きの案内をお送りしています。\nご本人のPARARI登録・ログイン\n" + learner, key + "-learner", scheduledAt));
  }
  return (await Promise.all(recipients)).every(Boolean);
}
