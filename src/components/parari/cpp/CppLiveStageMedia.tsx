"use client";
// 2026-10-13 JST / PART: Explicit receive-first STAGE; Daily Prebuilt owns device controls.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { ManagedControl } from "@/lib/parari/live/eventControl";
import { stageRequest } from "@/lib/parari/live/stageClient";
type Role = "host" | "presenter" | "questioner" | "viewer";
type State = { room_id: string | null; closing: boolean; role: Role; ticket_id: string | null; hand_raised: boolean;
  people: { user_id: string; display_name: string; role: Role; hand_raised: boolean; present?: boolean }[] };
const labels: Record<Role, string> = { host: "司会者", presenter: "講演者", questioner: "質問者", viewer: "視聴者" };
export default function CppLiveStageMedia({ control, userId, refresh }: {
  control: ManagedControl; userId: string; refresh: () => Promise<void>;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const attempt = useRef(0);
  const connected = useRef<{ ticketId: string; role: Role } | null>(null);
  const mounted = useRef(true);
  const actionLock = useRef(false);
  const joining = useRef(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [connection, setConnection] = useState<"idle" | "joining" | "open">("idle");
  const [frame, setFrame] = useState<{ url: string; role: Role; generation: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState("");
  const stop = useCallback(() => {
    attempt.current++; connected.current = null; joining.current = false;
    // Navigate the browsing context away synchronously; React removes it next.
    // This needs no SDK leave acknowledgement from an already removed iframe.
    if (iframe.current) iframe.current.src = "about:blank";
    if (mounted.current) { setFrame(null); setConnection("idle"); }
  }, []);
  const loadState = useCallback(async () => {
    const { data, error: e } = await supabase!.rpc("cpp_live_stage_state", { p_event_id: control.event_id }).abortSignal(AbortSignal.timeout(12000));
    if (e || !data || !Object.hasOwn(labels, data.role) || !Array.isArray(data.people)) throw new Error("登壇状態を確認できません。再接続してください。");
    return data as State;
  }, [control.event_id]);
  useEffect(() => {
    mounted.current = true; let active = true; let loading = false; let available = false;
    const abort = new AbortController();
    async function poll() {
      if (loading) return; loading = true;
      try {
        const next = await loadState();
        if (!active) return;
        setState(next);
        const current = connected.current;
        if (next.closing || (current && (next.ticket_id !== current.ticketId || next.role !== current.role))) {
          stop(); setError(next.closing ? "STAGEの切り替え中です。司会者の案内をお待ちください。" : "登壇権限が変わりました。下のボタンで接続し直してください。");
        }
      } catch {
        if (active) { setState(null); stop(); setError("登壇状態を確認できません。接続を確認し、再接続してください。"); }
      } finally { loading = false; }
    }
    void fetch("/api/parari/live/cpp/stage", { cache: "no-store", signal: abort.signal }).then(async r => {
      if (!r.ok) throw new Error(); const data = await r.json();
      if (active) { available = data.enabled === true; setEnabled(available); if (available) await poll(); }
    }).catch(() => { if (active) { setEnabled(false); setError("配信設定を確認できません。会場を開き直してください。"); } });
    const timer = window.setInterval(() => { if (active && available) void poll(); }, 5000);
    const onFocus = () => { if (active && available) void poll(); };
    window.addEventListener("focus", onFocus); window.addEventListener("online", onFocus); window.addEventListener("pagehide", stop);
    return () => { active = false; mounted.current = false; abort.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); window.removeEventListener("pagehide", stop); stop(); };
  }, [loadState, stop]);
  async function join() {
    if (!enabled || joining.current || actionLock.current) return;
    stop(); joining.current = true; const generation = attempt.current; setError(""); setConnection("joining");
    const current = () => mounted.current && generation === attempt.current;
    try {
      const result = await stageRequest(userId, { action: "join", eventId: control.event_id });
      const url = new URL(result.roomUrl);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".daily.co") || url.username || url.password
        || url.search || url.hash || Date.parse(result.expiresAt) <= Date.now() || !Object.hasOwn(labels, result.role)) throw new Error("配信接続を確認できません。");
      const next = await loadState();
      if (!current()) return;
      setState(next);
      if (next.closing || next.ticket_id !== result.ticketId || next.role !== result.role) { stop(); setError("登壇権限が変わりました。再接続してください。"); return; }
      url.searchParams.set("t", result.token);
      // Room/token settings enforce initial audio/video OFF and disable prejoin activation.
      // Prebuilt owns playback/device error UI; an open frame does not assert successful media.
      joining.current = false; connected.current = { ticketId: result.ticketId, role: result.role };
      setFrame({ url: url.toString(), role: result.role, generation }); setConnection("open");
    } catch (e) {
      if (current()) { stop(); setError(e instanceof Error ? e.message : "接続できませんでした。"); }
    }
  }
  async function hand() {
    if (!state || actionLock.current) return;
    actionLock.current = true; setBusy(true); setError("");
    try {
      const { error: e } = await supabase!.rpc("cpp_live_stage_hand", { p_event_id: control.event_id, p_raised: !state.hand_raised }).abortSignal(AbortSignal.timeout(12000));
      if (e) throw new Error(); const next = await loadState(); if (mounted.current) setState(next);
    } catch { if (mounted.current) setError("質問の希望を更新できませんでした。接続後に再試行してください。"); }
    finally { actionLock.current = false; if (mounted.current) setBusy(false); }
  }
  async function grant(role: "viewer" | "presenter" | "questioner") {
    if (!target || actionLock.current) return;
    actionLock.current = true; setBusy(true); setError("");
    try {
      await stageRequest(userId, { action: "role", eventId: control.event_id, version: control.version, targetId: target, role });
      const next = await loadState(); if (mounted.current) setState(next);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "登壇操作を完了できませんでした。"); }
    finally { await refresh(); actionLock.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="mt-6 space-y-4 rounded-xl bg-white p-4 text-neutral-900" aria-label="STAGE配信">
    <p className="text-sm">{enabled === null ? "配信設定を確認しています…" : !enabled ? "この環境ではSTAGE配信はまだ有効になっていません。" : `あなたは${labels[state?.role ?? "viewer"]}です。`}</p>
    {enabled && <>
      <p className="text-sm text-neutral-600">参加直後はマイク・カメラともOFFです。講演・質問の許可後、ご自身で映像内のボタンを押してONにしてください。音声が聞こえない場合は映像内の再生ボタンを押してください。</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={connection === "joining" || state?.closing || busy} onClick={() => void join()} className="rounded-full bg-indigo-700 px-5 py-2 text-sm text-white disabled:opacity-50">{connection === "joining" ? "接続中…" : connection === "open" ? "STAGEに再接続する" : "STAGEに接続する"}</button>
        {connection !== "idle" && <button type="button" onClick={stop} className="rounded-full border px-4 py-2 text-sm">配信から切断する</button>}
        {!control.can_control && state && <button type="button" disabled={busy || !state.room_id || state.closing} onClick={() => void hand()} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">{state.hand_raised ? "質問の希望を取り消す" : "質問を希望する"}</button>}
      </div>
    </>}
    {frame && <iframe key={frame.generation} ref={iframe} title="CPP LIVE STAGE 配信" src={frame.url}
      className="h-[540px] w-full rounded-xl border-0" referrerPolicy="no-referrer" allowFullScreen
      allow={frame.role === "viewer" ? "autoplay; fullscreen" : frame.role === "questioner" ? "microphone; camera; autoplay; fullscreen" : "microphone; camera; autoplay; fullscreen; display-capture"} />}
    {enabled && control.can_control && state && <div className="space-y-3 border-t pt-4">
      <label className="block text-sm">登壇者 <select className="ml-2 max-w-full rounded-lg border p-2" value={target} onChange={e => setTarget(e.target.value)}>
        <option value="">参加者を選択</option>{state.people.filter(p => p.user_id !== userId).map(p => <option key={p.user_id} value={p.user_id}>{p.hand_raised ? "✋ " : ""}{p.display_name}（{labels[p.role]}{p.present === false ? "・退室中" : ""}）</option>)}
      </select></label>
      <div className="flex flex-wrap gap-2">{([ ["presenter", "講演を許可"], ["questioner", "質問を許可"], ["viewer", "登壇を終了"] ] as const).map(([role, label]) => <button key={role} type="button" disabled={!target || busy || state.closing} onClick={() => void grant(role)} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">{label}</button>)}</div>
      <p className="text-xs text-neutral-600">登壇者は司会者のほかに3人まで。許可後は本人の再接続とON操作が必要です。講演者は画面共有も利用できます。司会の引き継ぎ時は全員が再接続します。</p>
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
