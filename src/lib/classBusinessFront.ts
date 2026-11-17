import type { ClassIntakeTarget } from "./classIntakeTargets";
import type { ClassProduct } from "./classProduct";
import { classIdPattern } from "./classes";

export type ClassBusinessFrontContent = { introduction: string; entries: string[] };
export type ClassBusinessFront = {
  draft: ClassBusinessFrontContent;
  published: ClassBusinessFrontContent | null;
  revision: number;
};
export const classParticipationFormats = {
  open: "好きな回を予約する",
  fixed: "決まった枠に通う",
} as const;
export type ClassParticipationFormat = keyof typeof classParticipationFormats;

export function classParticipationFormat(design: Pick<ClassProduct, "booking" | "walkInFee">): ClassParticipationFormat {
  if (design.walkInFee != null || design.booking === "flexible") return "open";
  return "fixed";
}

export type ClassBusinessFrontLink = {
  key: string;
  title: string;
  label: string;
  href?: string;
  format?: ClassParticipationFormat;
  startsAt?: string;
  course?: { id: string; description: string; walkIn: boolean; explanation: string; slots: ClassIntakeTarget[] };
};

export const emptyClassBusinessFront: ClassBusinessFront = {
  draft: { introduction: "", entries: [] }, published: null, revision: 0,
};
export const classBusinessFrontPath = (id: string) => "/class-business/" + id;

export function classBusinessEntryKey(key: string) {
  return key.startsWith("schedule:") ? "product:" + key.slice("schedule:".length) : key;
}

export function normalizeClassBusinessEntries(content: ClassBusinessFrontContent): ClassBusinessFrontContent {
  return { ...content, entries: [...new Set(content.entries.map(classBusinessEntryKey))] };
}

export function parseClassBusinessFront(value: unknown): ClassBusinessFrontContent | null {
  if (!value || typeof value !== "object") return null;
  const { introduction, entries } = value as ClassBusinessFrontContent;
  if (typeof introduction !== "string" || introduction.length > 3000 || !Array.isArray(entries) || entries.length > 100) return null;
  if (!entries.every(key => {
    if (typeof key !== "string") return false;
    const [kind, id, extra] = key.split(":");
    return extra === undefined && ["intake", "schedule", "product", "event"].includes(kind) && classIdPattern.test(id ?? "");
  })) return null;
  return normalizeClassBusinessEntries({ introduction: introduction.trim(), entries });
}

export function selectClassBusinessFrontLinks(entries: string[], links: ClassBusinessFrontLink[]) {
  const byKey = new Map(links.map(link => [classBusinessEntryKey(link.key), link]));
  return [...new Set(entries.map(classBusinessEntryKey))].flatMap(key => {
    const link = byKey.get(key);
    return link ? [link] : [];
  });
}
