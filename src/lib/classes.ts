export const classIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type SchoolClass = {
  id: string;
  name: string;
  starts_on: string;
  starts_at: string;
  cadence: "weekly" | "monthly";
  location: string | null;
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
};

export type ClassManagement = {
  userId: string;
  school: ClassSchool | null;
  roster: ClassRosterMember[];
  applicationId: string | null;
  applications: { id: string; title: string }[];
};

export function classSchedule(item: SchoolClass) {
  return `${item.cadence === "weekly" ? "毎週" : "毎月"} · ${item.starts_at.slice(0, 5)}（日本時間） · 初回 ${item.starts_on}`;
}

export function nextLessonDate(item: SchoolClass, now = new Date()) {
  const today = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  const first = new Date(item.starts_on + "T00:00:00Z");
  if (item.starts_on >= today) return item.starts_on;
  const current = new Date(today + "T00:00:00Z");
  if (item.cadence === "weekly") {
    const week = 7 * 86400000;
    return new Date(first.getTime() + Math.ceil((current.getTime() - first.getTime()) / week) * week).toISOString().slice(0, 10);
  }
  const inMonth = (month: number) => new Date(Date.UTC(current.getUTCFullYear(), month,
    Math.min(first.getUTCDate(), new Date(Date.UTC(current.getUTCFullYear(), month + 1, 0)).getUTCDate())));
  const month = current.getUTCMonth();
  return (inMonth(month) < current ? inMonth(month + 1) : inMonth(month)).toISOString().slice(0, 10);
}

export type ClassDailyData = {
  userId: string;
  notices: { id: string; body: string; created_at: string }[];
  attendance: { enrollment_id: string; absence_reported: boolean; actual: "present" | "absent" | null }[];
  charges: { id: string; enrollment_id: string; title: string; amount_yen: number; due_on: string; received_at: string | null; received_by: string | null }[];
};
