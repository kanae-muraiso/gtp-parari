"use client";

import { useEffect, useState } from "react";
import type { SchoolClass } from "@/lib/classes";
import { classRequest } from "@/lib/classRequests";
import { calendarMonthPattern, classCalendarToday, generateClassDays, shiftCalendarMonth, type ClassMonthSchedule } from "@/lib/classCalendar";
import ClassMonthGrid from "./ClassMonthGrid";

const button = "w-fit rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-50";
const primary = "w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";

export default function ClassCalendarPanel({ classes, selectedClass }: { classes: SchoolClass[]; selectedClass?: SchoolClass }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [month, setMonth] = useState(() => shiftCalendarMonth(classCalendarToday().slice(0, 7), selectedClass ? 0 : 1));
  const item = selectedClass ?? classes.find(row => row.id === classId);
  return <section className={selectedClass ? "grid gap-4 border-t border-neutral-200 pt-4" : "grid gap-4 rounded-2xl border bg-white p-5"}>
    {selectedClass ? <h4 className="font-semibold">開催予定・休講</h4> : <h2 className="text-xl font-bold">開催予定</h2>}
    {!item ? <p className="text-sm">開催枠を登録すると、年間予定を作れます。</p> : <>
      <div className="flex flex-wrap gap-3">
        {!selectedClass && <label className="grid gap-1 text-sm">開催枠<select className={button} value={classId} onChange={e => setClassId(e.target.value)}>
          {classes.map(row => <option value={row.id} key={row.id}>{row.productName ? row.productName + " · " : ""}{row.name}</option>)}
        </select></label>}
        <label className="grid gap-1 text-sm">対象月<input className={button} type="month" value={month}
          onChange={e => { if (calendarMonthPattern.test(e.target.value)) setMonth(e.target.value); }} /></label>
      </div>
      <CalendarEditor key={item.id + month} item={item} month={month} />
    </>}
  </section>;
}

function CalendarEditor({ item, month }: { item: SchoolClass; month: string }) {
  const [schedule, setSchedule] = useState<ClassMonthSchedule | null>();
  const [selectedDay, setSelectedDay] = useState("");
  const days = schedule?.days ?? generateClassDays(item, month, false);
  const regularDays = generateClassDays(item, month, false);
  const [skipFifth, setSkipFifth] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const path = `/schedule?class=${item.id}&month=${month}`;
  useEffect(() => {
    const controller = new AbortController();
    void classRequest<{ schedule: ClassMonthSchedule | null }>(path, undefined, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setSchedule(result.schedule);
      }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [item, month, path, refresh]);

  async function update(action: "generate" | "save", confirmed = false, nextDays = days, success?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await classRequest<{ schedule?: ClassMonthSchedule; created?: number }>(path, {
        action, month, skipFifth, days: nextDays, confirmed, revision: schedule?.revision ?? null,
      });
      if (result.schedule) {
        setSchedule(result.schedule);
        setNotice(success ?? "この月の開催日を確定しました。");
      } else {
        setSchedule(undefined);
        setRefresh(value => value + 1);
        setNotice(result.created ? `新しく${result.created}か月分の予定を作成しました。` : "対象の12か月は登録済みです。");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "開催予定を保存できませんでした。");
    } finally { setBusy(false); }
  }

  return <>
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-semibold">12か月分の予定を作る</summary>
      <div className="mt-3 grid gap-3">
        <p>選んだ月から12か月分を、開催枠の曜日・頻度に沿って作ります。</p>
        {item.cadence === "weekly" && <label className="flex items-center gap-2"><input type="checkbox" checked={skipFifth}
          onChange={e => setSkipFifth(e.target.checked)} />各月の第5回は休み</label>}
        <button type="button" className={button} disabled={busy} onClick={() => void update("generate")}>予定をまとめて作成</button>
      </div>
    </details>
    {error && <p role="alert" className="text-sm text-red-700">{error}
      <button type="button" className="ml-2 underline" disabled={busy} onClick={() => { setError(""); setRefresh(value => value + 1); }}>再読み込み</button></p>}
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    {schedule !== undefined ? <>
      <p className="text-sm"><strong>{schedule?.confirmed ? "確定済み" : schedule ? "予定" : "定期開催の設定を表示中"}</strong> · 開催日 {days.length}回。日付を選ぶと開催・休講を切り替えられます。</p>
      <ClassMonthGrid month={month} cell={day => {
        const held = days.includes(day);
        const cancelled = !held && regularDays.includes(day);
        return <button type="button" aria-label={day + (held ? " 開催" : cancelled ? " 休講" : " 開催なし")}
          aria-pressed={selectedDay === day} disabled={busy || day < item.starts_on}
          className={`min-h-10 w-full rounded border py-1 text-sm disabled:opacity-40 ${selectedDay === day ? "ring-2 ring-blue-800" : ""} ${held ? "bg-blue-50 text-blue-900" : cancelled ? "bg-neutral-100 text-neutral-700" : "bg-white"}`}
          onClick={() => setSelectedDay(day)}>
          {Number(day.slice(-2))}
          {(held || cancelled) && <span className="block text-xs">{held ? "開催" : "休講"}</span>}
        </button>;
      }} />
      {selectedDay && <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-neutral-50 px-3 py-2 text-sm">
        <strong>{Number(selectedDay.slice(5, 7))}月{Number(selectedDay.slice(-2))}日</strong>
        <button type="button" className={button} disabled={busy}
          aria-label={days.includes(selectedDay) ? "開催を休講にする" : "この日を開催日にする"}
          onClick={() => {
            const held = days.includes(selectedDay);
            const nextDays = held ? days.filter(day => day !== selectedDay) : [...days, selectedDay].sort();
            void update("save", schedule?.confirmed ?? false, nextDays, held ? "休講にしました。" : "開催日にしました。");
          }}>{days.includes(selectedDay) ? "開催 → 休講にする" : regularDays.includes(selectedDay) ? "休講 → 開催に戻す" : "この日に開催する"}</button>
      </div>}
      {!schedule?.confirmed && <button type="button" className={primary} disabled={busy} onClick={() => void update("save", true)}>
        この月を確定
      </button>}
    </> : !error && <p role="status" className="text-sm">開催予定を読み込んでいます…</p>}
  </>;
}
