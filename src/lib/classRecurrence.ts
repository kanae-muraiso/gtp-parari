export type ClassDateRule =
  | { kind: "weekly"; weekday: number }
  | { kind: "nth"; weekday: number; ordinal: number }
  | { kind: "date"; date: number };

export type ClassScheduleRules = {
  rules: ClassDateRule[];
  overrides: { rule: ClassDateRule; location: string; fee: number }[];
};

export const classWeekdays = ["日", "月", "火", "水", "木", "金", "土"];

export function matchesClassDateRule(rule: ClassDateRule, day: string) {
  const date = new Date(day + "T00:00:00Z");
  const number = date.getUTCDate();
  if (rule.kind === "date") return number === rule.date;
  return date.getUTCDay() === rule.weekday &&
    (rule.kind === "weekly" || Math.ceil(number / 7) === rule.ordinal);
}

export function parseClassScheduleRules(value: unknown): ClassScheduleRules | null {
  if (!value || typeof value !== "object") return null;
  const source = value as ClassScheduleRules;
  if (!Array.isArray(source.rules) || source.rules.length > 20 || !Array.isArray(source.overrides) || source.overrides.length > 20) return null;
  const integer = (number: unknown, min: number, max: number): number is number =>
    typeof number === "number" && Number.isInteger(number) && number >= min && number <= max;
  function parseRule(rule: ClassDateRule | null): ClassDateRule | null {
    if (!rule || typeof rule !== "object") return null;
    if (rule.kind === "date" && integer(rule.date, 1, 31)) return { kind: rule.kind, date: rule.date };
    if (!("weekday" in rule) || !integer(rule.weekday, 0, 6)) return null;
    if (rule.kind === "weekly") return { kind: rule.kind, weekday: rule.weekday };
    if (rule.kind === "nth" && integer(rule.ordinal, 1, 5)) return { kind: rule.kind, weekday: rule.weekday, ordinal: rule.ordinal };
    return null;
  }
  const rules: ClassDateRule[] = [];
  const overrides: ClassScheduleRules["overrides"] = [];
  for (const value of source.rules) {
    const rule = parseRule(value);
    if (!rule) return null;
    rules.push(rule);
  }
  for (const value of source.overrides) {
    const rule = parseRule(value?.rule);
    if (!rule || typeof value.location !== "string" || !value.location.trim() || value.location.length > 200 ||
      !integer(value.fee, 0, 1000000)) return null;
    overrides.push({ rule, location: value.location.trim(), fee: value.fee });
  }
  return { rules, overrides };
}
