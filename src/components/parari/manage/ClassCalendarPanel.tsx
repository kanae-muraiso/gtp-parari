"use client";

import { useEffect, useState } from "react";
import type { SchoolClass } from "@/lib/classes";
import { classRequest } from "@/lib/classRequests";
import { calendarMonthPattern, classCalendarToday, generateClassDays, shiftCalendarMonth, type ClassMonthSchedule } from "@/lib/classCalendar";
import ClassMonthGrid from "./ClassMonthGrid";

const button = "w-fit rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-50";
const primary = "w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";

export default function ClassCalendarPanel({ classes }: { classes: SchoolClass[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [month, setMonth] = useState(() => shiftCalendarMonth(classCalendarToday().slice(0, 7), 1));
  const item = classes.find(row => row.id === classId);
  return <section className="grid gap-4 rounded-2xl border bg-white p-5">
    <h2 className="text-xl font-bold">開催予定</h2>
    {!item ? <p className="text-sm">開催枠を登録すると、年間予定を作れます。</p> : <>
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-sm">開催枠<select className={button} value={classId} onChange={e => setClassId(e.target.value)}>
          {classes.map(row => <option value={row.id} key={row.id}>{row.productName ? row.productName + " · " : ""}{row.name}</option>)}
        </select></label>
        <label className="grid gap-1 text-sm">対象月<input className={button} type="month" value={month}
          onChange={e => { if (calendarMonthPattern.test(e.target.value)) setMonth(e.target.value); }} /></label>
      </div>
      <CalendarEditor key={classId + month} item={item} month={month} />
    </>}
  </section>;
}

function CalendarEditor({ item, month }: { item: SchoolClass; month: string }) {
  const [schedule, setSchedule] = useState<ClassMonthSchedule | null>();
  const [days, setDays] = useState<string[]>([]);
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
        setDays(result.schedule?.days ?? generateClassDays(item, month, false));
      }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [item, month, path, refresh]);

  async function update(action: "generate" | "save", confirmed = false) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await classRequest<{ schedule?: ClassMonthSchedule; created?: number }>(path, {
        action, month, skipFifth, days, confirmed, revision: schedule?.revision ?? null,
      });
      if (result.schedule) {
        setSchedule(result.schedule);
        setDays(result.schedule.days);
        setNotice(confirmed ? "この月の開催日を確定しました。" : "開催予定を保存しました。");
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
      <p className="text-sm"><strong>{schedule?.confirmed ? "確定済み" : schedule ? "予定" : "未登録"}</strong> · 開催日 {days.length}回。日付を押して開催日を選びます。</p>
      <ClassMonthGrid month={month} cell={day => {
        const selected = days.includes(day);
        return <button type="button" aria-label={day + (selected ? " 開催日" : " 休み")} aria-pressed={selected}
          disabled={busy || day < item.starts_on} className={`min-h-10 w-full rounded border text-sm disabled:opacity-40 ${selected ? "border-blue-700 bg-blue-700 text-white" : "bg-white"}`}
          onClick={() => setDays(current => selected ? current.filter(value => value !== day) : [...current, day].sort())}>{Number(day.slice(-2))}</button>;
      }} />
      <div className="flex flex-wrap gap-2">
        {!schedule?.confirmed && <button type="button" className={button} disabled={busy} onClick={() => void update("save")}>予定として保存</button>}
        <button type="button" className={primary} disabled={busy} onClick={() => void update("save", true)}>
          {schedule?.confirmed ? "確定済みの予定を更新" : "この月を確定"}
        </button>
      </div>
    </> : !error && <p role="status" className="text-sm">開催予定を読み込んでいます…</p>}
  </>;
}
