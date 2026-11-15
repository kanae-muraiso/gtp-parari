"use client";

import { useEffect, useRef, useState } from "react";

export type BookingSlot = {
  id: string;
  starts_at: string;
  channel?: "onsite" | "phone";
  duration_minutes: number;
  location?: string | null;
};

const tokyo = (value: number) => new Date(value + 9 * 3600000).toISOString();
const dayKey = (value: string) => tokyo(Date.parse(value)).slice(0, 10);
export const bookingTime = (value: number) => tokyo(value).slice(11, 16);
const dateLabel = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" });
export const bookingDate = (value: string) => dateLabel.format(new Date(value));
const monthKey = (date: Date) => date.toISOString().slice(0, 7);
const field = "rounded-lg border p-2 text-sm";

export default function ClassBookingCalendar({ slots, bookingWeeks, selected, onSelect }: {
  slots: BookingSlot[]; bookingWeeks: number; selected: string; onSelect: (id: string) => void;
}) {
  const now = Date.now();
  const currentMonth = tokyo(now).slice(0, 7);
  const lastMonth = tokyo(now + bookingWeeks * 7 * 86400000).slice(0, 7);
  const days = new Map<string, BookingSlot[]>();
  for (const slot of slots) {
    const key = dayKey(slot.starts_at);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }
  const [month, setMonth] = useState(currentMonth);
  const [day, setDay] = useState("");
  const timeline = useRef<HTMLDivElement>(null);
  const visibleMonth = month < currentMonth || month > lastMonth ? currentMonth : month;
  const beginning = new Date(visibleMonth + "-01T00:00:00Z");
  const year = beginning.getUTCFullYear();
  const monthIndex = beginning.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const visibleDay = day.startsWith(visibleMonth) ? day : "";
  const times = days.get(visibleDay) ?? [];
  const timesByStart = new Map<string, BookingSlot[]>();
  for (const slot of times) {
    const time = bookingTime(Date.parse(slot.starts_at));
    timesByStart.set(time, [...(timesByStart.get(time) ?? []), slot]);
  }
  useEffect(() => {
    const viewport = timeline.current;
    const first = viewport?.querySelector<HTMLElement>("[data-available-time]");
    if (viewport) viewport.scrollTop = first?.offsetTop ?? 0;
  }, [visibleDay]);

  function changeMonth(offset: number) {
    setMonth(monthKey(new Date(Date.UTC(year, monthIndex + offset, 1))));
    setDay("");
    onSelect("");
  }

  return <fieldset className="grid min-w-0 gap-2 rounded-xl border p-3">
    <legend className="font-semibold">予約日時（日本時間）</legend>
    <div className="flex items-center justify-between gap-2">
      <button type="button" className={field} disabled={visibleMonth <= currentMonth} onClick={() => changeMonth(-1)}>前月</button>
      <p className="text-sm font-medium" aria-live="polite">{monthKey(beginning).replace("-", "年")}月</p>
      <button type="button" className={field} disabled={visibleMonth >= lastMonth} onClick={() => changeMonth(1)}>翌月</button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center text-sm">
      {["日", "月", "火", "水", "木", "金", "土"].map(label => <span key={label}>{label}</span>)}
      {Array.from({ length: beginning.getUTCDay() }, (_, i) => <span aria-hidden="true" key={"blank" + i} />)}
      {Array.from({ length: lastDay }, (_, i) => {
        const date = i + 1;
        const key = visibleMonth + "-" + String(date).padStart(2, "0");
        const available = days.has(key);
        return <button type="button" key={key} disabled={!available} aria-label={key + (available ? " 予約可" : " 空きなし")}
          aria-pressed={day === key} className={day === key ? "rounded bg-blue-800 py-2 text-white" : available ? "rounded bg-blue-50 py-2 underline" : "py-2 text-neutral-400"}
          onClick={() => { setDay(key); onSelect(""); }}>{date}</button>;
      })}
    </div>
    {visibleDay ? <section className="mt-2 grid gap-2" aria-label="開始時刻">
      <h3 className="text-sm font-semibold">{bookingDate(visibleDay + "T00:00:00+09:00")}の開始時刻</h3>
      <div ref={timeline} tabIndex={0} aria-label="0時から24時までの時間表"
        className="relative max-h-64 overflow-y-auto rounded-lg border">
        {Array.from({ length: 48 }, (_, index) => {
          const time = String(Math.floor(index / 2)).padStart(2, "0") + (index % 2 ? ":30" : ":00");
          const options = timesByStart.get(time) ?? [];
          return <div key={time} data-available-time={options.length ? "" : undefined}
            className="flex min-h-11 items-center gap-2 border-b px-2 py-1 text-sm">
            <span className={options.length ? "w-12 shrink-0 tabular-nums" : "w-12 shrink-0 tabular-nums text-neutral-500"}>{time}</span>
            {options.length ? <div className="flex flex-wrap gap-1">
              {options.map(slot => {
                const label = slot.channel === "phone" ? "電話" : "対面";
                return <button key={slot.id} type="button" aria-pressed={selected === slot.id}
                  aria-label={time + " " + label}
                  className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 font-medium text-blue-900 aria-pressed:border-blue-800 aria-pressed:bg-blue-800 aria-pressed:text-white"
                  onClick={() => onSelect(slot.id)}>{options.length > 1 || slot.channel === "phone" ? label : "選ぶ"}</button>;
              })}
            </div> : <span className="text-neutral-500">—<span className="sr-only">空きなし</span></span>}
          </div>;
        })}
        <div className="px-2 py-2 text-sm tabular-nums text-neutral-500">24:00</div>
      </div>
    </section> : <p className="text-sm text-neutral-600">{days.size ? "空きのある日付を選んでください。" : "現在予約できる日時はありません。"}</p>}
    <input type="hidden" name="slot" value={times.some(slot => slot.id === selected) ? selected : ""} />
  </fieldset>;
}
