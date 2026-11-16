import { matchesClassDateRule, type ClassScheduleRules } from "./classRecurrence";

export const classIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type SchoolClass = {
  product_id?: string | null;
  productName?: string;
  fee_override_yen?: number | null;
  baseFee?: number;
  schedule_rules?: ClassScheduleRules | null;
  id: string;
  name: string;
  starts_on: string;
  starts_at: string;
  cadence: "weekly" | "monthly";
  location: string | null;
  delivery: "onsite" | "online" | "hybrid";
  meeting_url: string | null;
  duration_minutes?: number;
};

export type ClassSchool = {
  id: string;
  name: string;
  classes: SchoolClass[];
};

export type ClassRosterMember = {
  id: string;
  name: string;
  status: "active" | "ended";
  user_id: string | null;
  contract_fee_yen?: number | null;
  class_participation?: "fixed" | "multiple" | "flexible";
  assignments?: { class_id: string }[];
};

export type ClassManagement = {
  userId: string;
  school: ClassSchool | null;
  roster: ClassRosterMember[];
  surcharges?: { enrollment_id: string; class_id: string; visit_on: string; surcharge_yen: number }[];
  otherBusinesses?: { id: string; name: string }[];
  receipts?: { id: string; enrollment_id: string; class_id: string; visit_on: string; amount_yen: number; paid_at: string }[];
  products?: { id: string; name: string; walkInFee?: number | null; monthlyVisits?: number; booking?: string }[];
  applicationId: string | null;
  applications: { id: string; title: string }[];
};

export function classSchedule(item: SchoolClass) {
  return `${item.cadence === "weekly" ? "毎週" : "毎月"} · ${item.starts_at.slice(0, 5)}（日本時間） · 初回 ${item.starts_on}`;
}

export function classMeetingUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function classRunsOn(item: Pick<SchoolClass, "starts_on" | "cadence" | "schedule_rules">, day: string) {
  if (day < item.starts_on) return false;
  if (item.schedule_rules?.rules.length) return item.schedule_rules.rules.some(rule => matchesClassDateRule(rule, day));
  const current = new Date(day + "T00:00:00Z");
  if (item.cadence === "weekly") return (current.getTime() - Date.parse(item.starts_on)) % (7 * 86400000) === 0;
  const monthEnd = new Date(current);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  return current.getUTCDate() === Math.min(Number(item.starts_on.slice(-2)), monthEnd.getUTCDate());
}

export type ClassVisits = {
  flexible: boolean;
  classIds: string[];
  monthlyVisits: number;
  calendarDays?: Record<string, string[]>;
  contractFee?: number | null;
  booked: { class_id: string; visit_on: string; makeup_id?: string | null; surcharge_yen?: number; surcharge_paid_at?: string | null }[];
  allowances?: Record<string, number>;
  makeups?: { id: string; source_class_id: string; expires_on: string; missed_on: string }[];
  makeupClasses?: SchoolClass[];
};
