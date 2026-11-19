export const applicationFields = {
  name: "氏名", email: "メールアドレス", phone: "電話番号", address: "住所", school: "所属・学校名",
  guardianName: "保護者名", guardianEmail: "保護者のメールアドレス", guardianPhone: "保護者の電話番号", guardianAddress: "保護者の住所",
} as const;
export type ApplicationField = keyof typeof applicationFields;
type Rule = "required" | "optional" | "hidden";
const mailKinds = ["briefing", "reminder", "invite", "received", "booked"] as const;
export type BriefingMail = typeof mailKinds[number];
export type BriefingDesign = {
  audience: "adult" | "minor";
  rules: Record<ApplicationField, Rule>;
  schoolLabel: string;
  firstDay: "choose" | "assigned";
  arrival: string;
  allowTrials: boolean;
  mail: Partial<Record<BriefingMail, { subject: string; body: string }>>;
};
export type BriefingFollowup = { design: BriefingDesign; invitedAt: string; firstDays: string[]; expiresAt?: string };
export const applicationFieldIds = Object.keys(applicationFields) as ApplicationField[];
export const cleanClassText = (value: unknown) => typeof value === "string" ? value.trim() : "";
export const validClassEmail = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const classToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
export const classDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function parseBriefingDesign(value: unknown): BriefingDesign | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<BriefingDesign>;
  if (!input.rules || (input.audience !== "adult" && input.audience !== "minor") ||
    (input.firstDay !== "assigned" && input.firstDay !== "choose")) return null;
  const rules = {} as BriefingDesign["rules"];
  for (const key of applicationFieldIds) {
    const rule = input.rules[key];
    if (rule !== "required" && rule !== "optional" && rule !== "hidden") return null;
    rules[key] = key.startsWith("guardian") && input.audience === "adult" ? "hidden" : rule;
  }
  rules.name = rules.email = "required";
  if (input.audience === "minor") {
    rules.guardianName = rules.guardianEmail = rules.guardianPhone = rules.guardianAddress = "required";
  }
  const mail: BriefingDesign["mail"] = {};
  for (const kind of mailKinds) {
    const subject = cleanClassText(input.mail?.[kind]?.subject);
    const body = cleanClassText(input.mail?.[kind]?.body);
    if (subject.length > 180 || body.length > 4000) return null;
    if (subject && body) mail[kind] = { subject, body };
  }
  return { audience: input.audience, rules, schoolLabel: cleanClassText(input.schoolLabel).slice(0, 60),
    firstDay: input.firstDay, arrival: cleanClassText(input.arrival).slice(0, 300), allowTrials: input.allowTrials === true, mail };
}

export function parseApplication(design: BriefingDesign, input: Record<string, unknown>, contactEmail: string) {
  const fields: Partial<Record<ApplicationField, string>> = {};
  for (const key of applicationFieldIds) {
    const rule = design.rules[key];
    if (rule === "hidden") continue;
    const email = key === "email" || key === "guardianEmail";
    const value = cleanClassText(input[key]);
    if ((!value && rule === "required") || value.length > 300 || (value && email && !validClassEmail(value)) ||
      (value && (key === "phone" || key === "guardianPhone") && !/^[+0-9()\s-]{7,30}$/.test(value))) return null;
    if (value) fields[key] = email ? value.toLowerCase() : value;
  }
  if ((design.audience === "minor" ? fields.guardianEmail : fields.email) !== contactEmail.toLowerCase() ||
    (fields.name?.length ?? 0) > 120 || (fields.guardianName?.length ?? 0) > 120) return null;
  return fields;
}

export function renderBriefingMail(design: BriefingDesign | null | undefined, kind: BriefingMail, defaults: { subject: string; body: string },
  values: { school: string; when?: string; where?: string }) {
  const template = design?.mail[kind] ?? defaults;
  const render = (value: string) => value.replaceAll("{教室名}", () => values.school)
    .replaceAll("{日時}", () => values.when ?? "").replaceAll("{会場}", () => values.where ?? "");
  return { subject: render(template.subject), body: render(template.body) };
}

// Follow-up forms inherit the audience saved when the teacher configured admission.
export function designForApplicant(design: BriefingDesign, audience: "adult" | "minor"): BriefingDesign {
  return parseBriefingDesign({ ...design, audience })!;
}

export function parseIntakeProfile(input: Record<string, unknown>) {
  if (input.audience !== "adult" && input.audience !== "minor") return null;
  const rules = Object.fromEntries(applicationFieldIds.map(key => [key, "optional"])) as BriefingDesign["rules"];
  const design = parseBriefingDesign({ audience: input.audience, rules, firstDay: "assigned" })!;
  const contact = cleanClassText(input.audience === "minor" ? input.guardianEmail : input.email).toLowerCase();
  const fields = parseApplication(design, input, contact);
  return fields ? { audience: input.audience, fields, contact,
    applicant: input.audience === "minor" ? fields.guardianName! : fields.name!,
    phone: input.audience === "minor" ? fields.guardianPhone : fields.phone,
    recipients: [contact, ...(input.audience === "minor" ? [fields.email!] : [])] } : null;
}

export function classInterviewExpiry(hours: unknown, now = Date.now()) {
  return hours === 24 || hours === 72 ? new Date(now + hours * 3600000).toISOString() : null;
}

export function classInterviewExpired(expiresAt: string | undefined, now = Date.now()) {
  if (expiresAt === undefined) return false;
  const expiration = Date.parse(expiresAt);
  return !Number.isFinite(expiration) || expiration <= now;
}
