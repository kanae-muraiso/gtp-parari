import { classIdPattern } from "./classes";

export type ClassBusinessFrontContent = { introduction: string; entries: string[] };
export type ClassBusinessFront = {
  draft: ClassBusinessFrontContent;
  published: ClassBusinessFrontContent | null;
  revision: number;
};
export type ClassBusinessFrontLink = { key: string; title: string; label: string; href: string };

export const emptyClassBusinessFront: ClassBusinessFront = {
  draft: { introduction: "", entries: [] }, published: null, revision: 0,
};
export const classBusinessFrontPath = (id: string) => "/class-business/" + id;

export function parseClassBusinessFront(value: unknown): ClassBusinessFrontContent | null {
  if (!value || typeof value !== "object") return null;
  const { introduction, entries } = value as ClassBusinessFrontContent;
  if (typeof introduction !== "string" || introduction.length > 3000 || !Array.isArray(entries) || entries.length > 100) return null;
  if (!entries.every(key => {
    if (typeof key !== "string") return false;
    const [kind, id, extra] = key.split(":");
    return extra === undefined && ["intake", "schedule", "event"].includes(kind) && classIdPattern.test(id ?? "");
  })) return null;
  return { introduction: introduction.trim(), entries: [...new Set(entries)] };
}

export function selectClassBusinessFrontLinks(entries: string[], links: ClassBusinessFrontLink[]) {
  const byKey = new Map(links.map(link => [link.key, link]));
  return entries.flatMap(key => {
    const link = byKey.get(key);
    return link ? [link] : [];
  });
}
