"use client";
// src/components/parari/cpp/CppLiveStage.tsx / 2026-10-13 JST
// PART: Shared waiting/STAGE/ended surface; media is deliberately introduced in step 2.
import Link from "next/link";
import { phaseLabels, type ManagedControl } from "@/lib/parari/live/eventControl";

export default function CppLiveStage({ control, now }: { control: ManagedControl; now: number }) {
  const phase = control.effective_phase;
  const item = control.program.find(p => p.id === control.current_item_id);
  const elapsed = control.item_started_at ? Math.max(0, Math.floor((now - Date.parse(control.item_started_at)) / 1000)) : 0;
  return <section className="mx-auto max-w-6xl space-y-5 px-4 pb-8" aria-label="STAGE">
    <div className="rounded-2xl bg-neutral-900 p-6 text-white sm:p-10">
      <p className="text-xs font-bold tracking-widest">CPP LIVE · {phase === "ended" ? "FINISHED" : "STAGE"}</p>
      <h2 tabIndex={-1} className="mt-3 text-2xl font-bold" aria-live="polite">{phaseLabels[phase]}</h2>
      {phase === "waiting" ? <p className="mt-4 text-sm text-neutral-200">司会者の開始をお待ちください。</p>
        : phase === "ended" ? <><p className="mt-4">ご参加ありがとうございました。</p><Link className="mt-5 inline-block rounded-full border px-5 py-2 text-sm" href="/my/cpp/live/history">会話履歴を見る</Link></>
        : <><h3 className="mt-6 text-xl font-semibold">{item?.title ?? "司会者の案内をお待ちください"}</h3>
          {item && <p className="mt-3 text-sm text-neutral-200">予定 {item.duration_seconds / 60}分 · 経過 {Math.floor(elapsed / 60)}分{elapsed % 60}秒{elapsed > item.duration_seconds ? "（予定時間を過ぎています）" : ""}</p>}
          <p className="mt-8 rounded-xl border border-neutral-700 p-4 text-sm text-neutral-200">映像・音声配信は準備中です。現在はイベント進行の確認用画面です。</p></>}
    </div>
    {phase !== "ended" && <details className="rounded-xl border bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold">プログラムを見る</summary>
      <ol className="mt-4 space-y-2">{control.program.map(p => <li key={p.id} aria-current={p.id === control.current_item_id ? "step" : undefined}
        className={`flex justify-between gap-4 rounded-lg p-2 text-sm ${p.id === control.current_item_id ? "bg-indigo-50 font-bold" : ""}`}>
        <span>{p.title}</span><span className="shrink-0 text-neutral-500">{p.duration_seconds / 60}分</span>
      </li>)}</ol>
    </details>}
  </section>;
}
