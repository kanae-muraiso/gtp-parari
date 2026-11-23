import { classIdPattern } from "./classes";

/**
 * CLASS homepage is a normal editable PARARI PAGE, not a privileged page type.
 * The role and business association live in SSOT. The server MUST additionally
 * verify actual ownership and CLASS association; SSOT metadata is not authority.
 */
export const CLASS_HOME_ROLE = "class_home" as const;
export const CLASS_HOME_VERSION = 1;

export function classHomeMetadata(content: string | null | undefined):
  { role: typeof CLASS_HOME_ROLE; businessId: string; version: number } | null {
  if (typeof content !== "string" || !/^\s*\[PAGE\](?:\s|$)/i.test(content)) return null;
  // Metadata must occur at the beginning of the PAGE, before the first TEXT.
  const intro = content.slice(0, 1600);
  const marker = /^\[PAGEINFO\]\s*\r?\n((?:(?!\[[A-Z][A-Z0-9_]*\]).*\r?\n?){1,15})/im.exec(intro);
  if (!marker || marker.index > 400) return null;
  const attrs = Object.fromEntries(
    marker[1].split(/\r?\n/).map(line => /^([a-z_]+):\s*(.+?)\s*$/.exec(line))
      .filter((entry): entry is RegExpExecArray => Boolean(entry))
      .map(entry => [entry[1], entry[2]]),
  );
  if (attrs.role !== CLASS_HOME_ROLE || attrs.schema_version !== String(CLASS_HOME_VERSION) ||
      !classIdPattern.test(attrs.business_id ?? "")) return null;
  if (!/^\[T\]/m.test(content)) return null;
  return { role: CLASS_HOME_ROLE, businessId: attrs.business_id, version: CLASS_HOME_VERSION };
}

export function eligibleClassHomePage(content: string | null | undefined, businessId: string): boolean {
  return classHomeMetadata(content)?.businessId === businessId;
}

export function starterClassHomeSsot(name: string, businessId: string, welcome = ""): string {
  if (!classIdPattern.test(businessId)) throw new Error("Invalid CLASS business");
  // Prevent user text from being interpreted as structural SSOT tags.
  const safe = (value: string, max: number) => value.replace(/\r/g, "")
    .replace(/^\s*\[/gm, "［").replace(/\u0000/g, "").slice(0, max);
  const title = safe(name.replace(/\n/g, " "), 120).trim() || "教室のご案内";
  const introduction = safe(welcome.trim(), 2000) ||
    "教室へようこそ。ここに先生からのご挨拶や、教室で大切にしていることを書いてください。";
  return [
    "[PAGE]",
    "title: " + title,
    "[PAGEINFO]",
    "role: class_home",
    "schema_version: 1",
    "business_id: " + businessId,
    "[T]",
    introduction,
  ].join("\n");
}
