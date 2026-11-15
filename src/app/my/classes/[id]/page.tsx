"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import { useParticipations } from "@/components/parari/navigation/ParticipationProvider";
import { classRequest, ClassRequestError } from "@/lib/classRequests";
import { classMeetingUrl, classSchedule, classRunsOn, type ClassSchool, type ClassVisits } from "@/lib/classes";

export default function MyClassSchoolPage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useParticipations();
  const [result, setResult] = useState<{ id: string; userId: string | null; school?: ClassSchool; visits?: ClassVisits | null; status?: number; error?: string } | null>(null);

  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void classRequest<{ school: ClassSchool; userId: string; visits: ClassVisits | null }>(`?school=${encodeURIComponent(id)}`, undefined, controller.signal)
      .then(({ school, userId: owner, visits }) => {
        if (!controller.signal.aborted) setResult({ id, userId: owner, school, visits });
      }).catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ id, userId, status: cause instanceof ClassRequestError ? cause.status : 500,
          error: cause instanceof Error ? cause.message : "教室を取得できませんでした。" });
      });
    return () => controller.abort();
  }, [id, userId, refresh]);

  async function reserve(classId: string, day: string, cancel: boolean) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await classRequest("", { action: "visit", schoolId: id, classId, day, cancel });
      setRefresh(value => value + 1);
      setNotice(cancel ? "予約を取り消しました。" : "予約しました。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "予約を更新できませんでした。");
    } finally { setBusy(false); }
  }

  const current = result?.id === id && result.userId === userId ? result : null;
  const now = Date.now();
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const dates = Array.from({ length: 43 }, (_, offset) => new Date(Date.parse(today) + offset * 86400000).toISOString().slice(0, 10));
  return <main className="min-h-screen bg-neutral-100">
    <div className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-6">
      <MyAreaHeader title="クラス" area="library" navigation={<MyPrimaryTabs active={null} embedded />} />
      <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        {current?.school ? <>
          <h2 className="text-xl font-bold">{current.school.name}</h2>
          {notice && <p role="status" className="text-sm">{notice}</p>}
          {current.visits?.flexible && <p className="text-sm">対象クラスを横断して月{current.visits.monthlyVisits}回まで予約できます。</p>}
          {current.school.classes.length === 0 && <p>参加できるクラスはありません。</p>}
          {current.school.classes.map(item => <article className="rounded-xl border border-neutral-200 p-4" key={item.id}>
            <h3 className="font-bold">{item.name}</h3>
            <p className="mt-1 text-sm">{classSchedule(item)}</p>
            {item.delivery !== "onsite" && classMeetingUrl(item.meeting_url) && <a
              className="mt-3 inline-flex rounded-lg bg-blue-800 px-4 py-2 text-sm text-white"
              href={classMeetingUrl(item.meeting_url)!} target="_blank" rel="noreferrer">オンライン授業に参加</a>}
            {item.location && <p className="mt-1 text-sm">{item.location}</p>}
            {current.visits?.flexible && current.visits.classIds.includes(item.id) && <details className="mt-2 text-sm">
              <summary className="cursor-pointer">開催日を予約する</summary>
              <div className="mt-2 grid gap-2">
                {dates.filter(day => classRunsOn(item, day) && Date.parse(day + "T" + item.starts_at.slice(0, 5) + ":00+09:00") > now)
                  .map(day => {
                    const booked = current.visits?.booked.some(visit => visit.class_id === item.id && visit.visit_on === day);
                    return <div key={day} className="flex items-center justify-between gap-2">
                      <span>{day} {item.starts_at.slice(0, 5)}（日本時間）</span>
                      <button type="button" disabled={busy} className="rounded border px-3 py-2"
                        onClick={() => void reserve(item.id, day, Boolean(booked))}>{booked ? "予約済み・取消" : "予約する"}</button>
                    </div>;
                  })}
              </div>
            </details>}
          </article>)}
        </> : <p role={current?.error ? "alert" : "status"}>{current?.error ?? "教室を読み込んでいます…"}</p>}
        {current?.status === 401 && <Link className="underline" href={`/login?returnTo=${encodeURIComponent(`/my/classes/${id}`)}`}>ログイン</Link>}
      </section>
    </div>
  </main>;
}
