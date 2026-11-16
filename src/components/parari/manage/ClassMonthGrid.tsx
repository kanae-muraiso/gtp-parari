"use client";

import type { ReactNode } from "react";
import { classCalendarDays } from "@/lib/classCalendar";

const weekdays = ["月", "火", "水", "木", "金", "土", "日"];

export default function ClassMonthGrid({ month, cell }: { month: string; cell: (day: string) => ReactNode }) {
  const offset = (new Date(month + "-01T00:00:00Z").getUTCDay() + 6) % 7;
  return <div className="grid grid-cols-7 gap-1">
    {weekdays.map(day => <div key={day} className="text-center text-xs text-neutral-600">{day}</div>)}
    {Array.from({ length: offset }, (_, index) => <div key={index} />)}
    {classCalendarDays(month).map(day => <div key={day}>{cell(day)}</div>)}
  </div>;
}
