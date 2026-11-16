import { classRunsOn, type SchoolClass } from "./classes";

const dayLength = 86400000;
export const calendarMonthPattern = /^20\d\d-(0[1-9]|1[0-2])$/;
export const classCalendarToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

export function shiftCalendarMonth(month: string, offset: number) {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function classCalendarDays(month: string) {
  const start = Date.parse(month + "-01T00:00:00Z");
  const count = (Date.parse(shiftCalendarMonth(month, 1) + "-01T00:00:00Z") - start) / dayLength;
  return Array.from({ length: count }, (_, index) => new Date(start + index * dayLength).toISOString().slice(0, 10));
}

export function generateClassDays(item: Pick<SchoolClass, "starts_on" | "cadence">, month: string, skipFifth: boolean) {
  return classCalendarDays(month).filter(day => classRunsOn(item, day) &&
    !(skipFifth && item.cadence === "weekly" && Number(day.slice(-2)) >= 29));
}

export type ClassMonthSchedule = {
  days: string[];
  confirmed: boolean;
  revision: number;
};

export type LearnerCalendarEntry = {
  day: string;
  title: string;
  time: string;
  location: string | null;
  label: string;
};

export function isScheduledClassDay(item: Pick<SchoolClass, "id" | "starts_on" | "cadence">, day: string,
  calendar?: Record<string, string[]>) {
  const scheduled = calendar?.[item.id + ":" + day.slice(0, 7)];
  return scheduled ? scheduled.includes(day) : classRunsOn(item, day);
}
