"use client";

import { useEffect, useState } from "react";
import type { SchoolClass } from "@/lib/classes";
import ClassWeekTimeline from "./ClassWeekTimeline";
import { BookingDayTimeline, BookingMonthGrid, bookingDate, bookingDay, bookingTime, type BookingSlot } from "@/components/parari/classes/ClassBookingCalendar";
import { classRequest } from "@/lib/classRequests";

export type OfficeHour = { weekday: number; channel: "onsite" | "phone"; starts: string; ends: string };
type Event = { starts_at: string; ends_at: string; label: string; kind: "class" | "booked" | "block" };
type Block = { id: string; starts_at: string; ends_at: string };
type CalendarChange =
  | { action: "block" | "unblock"; block: Block }
  | { action: "slot"; slot: BookingSlot }
  | { action: "close"; id: string };
const halfHour = 30 * 60000;
const dayMs = 86400000;
const midnight = (value: string) => value + "T00:00:00+09:00";
const overlaps = (range: Pick<Block, "starts_at" | "ends_at">, start: number, end: number) =>
  Date.parse(range.starts_at) < end && Date.parse(range.ends_at) > start;
const asSlot = (block: Block): BookingSlot => ({ id: block.id, starts_at: block.starts_at,
  duration_minutes: (Date.parse(block.ends_at) - Date.parse(block.starts_at)) / 60000 });
const onOff = (off: boolean) => "rounded border px-2 py-1.5 text-sm disabled:opacity-60 " +
  (off ? "border-neutral-300 bg-neutral-100 text-neutral-800" : "border-emerald-300 bg-emerald-50 text-emerald-950");
const field = "rounded border p-2";
const button = "w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50";
const today = () => bookingDay(new Date(Date.now()).toISOString());
const shift = (value: string, days: number) => new Date(Date.parse(value) + days * 86400000).toISOString().slice(0, 10);
const local = (value: string) => new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16);

export default function ClassAvailabilityPanel({ initial, duration, location, busy, save, revision, classes, slots, blocks, manualSlots, bookingWeeks }: {
  initial: OfficeHour[]; duration: number; location: string; busy: boolean;
  save: (input: object) => Promise<boolean>; revision: object; classes: SchoolClass[];
  slots: BookingSlot[]; blocks: Block[]; manualSlots: BookingSlot[]; bookingWeeks: number;
}) {
  const [hours, setHours] = useState(initial);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [day, setDay] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [pending, setPending] = useState<CalendarChange | null>(null);
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setCalendarLoaded(false);
    setError("");
    void classRequest<{ events: Event[] }>("/recruitment?month=" + month, undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setEvents(result.events); setCalendarLoaded(true); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [month, revision]);
  const eventsOn = (value: string) => events.filter(event =>
    local(event.starts_at) < shift(value, 1) && local(event.ends_at) > value + "T00:00");
  const effectiveBlocks = pending?.action === "block" ? [...blocks, pending.block]
    : pending?.action === "unblock" ? blocks.filter(block => block.id !== pending.block.id) : blocks;
  const effectiveManual = pending?.action === "slot" ? [...manualSlots, pending.slot]
    : pending?.action === "close" ? manualSlots.filter(slot => slot.id !== pending.id) : manualSlots;
  const wholeDay = (value: string) => effectiveBlocks.find(block =>
    Date.parse(block.starts_at) <= Date.parse(midnight(value)) &&
    Date.parse(block.ends_at) >= Date.parse(midnight(shift(value, 1))));
  const timedBlocks = effectiveBlocks.filter(block => bookingDay(block.starts_at) === day &&
    Date.parse(block.starts_at) % halfHour === 0 && Date.parse(block.ends_at) - Date.parse(block.starts_at) < dayMs);
  const startsToday = (slot: BookingSlot) => bookingDay(slot.starts_at) === day && Date.parse(slot.starts_at) % halfHour === 0;
  const daySlots = new Map(slots.filter(slot => startsToday(slot) &&
    !(pending?.action === "close" && pending.id === slot.id) &&
    !effectiveBlocks.some(block => overlaps(block, Date.parse(slot.starts_at), Date.parse(slot.starts_at) + slot.duration_minutes * 60000)))
    .map(slot => [slot.id, slot]));
  const availableIds = new Set(daySlots.keys());
  const past = day < today();
  const outsideWindow = day > shift(today(), bookingWeeks * 7);
  const closed = day ? wholeDay(day) : undefined;
  const exactFullDay = closed && Date.parse(closed.starts_at) === Date.parse(midnight(day)) &&
    Date.parse(closed.ends_at) === Date.parse(midnight(shift(day, 1)));
  const activeEvents = day ? eventsOn(day) : [];
  const disabled = busy || pending !== null;
  for (const slot of effectiveManual.filter(startsToday)) {
    if (!timedBlocks.some(block => Date.parse(block.starts_at) === Date.parse(slot.starts_at))) daySlots.set(slot.id, slot);
  }
  for (const block of timedBlocks) daySlots.set(block.id, asSlot(block));
  if (pending?.action === "unblock" && !past && !outsideWindow && Date.parse(pending.block.ends_at) - Date.parse(pending.block.starts_at) < dayMs) {
    const slot = asSlot(pending.block);
    const start = Date.parse(slot.starts_at);
    const end = Date.parse(pending.block.ends_at);
    if (startsToday(slot) && start > Date.now() && !effectiveBlocks.some(block => overlaps(block, start, end)) &&
      !activeEvents.some(event => event.kind !== "block" && overlaps(event, start, end)) &&
      ![...daySlots.values()].some(item => Date.parse(item.starts_at) === start)) {
      daySlots.set(slot.id, slot);
      availableIds.add(slot.id);
    }
  }

  function selectDay(value: string) {
    setDay(value);
    setBlockStart("");
    setBlockEnd("");
  }

  async function apply(change: CalendarChange) {
    if (disabled) return;
    setPending(change);
    try {
      if (change.action === "block" || change.action === "unblock") {
        const { id, starts_at: startsAt, ends_at: endsAt } = change.block;
        await save({ action: change.action, id, startsAt, endsAt });
      } else if (change.action === "slot") {
        await save({ action: "slot", id: change.slot.id, startsAt: change.slot.starts_at, duration, location, capacity: 1 });
      } else if (change.action === "close") {
        await save(change);
      }
    } finally { setPending(null); }
  }

  const blockRange = (starts_at: string, ends_at: string) =>
    apply({ action: "block", block: { id: crypto.randomUUID(), starts_at, ends_at } });

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
          const closed = wholeDay(value);
          const count = eventsOn(value).length;
          const note = closed ? "終日不可" : count ? count + "件" : undefined;
          return { label: note ? " " + note : "", highlighted: slots.some(slot => bookingDay(slot.starts_at) === value), note };
        }} />
      {error && <p role="alert">{error}</p>}
      {pending && <p role="status" className="text-sm">変更を保存中…</p>}
      {day ? <section className="grid gap-2" aria-label="選んだ日の予定と予約枠">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-semibold">{bookingDate(midnight(day))}</h5>
          {!past && <button type="button" className={onOff(Boolean(closed))} disabled={disabled || Boolean(closed && !exactFullDay)}
            aria-pressed={Boolean(closed)} aria-label={closed ? "終日予約不可を解除" : "その日の新規予約を終日止める"}
            onClick={() => closed ? void apply({ action: "unblock", block: closed }) : void blockRange(midnight(day), midnight(shift(day, 1)))}>
            {closed ? "終日 予約不可" : "終日 予約可能"}
          </button>}
        </div>
        {!past && <p className="text-sm text-neutral-600">空いている時刻を押すと、その日だけの受付枠を追加できます。</p>}
        <BookingDayTimeline day={day} slots={[...daySlots.values()].filter(slot => !closed || timedBlocks.some(block => block.id === slot.id))}
          renderEmpty={time => {
            const startsAt = day + "T" + time + ":00+09:00";
            const start = Date.parse(startsAt);
            const end = start + duration * 60000;
            if (!calendarLoaded || past || closed || start <= Date.now() ||
              effectiveBlocks.some(block => overlaps(block, start, end)) ||
              activeEvents.some(event => event.kind !== "block" && overlaps(event, start, end))) return null;
            return <button type="button" disabled={disabled} className="flex w-full items-center gap-2 rounded py-1 text-left hover:bg-blue-50 disabled:opacity-50"
              aria-label={time + "の予約枠を追加"} onClick={() => void apply({ action: "slot",
                slot: { id: crypto.randomUUID(), starts_at: startsAt, duration_minutes: duration } })}><span className="w-12 tabular-nums">{time}</span><span className="text-blue-800 underline">枠を追加</span></button>;
          }} renderSlot={(slot, time) => {
            const end = new Date(Date.parse(slot.starts_at) + slot.duration_minutes * 60000);
            const nextDay = bookingDay(end.toISOString()) !== day ? "翌日 " : "";
            const label = time + "〜" + nextDay + bookingTime(end.getTime());
            const block = timedBlocks.find(entry => entry.id === slot.id);
            const manual = effectiveManual.some(entry => entry.id === slot.id);
            const available = availableIds.has(slot.id) || (pending?.action === "slot" && pending.slot.id === slot.id && !outsideWindow);
            if (!block && !manual && !available) return null;
            const off = Boolean(block) || !available;
            return <div key={slot.id} className="flex flex-wrap items-center gap-2">
              <span className="text-xs">〜{nextDay}{bookingTime(end.getTime())}{slot.channel === "phone" ? " 電話" : ""}</span>
              <button type="button" className={onOff(off)} disabled={disabled || past || Boolean(closed)}
                aria-label={label + (block ? "の予約不可を解除" : manual ? "の追加枠を解除" : "を予約不可にする")}
                onClick={() => block ? void apply({ action: "unblock", block }) :
                  manual ? void apply({ action: "close", id: slot.id }) : void blockRange(slot.starts_at, end.toISOString())}>
                {block ? "予約不可" : !available ? outsideWindow ? "受付期間前" : "受付停止中" : "予約可能"}
              </button>
            </div>;
          }} />
        {eventsOn(day).map((event, index) => <p key={index} className="text-sm">{formatEvent(event, day)} {event.label}</p>)}
        {!past && !closed && <details key={day} className="text-sm">
          <summary className="cursor-pointer">開始・終了時刻を指定して予約不可にする</summary>
          <form className="mt-2 grid gap-2" onSubmit={event => {
            event.preventDefault();
            if (!blockStart || !blockEnd) return;
            void blockRange(day + "T" + blockStart + ":00+09:00", day + "T" + blockEnd + ":00+09:00");
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
