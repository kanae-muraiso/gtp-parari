"use client";

import { useEffect, useState } from "react";
import type { SchoolClass } from "@/lib/classes";
import ClassWeekTimeline from "./ClassWeekTimeline";
import { classRequest } from "@/lib/classRequests";

export type OfficeHour = { weekday: number; channel: "onsite" | "phone"; starts: string; ends: string };
type Event = { starts_at: string; ends_at: string; label: string; kind: "class" | "booked" | "block" };
const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
const field = "rounded border p-2";
const button = "w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";
const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const shift = (value: string, days: number) => new Date(Date.parse(value) + days * 86400000).toISOString().slice(0, 10);
const local = (value: string) => new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16);

export default function ClassAvailabilityPanel({ initial, duration, location, busy, save, revision, classes }: {
  initial: OfficeHour[]; duration: number; location: string; busy: boolean;
  save: (input: object) => Promise<boolean>; revision: object; classes: SchoolClass[];
}) {
  const [hours, setHours] = useState(initial);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [day, setDay] = useState(today);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [allDay, setAllDay] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setEvents([]);
    setError("");
    void classRequest<{ events: Event[] }>("/recruitment?month=" + month, undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setEvents(result.events); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [month, revision]);
  const first = new Date(month + "-01T00:00:00Z");
  const following = new Date(first);
  following.setUTCMonth(following.getUTCMonth() + 1);
  const dayCount = new Date(following.getTime() - 86400000).getUTCDate();
  const days = Array.from({ length: dayCount }, (_, index) => shift(month + "-01", index));
  const eventsOn = (value: string) => events.filter(event =>
    local(event.starts_at) < shift(value, 1) && local(event.ends_at) > value + "T00:00");
  const selectDay = (value: string) => {
    setDay(value);
    setBlockStart("");
    setBlockEnd("");
    setAllDay(false);
  };

  function changeMonth(offset: number) {
    const target = new Date(first);
    target.setUTCMonth(target.getUTCMonth() + offset);
    const next = target.toISOString().slice(0, 7);
    setMonth(next);
    const current = today();
    selectDay(current.startsWith(next) ? current : next + "-01");
  }

  const formatEvent = (event: Event, value: string) => {
    const from = local(event.starts_at), to = local(event.ends_at);
    return (from.slice(0, 10) === value ? from.slice(11) : "00:00") + "〜" +
      (to.slice(0, 10) === value ? to.slice(11) : "24:00");
  };

  return <div className="grid gap-4">
    <form className="grid gap-3 border-t pt-3" onSubmit={async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setSaved(await save({ action: "hours", hours, duration: Number(form.get("duration")), location: form.get("location") }));
    }}>
      <h4 className="font-semibold">曜日ごとの受付時間</h4>
      <p className="text-sm text-neutral-600">授業・確定済み予約・予約不可と重ならない時間に、所要時間ごとの予約枠を出します。</p>
      <ClassWeekTimeline hours={hours} classes={classes} disabled={busy} onChange={next => { setHours(next); setSaved(false); }} />
      <label>1件の所要時間（分） <input className={field} type="number" name="duration" min={5} max={480} required defaultValue={duration} /></label>
      <label>対面の会場・集合場所 <input className={field} name="location" maxLength={300} defaultValue={location} /></label>
      <button className={button} disabled={busy}>受付時間を保存</button>
      {saved && <p role="status" className="text-sm">受付時間を保存しました。</p>}
    </form>
    <section className="grid gap-3 border-t pt-3" aria-label="教室の月間カレンダー">
      <h4 className="font-semibold">教室の月間カレンダー</h4>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={field} onClick={() => changeMonth(-1)}>前月</button>
        <span aria-live="polite" className="font-medium">{first.getUTCFullYear()}年{first.getUTCMonth() + 1}月</span>
        <button type="button" className={field} onClick={() => changeMonth(1)}>翌月</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {weekdays.map(label => <span key={label} className="py-1 text-neutral-600">{label}</span>)}
        {Array.from({ length: first.getUTCDay() }, (_, index) => <span key={"blank" + index} aria-hidden="true" />)}
        {days.map((value, index) => {
          const count = eventsOn(value).length;
          return <button type="button" key={value} aria-pressed={day === value}
            aria-label={value + (count ? " 予定" + count + "件" : "")}
            className="grid min-h-12 content-start justify-items-center rounded border p-1 aria-pressed:border-blue-800 aria-pressed:bg-blue-800 aria-pressed:text-white"
            onClick={() => selectDay(value)}>
            <span>{index + 1}</span>
            {count > 0 && <span className="text-xs">{count}件</span>}
          </button>;
        })}
      </div>
      <form key={day} className="grid gap-2" onSubmit={async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await save({ action: "block", id: crypto.randomUUID(),
          startsAt: day + "T" + (allDay ? "00:00" : form.get("starts")) + ":00+09:00",
          endsAt: (allDay ? shift(day, 1) : day) + "T" + (allDay ? "00:00" : form.get("ends")) + ":00+09:00" });
      }}>
        <p className="text-sm">{day}の予約不可を登録</p>
        {eventsOn(day).map((event, index) => {
          const from = event.kind === "class" && local(event.starts_at).slice(0, 10) === day ? local(event.starts_at).slice(11) : null;
          const until = event.kind === "class" && local(event.ends_at).slice(0, 10) === day ? local(event.ends_at).slice(11) : null;
          return <div key={index} className="flex flex-wrap gap-2 text-sm">
            <span>{formatEvent(event, day)} {event.label}</span>
            {from && from !== "00:00" && <button type="button" className="underline" onClick={() => {
              setAllDay(false); setBlockStart(""); setBlockEnd(from);
            }}>授業前を指定</button>}
            {until && <button type="button" className="underline" onClick={() => {
              setAllDay(false); setBlockStart(until); setBlockEnd("");
            }}>授業後を指定</button>}
          </div>;
        })}
        <label><input type="checkbox" checked={allDay} onChange={event => setAllDay(event.target.checked)} /> 終日</label>
        {!allDay && <div className="flex flex-wrap gap-2">
          <label>開始 <input type="time" required name="starts" className={field} value={blockStart} onChange={event => setBlockStart(event.target.value)} /></label>
          <label>終了 <input type="time" required name="ends" className={field} value={blockEnd} onChange={event => setBlockEnd(event.target.value)} /></label>
        </div>}
        <button className={button} disabled={busy}>この時間を予約不可にする</button>
      </form>
    </section>
  </div>;
}
