"use client";
import { useEffect, useState } from "react";
import { classRequest } from "@/lib/classRequests";
import type { SchoolClass } from "@/lib/classes";
import { classCalendarToday, isScheduledClassDay } from "@/lib/classCalendar";
type Data = { owner: boolean; reports: { enrollment_id: string; class_id: string; lesson_date: string; absence_reported: boolean }[]; roster: { id: string; name: string }[]; reportableClassIds: string[] };
export default function ClassAbsencesPanel({ schoolId, memberId, classes, calendarDays, startsOn, onChanged }: {
  schoolId: string; memberId?: string | null; classes: SchoolClass[]; calendarDays?: Record<string,string[]>; startsOn?: string | null; onChanged?: () => void;
}) {
  const [data, setData] = useState<Data>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const path = `/attendance?school=${schoolId}${memberId ? "&member=" + memberId : ""}`;
  useEffect(() => { const controller = new AbortController(); void classRequest<Data>(path, undefined, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
    .catch(cause => { if (!controller.signal.aborted) setError(cause.message); }); return () => controller.abort(); }, [path, refresh]);
  const today = classCalendarToday();
  const days = Array.from({ length: 43 }, (_, offset) => new Date(Date.parse(today) + offset * 86400000).toISOString().slice(0, 10));
  return <section className="grid gap-3 rounded-xl border bg-white p-4" aria-label="欠席連絡">
    <h3 className="font-semibold">欠席連絡</h3>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">連絡を確認しています…</p>}
    {data?.owner ? <>{data.reports.filter(report => report.absence_reported).map(report => <p className="text-sm" key={`${report.enrollment_id}-${report.class_id}-${report.lesson_date}`}>
      {report.lesson_date} · {classes.find(item => item.id === report.class_id)?.name} · {data.roster.find(item => item.id === report.enrollment_id)?.name}さん：欠席連絡あり
    </p>)}{!data.reports.some(report => report.absence_reported) && <p className="text-sm">欠席の連絡はありません。</p>}</> : data && <>
      <p className="text-sm">いつも通うクラスをお休みする場合にご連絡ください。振替の条件はクラスの設定に従います。</p>
      {classes.filter(item => data.reportableClassIds.includes(item.id)).map(item => <details key={item.id} className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium">{item.productName ? item.productName + " · " : ""}{item.name}</summary>
        <div className="mt-3 grid gap-2">{days.filter(day => (!startsOn || day >= startsOn) && isScheduledClassDay(item, day, calendarDays) && Date.parse(day + "T" + item.starts_at.slice(0,5) + ":00+09:00") > Date.now()).map(day => {
          const absent = data.reports.some(report => report.class_id === item.id && report.lesson_date === day && report.absence_reported);
          return <div key={day} className="flex items-center justify-between gap-2"><span>{day} {item.starts_at.slice(0,5)}</span>
            <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={async () => { setBusy(true); setError(""); try {
              await classRequest(path, { classId: item.id, day, absent: !absent }); setRefresh(value => value+1); onChanged?.();
            } catch(cause) { setError(cause instanceof Error ? cause.message : "更新できませんでした。"); } finally { setBusy(false); } }}>
              {absent ? "欠席連絡済み・取り消す" : "欠席を連絡"}
            </button></div>;
        })}</div>
      </details>)}
      {!data.reportableClassIds.length && <p className="text-sm">都度予約のクラスは、予約済みの回から取り消してください。</p>}
    </>}
  </section>;
}
