"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParticipations } from "@/components/parari/navigation/ParticipationProvider";
import { classRequest } from "@/lib/classRequests";
import { classBusinessFrontPath, classParticipationFormats, type ClassBusinessFrontLink, type ClassParticipationFormat } from "@/lib/classBusinessFront";
import { classEventDate } from "@/lib/classEvents";
import { classWeekdays } from "@/lib/classRecurrence";
import ClassBusinessFrontAction from "./ClassBusinessFrontAction";

type Visit = { class_id: string; visit_on: string; surcharge_yen: number; surcharge_paid_at: string | null; makeup_id: string | null };
type Member = { userId: string; enrolled: boolean; fixed: string[]; visits: Visit[] };
type Action = "fixed" | "reserve" | "cancel";
const button = "w-fit rounded-md border border-neutral-300 bg-white px-3 py-1.5 font-medium text-neutral-900 hover:border-neutral-600 disabled:opacity-50";
const yen = (fee: number) => fee.toLocaleString("ja-JP") + "円";

export default function ClassBusinessFrontView({ name, introduction, links, schoolId }: {
  name: string; introduction: string; links: ClassBusinessFrontLink[]; schoolId?: string;
}) {
  const { userId, loading } = useParticipations();
  const path = schoolId ? "/front-participation?school=" + schoolId : "";
  const [result, setResult] = useState<{ path: string; member: Member } | null>(null);
  const member = result?.path === path && result.member.userId === userId ? result.member : null;
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!path || !userId) return;
    const request = new AbortController();
    classRequest<Member>(path, undefined, request.signal).then(member => {
      setResult({ path, member });
      setLoadError(false);
    }).catch(() => {
      if (!request.signal.aborted) setLoadError(true);
    });
    return () => request.abort();
  }, [path, userId, attempt]);

  async function choose(action: Action, classId: string, day?: string) {
    setPending(true);
    setMessage("");
    try {
      await classRequest(path, { action, classId, day });
      setResult({ path, member: await classRequest<Member>(path) });
      setMessage({ fixed: "通う枠を登録しました。", reserve: "予約しました。", cancel: "予約を取り消しました。" }[action]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "参加状況を更新できませんでした。");
    } finally {
      setPending(false);
    }
  }

  const other = links.filter(link => !link.format);
  return <article className="mx-auto grid w-full max-w-2xl gap-7">
    <header className="grid gap-4 border-b border-neutral-200 pb-6">
      <h1 className="break-words text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl">{name}</h1>
      {introduction && <p className="whitespace-pre-wrap break-words text-base leading-8 text-neutral-700">{introduction}</p>}
      {schoolId && <ClassBusinessFrontAction schoolId={schoolId} hasIntake={!member?.enrolled && other.length > 0} />}
      {schoolId && !loading && !userId && links.some(link => link.course && !link.course.walkIn) &&
        <Link href={"/login?returnTo=" + encodeURIComponent(classBusinessFrontPath(schoolId))}
          className="w-fit text-sm font-medium underline">入会済みの方はログイン</Link>}
      {path && userId && loadError && <div className="text-sm">
        参加状況を確認できませんでした。 <button type="button" className="underline" onClick={() => setAttempt(attempt + 1)}>再読み込み</button>
      </div>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </header>
    {(Object.keys(classParticipationFormats) as ClassParticipationFormat[]).map(format => {
      const entries = links.filter(link => link.format === format);
      return entries.length > 0 && <section key={format} aria-label={classParticipationFormats[format]} className="grid gap-3">
        <h2 className="text-xl font-semibold">{classParticipationFormats[format]}</h2>
        <ul className="grid gap-3">
          {entries.map(link => <li key={link.key} className="grid gap-2 rounded-xl border border-neutral-200 bg-white p-4">
            <div className="grid gap-1">
              <h3 className="break-words font-semibold">{link.title}</h3>
              {link.startsAt && <p className="text-sm text-neutral-700">{link.label} · {classEventDate(link.startsAt)}</p>}
              {link.course?.description && <p className="whitespace-pre-wrap break-words text-sm text-neutral-700">{link.course.description}</p>}
              {link.course?.explanation && <p className="text-sm text-neutral-700">{link.course.explanation}</p>}
            </div>
            {link.course?.slots.map(slot => <div key={slot.id} className="grid gap-1 border-t pt-2 text-sm">
              {slot.name !== link.title && <p className="font-medium">{slot.name}</p>}
              <p>{slot.schedule}{slot.location ? " · " + slot.location : ""}{slot.fee == null ? "" :
                " · " + (link.course?.walkIn ? "1回 " : "月謝 ") + yen(slot.fee)}</p>
              {format === "fixed" && member?.enrolled && (
                member.fixed.includes(slot.id) ? <p className="font-semibold text-emerald-800">登録済み</p> :
                  !link.course?.slots.some(other => member.fixed.includes(other.id)) &&
                    <button type="button" className={button} disabled={pending}
                      onClick={() => void choose("fixed", slot.id)}>この枠に通う</button>
              )}
              {slot.upcoming?.length ? <ul className="grid gap-1 text-neutral-600">{slot.upcoming.map(day => {
                const date = new Date(day.day + "T00:00:00Z");
                const visit = member?.visits.find(visit => visit.class_id === slot.id && visit.visit_on === day.day);
                const canReserve = format === "open" && !link.course?.walkIn && member?.enrolled &&
                  Date.parse(day.day + "T" + day.time + "+09:00") > Date.now() &&
                  Date.parse(day.day + "T00:00+09:00") <= Date.now() + 42 * 86400000;
                return <li key={day.day} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                  {date.getUTCMonth() + 1}/{date.getUTCDate()}（{classWeekdays[date.getUTCDay()]}）{day.time}
                  {day.location && day.location !== slot.location ? " · " + day.location : ""}
                  {day.fee != null && day.fee !== slot.fee ? " · " + yen(day.fee) : ""}
                  {!day.confirmed && <span className="ml-2 text-xs">予定</span>}
                  </span>
                  {visit ? <>
                    <span className="font-medium text-emerald-800">予約済み</span>
                    {visit.surcharge_yen > 0 && <span>差額 {yen(visit.surcharge_yen)}{visit.surcharge_paid_at ? "（支払済み）" : ""}</span>}
                    {!visit.surcharge_paid_at && !visit.makeup_id &&
                      <button type="button" className={button} disabled={pending}
                        onClick={() => void choose("cancel", slot.id, day.day)}>取消</button>}
                  </> : canReserve &&
                    <button type="button" className={button} disabled={pending}
                      onClick={() => void choose("reserve", slot.id, day.day)}>この回を予約</button>}
                </li>;
              })}</ul> : <p className="text-neutral-600">今月・来月の開催予定はありません。</p>}
            </div>)}
            {link.href && <Link href={link.href} prefetch={false} className="w-fit text-sm font-medium underline">
              {link.course ? "詳しい日程を見る" : "開催案内を見る"}
            </Link>}
          </li>)}
        </ul>
      </section>;
    })}
    {other.length > 0 && <nav id="class-business-intake" aria-label="入会・体験のご案内">
      <h2 className="mb-3 text-xl font-semibold">入会・体験のご案内</h2>
      <ul className="grid gap-3">
        {other.map(link => link.href && <li key={link.key}>
          <Link href={link.href} prefetch={false}
            className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 hover:border-neutral-500">
            <span className="min-w-0 break-words">
              {link.title !== link.label && <span className="block text-xs text-neutral-600">{link.label}</span>}
              <span className="font-semibold">{link.title}</span>
            </span>
            <span aria-hidden="true" className="shrink-0">→</span>
          </Link>
        </li>)}
      </ul>
    </nav>}
  </article>;
}
