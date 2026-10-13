"use client";
// src/components/parari/cpp/CppLiveProgramSetup.tsx / 2026-10-13 JST
// PART: Rehearsal program presets; controlled events remain development-only.
import Link from "next/link";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { plannedProgram, type ProgramInput } from "@/lib/parari/live/eventControl";
export default function CppLiveProgramSetup() {
  const [format, setFormat] = useState<"standard" | "first_night">("first_night");
  const [items, setItems] = useState<ProgramInput[]>(() => plannedProgram("first_night"));
  const [title, setTitle] = useState("CPP First Night 進行確認");
  const [lounge, setLounge] = useState(120);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [eventId, setEventId] = useState("");
  const lock = useRef(false);
  const total = items.reduce((sum, p) => sum + p.duration_seconds, 0) / 60 + lounge;
  const valid = title.trim().length > 0 && items.every(p => p.title.trim() && Number.isInteger(p.duration_seconds) && p.duration_seconds >= 1 && p.duration_seconds <= 7200)
    && Number.isInteger(lounge) && lounge >= 20 && total <= 720;
  async function create() {
    if (!supabase || lock.current || !valid) return;
    lock.current = true; setBusy(true); setError(""); setEventId("");
    try {
      const { data, error: e } = await supabase.rpc("cpp_live_create_controlled_test_event", { p_title: title.trim(), p_program: items, p_lounge_seconds: lounge * 60 }).abortSignal(AbortSignal.timeout(15000));
      if (e) setError(e.code === "PGRST202" ? "進行確認の準備がまだ完了していません。管理者にご確認ください。" : "作成できませんでした。プログラムの時間と管理者権限をご確認ください。");
      else setEventId(String(data));
    } catch { setError("作成結果を確認できませんでした。再作成する前に開催一覧をご確認ください。"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="mt-6 max-w-3xl space-y-4 rounded-2xl border border-indigo-200 bg-white p-6" aria-label="進行確認用イベントの作成">
    <h2 className="text-lg font-bold">STAGE・LOUNGEの進行確認</h2>
    <p className="text-sm text-neutral-600">開発用の会場を今から開きます。一般公開されず、共有URLを知るCPP登録者が参加できます。STAGE配信には、この環境での配信設定が必要です。</p>
    <label className="block text-sm font-semibold">形式 <select disabled={busy} value={format} onChange={e => {
      const next = e.target.value as typeof format; setFormat(next); setItems(plannedProgram(next)); setTitle(next === "first_night" ? "CPP First Night 進行確認" : "CPP LIVE 進行確認");
    }} className="ml-3 rounded-lg border p-2"><option value="first_night">CPP First Night</option><option value="standard">通常のCPP LIVE</option></select></label>
    <label className="block text-sm font-semibold">イベント名<input value={title} disabled={busy} onChange={e => setTitle(e.target.value)} maxLength={120} className="mt-2 w-full rounded-lg border p-2" /></label>
    <ol className="space-y-2">{items.map((item, index) => <li key={index} className="flex flex-wrap items-center gap-2">
      <label className="min-w-0 flex-1 text-xs">項目{index + 1}<input aria-label={`項目${index + 1}の名前`} disabled={busy} value={item.title} maxLength={120} onChange={e => setItems(old => old.map((p, i) => i === index ? { ...p, title: e.target.value } : p))} className="mt-1 w-full rounded-lg border p-2 text-sm" /></label>
      <label className="text-xs">予定分数<input aria-label={`項目${index + 1}の予定分数`} disabled={busy} type="number" min={1} max={120} value={item.duration_seconds / 60} onChange={e => setItems(old => old.map((p, i) => i === index ? { ...p, duration_seconds: Number(e.target.value) * 60 } : p))} className="mt-1 block w-20 rounded-lg border p-2 text-sm" /></label>
    </li>)}</ol>
    <label className="block text-sm font-semibold">自由交流（分）<input disabled={busy} type="number" min={20} max={600} value={lounge} onChange={e => setLounge(Number(e.target.value))} className="ml-3 w-24 rounded-lg border p-2" /></label>
    <p className="text-sm">合計 {Number.isFinite(total) ? total : "—"}分。各項目の時間は目安で、司会者が進行を切り替えます。</p>
    <p className="text-xs text-neutral-500">作成者が司会者になります。主催・請求先はCPPの開発用アカウントで、料金は未設定です。</p>
    <button type="button" disabled={!valid || busy} onClick={() => void create()} className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{busy ? "作成中…" : "進行確認用の会場を作る"}</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {eventId && <div className="space-y-2"><p className="break-all text-sm">共有URL：{typeof window !== "undefined" ? window.location.origin : ""}/my/cpp/live/room/{eventId}</p><Link className="inline-block rounded-full border px-5 py-3 text-sm font-bold" href={`/my/cpp/live/room/${eventId}`}>進行確認用の会場を開く →</Link></div>}
  </section>;
}
