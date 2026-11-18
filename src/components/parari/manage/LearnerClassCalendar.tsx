"use client";

import { useEffect, useState } from "react";
import { classRequest, ClassRequestError } from "@/lib/classRequests";
import { calendarMonthPattern, classCalendarToday, shiftCalendarMonth, type LearnerCalendarEntry } from "@/lib/classCalendar";
import ClassMonthGrid from "./ClassMonthGrid";

export default function LearnerClassCalendar({ schoolId, memberId, refresh }: { schoolId: string; memberId?: string | null; refresh: number }) {
  const [month, setMonth] = useState(() => classCalendarToday().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState("");
  const [data, setData] = useState<{ scope: string; month: string; entries: LearnerCalendarEntry[]; error?: string; hidden?: boolean }>();
  const scope = schoolId + ":" + (memberId ?? "");
  useEffect(() => {
    const controller = new AbortController();
    void classRequest<{ entries: LearnerCalendarEntry[] }>(`/schedule?school=${encodeURIComponent(schoolId)}&month=${month}${memberId ? "&member=" + memberId : ""}`, undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData({ scope, month, entries: result.entries }); })
      .catch(cause => { if (!controller.signal.aborted) setData({ scope, month, entries: [], error: cause.message,
        hidden: cause instanceof ClassRequestError && (cause.status === 401 || cause.status === 404) }); });
    return () => controller.abort();
  }, [schoolId, month, refresh, memberId, scope]);
  if (data?.scope === scope && data.hidden) return null;
  const current = data?.scope === scope && data.month === month ? data : null;
  const events = selectedDay ? current?.entries.filter(entry => entry.day === selectedDay) : current?.entries;
  function move(offset: number) {
    const next = shiftCalendarMonth(month, offset);
    if (!calendarMonthPattern.test(next)) return;
    setMonth(next);
    setSelectedDay("");
  }
  return <section className="grid gap-3 rounded-2xl border bg-white p-5">
    <h2 className="text-lg font-bold">クラスのカレンダー</h2>
    <div className="flex items-center justify-between gap-2">
      <button type="button" className="rounded border px-2 py-1 text-sm" onClick={() => move(-1)}>前月</button>
      <strong>{month.slice(0, 4)}年{Number(month.slice(-2))}月</strong>
      <button type="button" className="rounded border px-2 py-1 text-sm" onClick={() => move(1)}>翌月</button>
    </div>
    <ClassMonthGrid month={month} cell={day => {
      const count = current?.entries.filter(entry => entry.day === day).length ?? 0;
      return <button type="button" aria-pressed={selectedDay === day} aria-label={`${day} 予定${count}件`}
        className={`min-h-10 w-full rounded border text-sm ${selectedDay === day ? "border-blue-800 ring-1 ring-blue-800" : count ? "bg-blue-50" : "bg-white"}`}
        onClick={() => setSelectedDay(value => value === day ? "" : day)}>{Number(day.slice(-2))}{count > 0 && <span className="block text-xs text-blue-800">{count}件</span>}</button>;
    }} />
    {current?.error ? <p role="alert">{current.error}</p> : !current ? <p role="status">予定を読み込んでいます…</p> :
      !events?.length ? <p className="text-sm">この{selectedDay ? "日" : "月"}の予定はありません。</p> :
        <ul className="grid gap-2">
          {events.map((entry, index) => <li key={`${entry.day}-${index}`} className="rounded-lg border px-3 py-2 text-sm">
            <strong>{entry.day.slice(5).replace("-", "/")} {entry.time} · {entry.title}</strong>
            <span className="block text-neutral-600">{entry.label}{entry.location ? " · " + entry.location : ""}</span>
          </li>)}
        </ul>}
  </section>;
}
