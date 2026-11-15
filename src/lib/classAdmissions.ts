import type { BriefingDesign, BriefingFollowup, ApplicationField } from "./classBriefingWorkflow";

export const defaultAdmissionSettings = {
  labels: { operator: "先生", learner: "生徒", proxy: "保護者", admission: "入会" },
  briefing: true,
  test: false,
  proxy: true,
  terms: "",
};
export type AdmissionSettings = typeof defaultAdmissionSettings;

export type AdmissionCase = {
  id: string; name: string; contact: string; source: "public" | "referral" | "invite";
  briefing: "skip" | "pending" | "booked" | "done" | "missed"; briefing_at: string | null;
  test: "skip" | "pending" | "booked" | "taken" | "graded"; test_at: string | null; score: string;
  decision: "pending" | "approved" | "held" | "rejected" | "waitlist" | "withdrawn";
  starts_on: string | null; deadline: string | null; payment: "free" | "advance" | "onsite";
  received_at: string | null; consent_at: string | null; agreed_terms: string | null;
  applicant_phone?: string | null;
  applicant_name?: string | null;
  applicant_email?: string | null;
  learner_email?: string | null; trial_dates?: string[]; briefing_followup?: BriefingFollowup | null;
  application_fields?: Partial<Record<ApplicationField, string>> | null; applicant_user_id?: string | null;
  invite_token: string | null;
  enrollment_id: string | null; revision: number;
};
export type AdmissionsData = { settings: AdmissionSettings; paymentMode?: AdmissionCase["payment"]; briefingDesign?: BriefingDesign | null; cases: AdmissionCase[] };
