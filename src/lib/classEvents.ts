export type ClassEventSettings = {
  startsAt: string;
  location: string;
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
  payment_method: "none" | "on_site" | "payment_link";
  payment_amount: number | null;
  payment_url: string | null;
};

export type ClassEventEntry = {
  id: string;
  status: string;
  name: string;
  payment_status: string | null;
  class_event_attendance: "present" | "absent" | null;
};

export function classEventDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));
}
