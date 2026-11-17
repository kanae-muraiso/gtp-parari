import "server-only";
import { supabaseAdmin as db } from "@/lib/billing/supabaseAdmin";
import { classCalendarToday, shiftCalendarMonth } from "./classCalendar";
import type { ClassIntakeMonth } from "./classIntakeTargets";

export async function readClassIntakeCalendar(school: string): Promise<{ today: string; months: ClassIntakeMonth[] }> {
  const today = classCalendarToday();
  const month = today.slice(0, 7);
  const { data, error } = await db.from("school_class_monthly_schedules")
    .select("class_id,month,days,confirmed,school_classes!inner(school_id)")
    .eq("school_classes.school_id", school).in("month", [month + "-01", shiftCalendarMonth(month, 1) + "-01"]);
  if (error) throw error;
  return { today, months: data.map(({ class_id, month, days, confirmed }) => ({ class_id, month, days, confirmed })) };
}
