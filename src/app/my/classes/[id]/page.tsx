"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ClassDailyPanel from "@/components/parari/manage/ClassDailyPanel";
import MyAreaHeader from "@/components/parari/navigation/MyAreaHeader";
import MyPrimaryTabs from "@/components/parari/navigation/MyPrimaryTabs";
import { useParticipations } from "@/components/parari/navigation/ParticipationProvider";
import { classRequest, ClassRequestError } from "@/lib/classRequests";
import { classSchedule, type ClassSchool } from "@/lib/classes";

export default function MyClassSchoolPage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useParticipations();
  const [result, setResult] = useState<{ id: string; userId: string | null; school?: ClassSchool; status?: number; error?: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void classRequest<{ school: ClassSchool; userId: string }>(`?school=${encodeURIComponent(id)}`, undefined, controller.signal)
      .then(({ school, userId: owner }) => {
        if (!controller.signal.aborted) setResult({ id, userId: owner, school });
      }).catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ id, userId, status: cause instanceof ClassRequestError ? cause.status : 500,
          error: cause instanceof Error ? cause.message : "教室を取得できませんでした。" });
      });
    return () => controller.abort();
  }, [id, userId]);

  const current = result?.id === id && result.userId === userId ? result : null;
  return <main className="min-h-screen bg-neutral-100">
    <div className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-6">
      <MyAreaHeader title="クラス" area="library" navigation={<MyPrimaryTabs active={null} embedded />} />
      <section className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-5">
        {current?.school ? <>
          <h2 className="text-xl font-bold">{current.school.name}</h2>
          {current.school.classes.length === 0 && <p>参加できるクラスはありません。</p>}
          {current.school.classes.map(item => <article className="rounded-xl border border-neutral-200 p-4" key={item.id}>
            <h3 className="font-bold">{item.name}</h3>
            <p className="mt-1 text-sm">{classSchedule(item)}</p>
            {item.location && <p className="mt-1 text-sm">{item.location}</p>}
          </article>)}
        </> : <p role={current?.error ? "alert" : "status"}>{current?.error ?? "教室を読み込んでいます…"}</p>}
        {current?.status === 401 && <Link className="underline" href={`/login?returnTo=${encodeURIComponent(`/my/classes/${id}`)}`}>ログイン</Link>}
      </section>
      {current?.school?.classes.map(item => <ClassDailyPanel key={item.id} schoolId={id} item={item} userId={current.userId!} />)}
    </div>
  </main>;
}
