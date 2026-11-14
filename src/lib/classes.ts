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
