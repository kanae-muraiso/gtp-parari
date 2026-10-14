"use client";
// src/components/parari/cpp/CppLiveHostPanel.tsx / 2026-10-13 JST
// PART: Explicit, versioned MC actions with recoverable server errors.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { phaseLabels, type LivePhase, type ManagedControl } from "@/lib/parari/live/eventControl";
import { stageRequest } from "@/lib/parari/live/stageClient";

type Action = { label: string; rpc: string; args: Record<string, unknown> };
const nextPhases: Partial<Record<LivePhase, { phase: LivePhase; label: string }>> = {
  waiting: { phase: "opening", label: "オープニングを始める" }, opening: { phase: "lounge", label: "自由交流を始める" },
  lounge: { phase: "closing_pending", label: "新規トーク受付を停止する" }, closing_pending: { phase: "closing", label: "クロージングを始める" },
  closing: { phase: "ended", label: "イベントを終了する" },
};
export default function CppLiveHostPanel({ control, userId, now, synced, refresh }: {
  control: ManagedControl; userId: string; now: number; synced: boolean; refresh: () => Promise<void>;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<{ user_id: string; display_name: string }[]>([]);
  const [nextHost, setNextHost] = useState("");
  useEffect(() => { setPending(null); setNextHost(""); }, [control.version]);
  useEffect(() => {
    if (!control.can_control || !supabase) return;
    let active = true;
    void supabase.rpc("cpp_live_event_host_candidates", { p_event_id: control.event_id }).then(({ data, error: e }) => {
      if (active) setCandidates(e ? [] : data ?? []);
    });
    return () => { active = false; };
  }, [control.event_id, control.host_user_id, control.can_control]);
  if ((!control.can_control && !control.can_take_over) || control.effective_phase === "ended") return null;
  const next = nextPhases[control.phase];
  const drainSeconds = control.media_drain_until ? Math.max(0, Math.ceil((Date.parse(control.media_drain_until) - now) / 1000)) : 0;
  const blocksClosing = (next?.phase === "closing" || next?.phase === "ended") && drainSeconds > 0;
  const current = control.program.find(p => p.id === control.current_item_id);
  const hasNext = current && control.program.some(p => p.stage_phase === current.stage_phase && p.position > current.position);
  function action(label: string, rpc: string, args: Record<string, unknown>) {
    setError(""); setPending({ label, rpc, args: { p_event_id: control.event_id, p_expected_version: control.version, ...args } });
  }
  async function commit() {
    if (!supabase || !pending || lock.current || !synced) return;
    lock.current = true; setBusy(true); setError("");
    try {
      let e;
      if (pending.rpc === "cpp_live_event_transition" || pending.rpc === "cpp_live_event_set_host") {
        await stageRequest(userId, { eventId: control.event_id, version: pending.args.p_expected_version,
          action: pending.rpc === "cpp_live_event_transition" ? "transition" : "handover", phase: pending.args.p_phase, targetId: pending.args.p_host_user_id });
      } else ({ error: e } = await supabase.rpc(pending.rpc, pending.args).abortSignal(AbortSignal.timeout(15000)));
      if (e) setError(e.code === "40001" ? "別の操作で進行が更新されました。現在の状態を確認してください。"
        : e.code === "55000" ? "まだ切り替えられません。会話の終了時刻と開催時間を確認してください。" : "操作できませんでした。司会者の権限と接続をご確認ください。");
      setPending(null); await refresh();
    } catch (e) { setPending(null); setError(e instanceof Error ? e.message : "操作結果を確認できません。状態を更新してから再度操作してください。"); await refresh(); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="mx-auto mb-5 max-w-6xl px-4" aria-label="司会者パネル">
    <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">司会者パネル</h2><p className="text-sm">現在：{phaseLabels[control.effective_phase]}</p></div>
      {control.can_control ? <>
        <p className="text-xs text-neutral-600">進行は司会者が操作します。予定時間を過ぎても自動では切り替わりません。</p>
        <div className="flex flex-wrap gap-3">
          {hasNext && <button type="button" disabled={busy || !synced} onClick={() => action("次のプログラム項目へ進む", "cpp_live_event_next_item", {})} className="rounded-full border bg-white px-4 py-2 text-sm disabled:opacity-50">次の項目へ</button>}
          {next && <button type="button" disabled={busy || !synced || blocksClosing} onClick={() => action(next.label, "cpp_live_event_transition", { p_phase: next.phase })} className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{next.label}</button>}
        </div>
        {(control.phase === "lounge" || control.phase === "closing_pending") && <p className="text-sm">進行中の会話：{control.active_call_count}組{drainSeconds > 0 ? ` · STAGE切り替えまで最長 ${Math.ceil(drainSeconds / 60)}分` : " · STAGEへ切り替え可能"}</p>}
        {control.phase === "closing_pending" && drainSeconds > 0 && <p className="text-xs text-neutral-600">途中退出した会話も、接続の有効時間が終わるまで待ちます。</p>}
        {candidates.some(c => c.user_id !== userId) && <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">司会の引き継ぎ先 <select value={nextHost} onChange={e => setNextHost(e.target.value)} className="ml-2 rounded-lg border bg-white p-2"><option value="">選択してください</option>{candidates.filter(c => c.user_id !== userId).map(c => <option key={c.user_id} value={c.user_id}>{c.display_name}</option>)}</select></label>
          <button type="button" disabled={!nextHost || busy || !synced} className="rounded-full border bg-white px-4 py-2 text-sm disabled:opacity-50" onClick={() => action("選択した方へ司会を引き継ぐ", "cpp_live_event_set_host", { p_host_user_id: nextHost })}>司会を引き継ぐ</button>
        </div>}
      </> : <><p className="text-sm">現在は別の司会者が進行しています。切断時などに管理者として引き継げます。</p>
        <button type="button" disabled={busy || !synced} className="rounded-full border bg-white px-4 py-2 text-sm disabled:opacity-50" onClick={() => action("自分が司会を引き継ぐ", "cpp_live_event_set_host", { p_host_user_id: userId })}>自分が司会を引き継ぐ</button></>}
      {pending && <div role="group" aria-label="進行操作の確認" className="space-y-3 rounded-lg border bg-white p-4">
        <p className="text-sm font-semibold">{pending.label}。よろしいですか？</p>
        {pending.args.p_phase === "closing_pending" && <p className="text-xs">新しい申し込みと承諾を停止します。進行中の会話は終了時刻まで続きます。</p>}
        <div className="flex gap-3"><button type="button" disabled={busy || !synced} onClick={() => void commit()} className="rounded-full bg-neutral-900 px-5 py-2 text-sm text-white disabled:opacity-50">{busy ? "更新中…" : "実行する"}</button><button type="button" disabled={busy} onClick={() => setPending(null)} className="rounded-full border px-5 py-2 text-sm">戻る</button></div>
      </div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  </section>;
}
