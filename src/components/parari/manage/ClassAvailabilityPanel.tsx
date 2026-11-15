"use client";

import { useEffect, useState } from "react";
import { classRequest } from "@/lib/classRequests";

export type OfficeHour = { weekday: number; channel: "onsite" | "phone"; starts: string; ends: string };
type Event = { starts_at: string; ends_at: string; label: string; kind: "class" | "booked" | "block" };
const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
const field = "rounded border p-2";
const button = "w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";
const today = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const shift = (value: string, days: number) => new Date(Date.parse(value) + days * 86400000).toISOString().slice(0, 10);
const local = (value: string) => new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16);

export default function ClassAvailabilityPanel({ initial, duration, location, busy, save, revision }: {
  initial: OfficeHour[]; duration: number; location: string; busy: boolean;
  save: (input: object) => Promise<boolean>; revision: object;
}) {
  const [hours, setHours] = useState(initial);
  const [start, setStart] = useState(today);
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
    void classRequest<{ events: Event[] }>("/recruitment?week=" + start, undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setEvents(result.events); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [start, revision]);
  const days = Array.from({ length: 7 }, (_, index) => shift(start, index));
  const selectDay = (value: string) => {
    setDay(value);
    setBlockStart("");
    setBlockEnd("");
    setAllDay(false);
  };

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
      {[1, 2, 3, 4, 5, 6, 0].map(weekday => <fieldset key={weekday} className="grid gap-2 rounded border px-3 pb-3">
        <legend className="px-1 text-sm font-semibold">{weekdays[weekday]}曜日</legend>
        {hours.map((row, index) => row.weekday === weekday && <div key={index} className="flex flex-wrap items-end gap-2 text-sm">
          <label>方法<select className={field} value={row.channel} onChange={event => {
            const channel = event.target.value === "phone" ? "phone" : "onsite";
            setHours(current => current.map((item, key) => key === index ? { ...item, channel } : item));
            setSaved(false);
          }}><option value="onsite">対面</option><option value="phone">電話</option></select></label>
          {(["starts", "ends"] as const).map(key => <label key={key}>{key === "starts" ? "開始" : "終了"}<input required type="time" className={field} value={row[key]} onChange={event => {
            const value = event.target.value;
            setHours(current => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
            setSaved(false);
          }} /></label>)}
          <button type="button" className="underline" onClick={() => {
            setHours(current => current.filter((_, i) => i !== index));
            setSaved(false);
          }}>削除</button>
        </div>)}
        <button type="button" className="w-fit text-sm underline" disabled={hours.length >= 42} onClick={() => {
          setHours(current => [...current, { weekday, channel: "onsite", starts: "10:00", ends: "12:00" }]);
          setSaved(false);
        }}>{weekdays[weekday]}曜の受付時間を追加</button>
      </fieldset>)}
      <label>1件の所要時間（分） <input className={field} type="number" name="duration" min={5} max={480} required defaultValue={duration} /></label>
      <label>対面の会場・集合場所 <input className={field} name="location" maxLength={300} defaultValue={location} /></label>
      <button className={button} disabled={busy}>受付時間を保存</button>
      {saved && <p role="status" className="text-sm">受付時間を保存しました。</p>}
    </form>
    <section className="grid gap-3 border-t pt-3" aria-label="教室のカレンダー">
      <h4 className="font-semibold">教室のカレンダー</h4>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="underline" onClick={() => { const value = shift(start, -7); setStart(value); selectDay(value); }}>前の7日</button>
        <label>表示開始日 <input className={field} type="date" value={start} onChange={event => {
          if (event.target.value) { setStart(event.target.value); selectDay(event.target.value); }
        }} /></label>
        <button type="button" className="underline" onClick={() => { const value = shift(start, 7); setStart(value); selectDay(value); }}>次の7日</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
        {days.map(value => <div key={value} className="min-w-0 rounded border p-2">
          <button type="button" aria-pressed={day === value} className={day === value ? "font-bold text-blue-800 underline" : "underline"} onClick={() => selectDay(value)}>
            {value.slice(5)}（{weekdays[new Date(value).getUTCDay()]}）
          </button>
          {events.filter(event => local(event.starts_at) < shift(value, 1) && local(event.ends_at) > value + "T00:00").map((event, index) =>
            <p key={index} className="mt-1 break-words text-xs">{formatEvent(event, value)} {event.label}</p>)}
        </div>)}
      </div>
      <form key={day} className="grid gap-2" onSubmit={async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await save({ action: "block", id: crypto.randomUUID(),
          startsAt: day + "T" + (allDay ? "00:00" : form.get("starts")) + ":00+09:00",
          endsAt: (allDay ? shift(day, 1) : day) + "T" + (allDay ? "00:00" : form.get("ends")) + ":00+09:00" });
      }}>
        <p className="text-sm">{day}の予約不可を登録</p>
        {events.filter(event => event.kind === "class" && local(event.starts_at).slice(0, 10) === day).map(event => {
          const from = local(event.starts_at).slice(11);
          const until = local(event.ends_at).slice(0, 10) === day ? local(event.ends_at).slice(11) : null;
          return <div key={event.starts_at + event.label} className="flex flex-wrap gap-2 text-sm">
            <span>{formatEvent(event, day)} {event.label}</span>
            {from !== "00:00" && <button type="button" className="underline" onClick={() => {
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
