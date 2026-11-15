"use client";

import { useEffect, useState } from "react";
import type { SchoolClass } from "@/lib/classes";
import ClassWeekTimeline from "./ClassWeekTimeline";
import { BookingDayTimeline, BookingMonthGrid, bookingDate, bookingDay, bookingTime, type BookingSlot } from "@/components/parari/classes/ClassBookingCalendar";
import { classRequest } from "@/lib/classRequests";

export type OfficeHour = { weekday: number; channel: "onsite" | "phone"; starts: string; ends: string };
type Event = { starts_at: string; ends_at: string; label: string; kind: "class" | "booked" | "block" };
type Block = { starts_at: string; ends_at: string };
const field = "rounded border p-2";
const button = "w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";
const today = () => bookingDay(new Date(Date.now()).toISOString());
const shift = (value: string, days: number) => new Date(Date.parse(value) + days * 86400000).toISOString().slice(0, 10);
const local = (value: string) => new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16);

export default function ClassAvailabilityPanel({ initial, duration, location, busy, save, revision, classes, slots, blocks }: {
  initial: OfficeHour[]; duration: number; location: string; busy: boolean;
  save: (input: object) => Promise<boolean>; revision: object; classes: SchoolClass[];
  slots: BookingSlot[]; blocks: Block[];
}) {
  const [hours, setHours] = useState(initial);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [day, setDay] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockMessage, setBlockMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setEvents([]);
    setError("");
    void classRequest<{ events: Event[] }>("/recruitment?month=" + month, undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setEvents(result.events); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [month, revision]);
  const eventsOn = (value: string) => events.filter(event =>
    local(event.starts_at) < shift(value, 1) && local(event.ends_at) > value + "T00:00");
  const dayStart = (value: string) => value + "T00:00:00+09:00";
  const isClosed = (value: string) => blocks.some(block =>
    Date.parse(block.starts_at) <= Date.parse(dayStart(value)) &&
    Date.parse(block.ends_at) >= Date.parse(dayStart(shift(value, 1))));
  const daySlots = slots.filter(slot => bookingDay(slot.starts_at) === day);
  const daysWithSlots = new Set(slots.map(slot => bookingDay(slot.starts_at)));
  const past = day < today();
  const closed = day !== "" && isClosed(day);

  function selectDay(value: string) {
    setDay(value);
    setBlockStart("");
    setBlockEnd("");
    setBlockMessage("");
  }

  async function addBlock(startsAt: string, endsAt: string, message: string) {
    if (busy) return;
    setBlockMessage("");
    if (await save({ action: "block", id: crypto.randomUUID(), startsAt, endsAt })) setBlockMessage(message);
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
      <BookingMonthGrid month={month} day={day} onMonth={value => { setMonth(value); selectDay(""); }} onDay={selectDay}
        describeDay={value => {
          const closed = isClosed(value);
          const count = eventsOn(value).length;
          const note = closed ? "終日不可" : count ? count + "件" : undefined;
          return { label: note ? " " + note : "", highlighted: daysWithSlots.has(value), note };
        }} />
      {error && <p role="alert">{error}</p>}
      {blockMessage && <p role="status" className="text-sm">{blockMessage}</p>}
      {day ? <section className="grid gap-2" aria-label="選んだ日の予定と予約枠">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-semibold">{bookingDate(dayStart(day))}</h5>
          {!past && <button type="button" className={field} disabled={busy || closed}
            onClick={() => void addBlock(dayStart(day), dayStart(shift(day, 1)), day + "を終日予約不可にしました。")}>
            {closed ? "終日予約不可" : "終日を予約不可にする"}
          </button>}
        </div>
        {daySlots.length > 0 && <p className="text-sm text-neutral-600">指定した時間帯と重なる予約枠が受付対象から外れます。</p>}
        {!daySlots.length && <p className="text-sm text-neutral-600">この日に受付中の予約枠はありません。</p>}
        <BookingDayTimeline day={day} slots={daySlots} renderSlot={(slot, time) => {
          const end = new Date(Date.parse(slot.starts_at) + slot.duration_minutes * 60000);
          const nextDay = bookingDay(end.toISOString()) !== day ? "翌日 " : "";
          const label = time + "〜" + nextDay + bookingTime(end.getTime());
          return <div key={slot.id} className="flex flex-wrap items-center gap-2">
            <span className="text-xs">{label}{slot.channel === "phone" ? " 電話" : ""}</span>
            <button type="button" className={field} disabled={busy || past || closed} aria-label={label + "を予約不可にする"}
              onClick={() => void addBlock(slot.starts_at, end.toISOString(), day + " " + label + "を予約不可にしました。")}>予約不可</button>
          </div>;
        }} />
        {eventsOn(day).map((event, index) => <p key={index} className="text-sm">{formatEvent(event, day)} {event.label}</p>)}
        {!past && !closed && <details key={day} className="text-sm">
          <summary className="cursor-pointer">開始・終了時刻を指定して予約不可にする</summary>
          <form className="mt-2 grid gap-2" onSubmit={event => {
            event.preventDefault();
            if (!blockStart || !blockEnd) return;
            void addBlock(day + "T" + blockStart + ":00+09:00", day + "T" + blockEnd + ":00+09:00",
              day + " " + blockStart + "〜" + blockEnd + "を予約不可にしました。");
          }}>
            {eventsOn(day).filter(event => event.kind === "class").map((event, index) => {
              const from = local(event.starts_at).slice(0, 10) === day ? local(event.starts_at).slice(11) : null;
              const until = local(event.ends_at).slice(0, 10) === day ? local(event.ends_at).slice(11) : null;
              return <div key={index} className="flex flex-wrap gap-2">
                <span>{formatEvent(event, day)} {event.label}</span>
                {from && from !== "00:00" && <button type="button" className="underline"
                  onClick={() => { setBlockStart(""); setBlockEnd(from); }}>授業前を指定</button>}
                {until && <button type="button" className="underline"
                  onClick={() => { setBlockStart(until); setBlockEnd(""); }}>授業後を指定</button>}
              </div>;
            })}
            <div className="flex flex-wrap gap-2">
              <label>開始 <input type="time" required className={field} value={blockStart} onChange={event => setBlockStart(event.target.value)} /></label>
              <label>終了 <input type="time" required className={field} value={blockEnd} onChange={event => setBlockEnd(event.target.value)} /></label>
            </div>
            <button className={button} disabled={busy}>この時間を予約不可にする</button>
          </form>
        </details>}
      </section> : <p className="text-sm text-neutral-600">日付を選んでください。</p>}
    </section>
  </div>;
}
