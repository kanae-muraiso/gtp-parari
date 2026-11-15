"use client";

import { useState } from "react";

type Slot = { id: string; starts_at: string; channel?: "onsite" | "phone" };

const dayKey = (value: string) => new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 10);
const monthKey = (date: Date) => date.toISOString().slice(0, 7);
const field = "rounded-lg border p-2 text-sm";

export default function ClassBookingCalendar({ slots, selected, onSelect }: {
  slots: Slot[]; selected: string; onSelect: (id: string) => void;
}) {
  const days = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = dayKey(slot.starts_at);
    days.set(key, [...(days.get(key) ?? []), slot]);
  }
  const monthKeys = [...new Set([...days.keys()].sort().map(key => key.slice(0, 7)))];
  const [month, setMonth] = useState(monthKeys[0] ?? "");
  const [day, setDay] = useState("");
  const visibleMonth = monthKeys.includes(month) ? month : monthKeys[0];
  if (!visibleMonth) return null;

  const beginning = new Date(visibleMonth + "-01T00:00:00Z");
  const monthIndex = monthKeys.indexOf(visibleMonth);
  const lastDay = new Date(Date.UTC(beginning.getUTCFullYear(), beginning.getUTCMonth() + 1, 0)).getUTCDate();
  const times = day.startsWith(visibleMonth) ? days.get(day) ?? [] : [];
  function changeMonth(value: string) {
    setMonth(value);
    setDay("");
    onSelect("");
  }

  return <fieldset className="grid min-w-0 gap-2 rounded-xl border p-3">
    <legend className="font-semibold">予約日時（日本時間）</legend>
    <div className="flex items-center justify-between gap-2">
      <button type="button" className={field} disabled={monthIndex < 1} onClick={() => changeMonth(monthKeys[monthIndex - 1])}>前月</button>
      <p className="text-sm font-medium" aria-live="polite">{monthKey(beginning).replace("-", "年")}月</p>
      <button type="button" className={field} disabled={monthIndex >= monthKeys.length - 1} onClick={() => changeMonth(monthKeys[monthIndex + 1])}>翌月</button>
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
    <label className="text-sm">時間帯
      <select className="block w-full rounded-lg border p-2" name="slot" required value={times.some(slot => slot.id === selected) ? selected : ""} onChange={event => onSelect(event.target.value)}>
        <option value="">{times.length ? "時間を選んでください" : "カレンダーで日付を選んでください"}</option>
        {times.map(slot => <option value={slot.id} key={slot.id}>
          {new Date(slot.starts_at).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" })} · {slot.channel === "phone" ? "電話" : "対面"}
        </option>)}
      </select>
    </label>
  </fieldset>;
}
