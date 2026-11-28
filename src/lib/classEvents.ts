export type ClassEventSession = { startsAt: string; location: string };
export type ClassEventKind = "event" | "workshop";
export type ClassEventSettings = ClassEventSession & {
  sessions?: ClassEventSession[];
  lastStartsAt?: string;
  audience: "members" | "public" | "mixed";
  classIds: string[];
  registration: boolean;
  deadline: string;
};

export type ClassEvent = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed";
  class_event: ClassEventSettings;
  definition: { capacity: number | null };
  payment_method: "none" | "on_site" | "payment_link" | "parari";
  payment_amount: number | null;
  payment_url: string | null;
};

export type ClassEventEntry = {
  id: string;
  status: string;
  name: string;
  payment_status: string | null;
  class_event_attendance: "present" | "absent" | null;
  class_workshop_attendance?: { session_at: string; status: "present" | "absent" }[];
};

export function classEventDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));
}

export const classEventLabels = { event: "イベント", workshop: "講習会" } as const;
export const maxWorkshopSessions = 30;

export function classEventKind(settings: Pick<ClassEventSettings, "sessions">): ClassEventKind {
  return settings.sessions ? "workshop" : "event";
}

export function classEventSessions(settings: ClassEventSession & Pick<ClassEventSettings, "sessions">) {
  return settings.sessions ?? [{ startsAt: settings.startsAt, location: settings.location }];
}

export function classEventScheduleText(settings: ClassEventSession & Pick<ClassEventSettings, "sessions">) {
  return classEventSessions(settings).map(({ startsAt, location }, index) =>
    (settings.sessions ? `第${index + 1}回　` : "") + classEventDate(startsAt) + "（日本時間） " + location);
}

export type ClassEventEntryFilter = "all" | "ready" | "unpaid" | "present" | "notPresent";
export function classEventEntryAttendance(entry: ClassEventEntry, sessionAt?: string) {
  return (sessionAt
    ? entry.class_workshop_attendance?.find(record => Date.parse(record.session_at) === Date.parse(sessionAt))?.status
    : entry.class_event_attendance) ?? null;
}
export function classEventEntryReady(entry: ClassEventEntry, paymentMethod: ClassEvent["payment_method"]) {
  return entry.status === "confirmed" && (entry.payment_status === "paid" ||
    (paymentMethod === "none" && entry.payment_status === "not_required"));
}
export function classEventEntryMatches(entry: ClassEventEntry, paymentMethod: ClassEvent["payment_method"], sessionAt: string | undefined, filter: ClassEventEntryFilter, search: string) {
  const present = classEventEntryAttendance(entry,sessionAt) === "present";
  const matches = filter === "all" || (filter === "ready" && classEventEntryReady(entry,paymentMethod)) ||
    (filter === "unpaid" && entry.payment_status === "unpaid") || (filter === "present" && present) ||
    (filter === "notPresent" && !present);
  const key = search.trim().normalize("NFKC").toLocaleLowerCase("ja-JP");
  return matches && (!key || entry.name.normalize("NFKC").toLocaleLowerCase("ja-JP").includes(key) || entry.id.toLowerCase().includes(key));
}
