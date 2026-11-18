import { classCalendarToday, generateClassDays, shiftCalendarMonth } from "./classCalendar";
import { classWeekdays, matchesClassDateRule } from "./classRecurrence";
import type { SchoolClass } from "./classes";

export type ClassIntakeMonth = { class_id: string; month: string; days: string[]; confirmed: boolean };

type UpcomingClass = { day: string; time: string; location: string | null; confirmed: boolean; fee?: number };

export type ClassIntakeTarget = {
  id: string;
  audience?: "adult" | "minor";
  name: string;
  schedule: string;
  location: string | null;
  fee: number | null;
  monthlyVisits?: number;
  booking?: string;
  upcoming?: UpcomingClass[];
};

type TargetSlot = Pick<SchoolClass, "id" | "name" | "starts_on" | "starts_at" | "cadence" | "location" | "fee_override_yen" | "schedule_rules" | "delivery">;
type TargetProduct = { name: string; audience?: "adult" | "minor"; monthlyFee?: number; monthlyVisits?: number; booking?: string };

export function classIntakeTarget(slot: TargetSlot, product?: TargetProduct | null,
  calendar?: { today: string; months: ClassIntakeMonth[] }, showVisitFee = false): ClassIntakeTarget {
  const rules = slot.schedule_rules?.rules;
  const initialDay = new Date(slot.starts_on + "T00:00:00Z");
  const cadence = rules?.length ? rules.map(rule => {
    if (rule.kind === "date") return `毎月${rule.date}日`;
    const weekday = classWeekdays[rule.weekday] + "曜";
    return rule.kind === "weekly" ? "毎週" + weekday : `毎月第${rule.ordinal}${weekday}`;
  }).join("・") : slot.cadence === "weekly" ? "毎週" + classWeekdays[initialDay.getUTCDay()] + "曜" : `毎月${initialDay.getUTCDate()}日`;
  return {
    id: slot.id,
    audience: product?.audience,
    name: product?.name ? product.name + " · " + slot.name : slot.name,
    schedule: cadence + " " + slot.starts_at.slice(0, 5),
    location: slot.delivery === "online" ? "オンライン" : slot.location,
    fee: slot.fee_override_yen ?? product?.monthlyFee ?? null,
    monthlyVisits: product?.monthlyVisits,
    booking: product?.booking,
    ...(calendar ? { upcoming: classIntakeUpcoming(slot, calendar.months, calendar.today, showVisitFee ? slot.fee_override_yen ?? product?.monthlyFee ?? null : null) } : {}),
  };
}

function classIntakeUpcoming(slot: TargetSlot, saved: ClassIntakeMonth[], today = classCalendarToday(), visitFee: number | null = null): UpcomingClass[] {
  const month = today.slice(0, 7);
  const time = slot.starts_at.slice(0, 5);
  return [month, shiftCalendarMonth(month, 1)].flatMap(value => {
    const plan = saved.find(row => row.class_id === slot.id && row.month === value + "-01");
    const days = plan?.days ?? generateClassDays(slot, value, false);
    return [...days].sort().filter(day => day >= today).map(day => {
      const override = slot.schedule_rules?.overrides.findLast(entry => matchesClassDateRule(entry.rule, day));
      return { day, time, location: slot.delivery === "online" ? "オンライン" : override?.location ?? slot.location,
        confirmed: plan?.confirmed === true, ...(visitFee !== null ? { fee: override?.fee ?? visitFee } : {}) };
    });
  }).slice(0, 4);
}
