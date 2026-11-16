import { classWeekdays } from "./classRecurrence";
import type { SchoolClass } from "./classes";

export type ClassIntakeTarget = {
  id: string;
  name: string;
  schedule: string;
  location: string | null;
  fee: number | null;
  monthlyVisits?: number;
  booking?: string;
};

type TargetSlot = Pick<SchoolClass, "id" | "name" | "starts_on" | "starts_at" | "cadence" | "location" | "fee_override_yen" | "schedule_rules" | "delivery">;
type TargetProduct = { name: string; monthlyFee?: number; monthlyVisits?: number; booking?: string };

export function classIntakeTarget(slot: TargetSlot, product?: TargetProduct | null): ClassIntakeTarget {
  const rules = slot.schedule_rules?.rules;
  const initialDay = new Date(slot.starts_on + "T00:00:00Z");
  const cadence = rules?.length ? rules.map(rule => {
    if (rule.kind === "date") return `毎月${rule.date}日`;
    const weekday = classWeekdays[rule.weekday] + "曜";
    return rule.kind === "weekly" ? "毎週" + weekday : `毎月第${rule.ordinal}${weekday}`;
  }).join("・") : slot.cadence === "weekly" ? "毎週" + classWeekdays[initialDay.getUTCDay()] + "曜" : `毎月${initialDay.getUTCDate()}日`;
  return {
    id: slot.id,
    name: product?.name ? product.name + " · " + slot.name : slot.name,
    schedule: cadence + " " + slot.starts_at.slice(0, 5),
    location: slot.delivery === "online" ? "オンライン" : slot.location,
    fee: slot.fee_override_yen ?? product?.monthlyFee ?? null,
    monthlyVisits: product?.monthlyVisits,
    booking: product?.booking,
  };
}
