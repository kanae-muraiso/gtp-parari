"use client";
import Link from "next/link";
import { useParticipations } from "./ParticipationProvider";
import LearnerClassCalendar from "@/components/parari/manage/LearnerClassCalendar";

export default function MyClassCalendars() {
  const { items } = useParticipations();
  const classes = items.filter(item => item.key.startsWith("class:"));
  if (!classes.length) return null;
  return <section className="mt-5 grid gap-3" aria-label="所属先のクラス予定">
    <h2 className="font-bold">所属先のクラス予定</h2>
    {classes.map(item => <details key={item.key} className="rounded-xl border p-3">
      <summary className="cursor-pointer font-semibold">{item.name}</summary>
      <div className="mt-3 grid gap-3"><Link className="text-sm underline" href={item.href}>受講者ページ・欠席連絡・振替へ</Link>
        <LearnerClassCalendar schoolId={item.key.slice(6)} refresh={0} />
      </div>
    </details>)}
  </section>;
}
