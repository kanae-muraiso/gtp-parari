"use client";
// 2026-10-14 JST / PART: Explicit, camera-off Daily connection with a host-directed STAGE.
import { useCallback, useEffect, useRef, useState } from "react";
import type { DailyCall, DailyParticipant, DailyParticipantUpdateOptions } from "@daily-co/daily-js";
import { supabase } from "@/lib/supabaseClient";
import type { ManagedControl } from "@/lib/parari/live/eventControl";
import { stageRequest } from "@/lib/parari/live/stageClient";
import { createStageCall, disposeStageCall } from "@/lib/parari/live/stageMediaClient";
import { StageCamera, type StageBackground } from "@/lib/parari/live/stageCamera";
import { stageLayout, stageRoleLabels, type StageState } from "@/lib/parari/live/stageLayout";
import { StageAudio, StageTile, StageVideo } from "./CppLiveStageTiles";
import CppLiveStageControls, { type StageAction } from "./CppLiveStageControls";
import CppLiveStageBackground from "./CppLiveStageBackground";

export default function CppLiveStageMedia({ control, userId, refresh }: {
  control: ManagedControl; userId: string; refresh: () => Promise<void>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const call = useRef<DailyCall | null>(null);
  const camera = useRef<StageCamera | null>(null);
  const [background, setBackground] = useState<StageBackground>("blur");
  const [backgroundSupported, setBackgroundSupported] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const attempt = useRef(0);
  const reads = useRef(0); const appliedRead = useRef(0);
  const connected = useRef<{ ticketId: string; canSpeak: boolean; role: string } | null>(null);
  const mounted = useRef(true); const actionLock = useRef(false); const joining = useRef(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [state, setState] = useState<StageState | null>(null);
  const [connection, setConnection] = useState<"idle" | "joining" | "open">("idle");
  const [participants, setParticipants] = useState<DailyParticipant[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [target, setTarget] = useState(""); const [page, setPage] = useState(0); const [pageSize, setPageSize] = useState(49);
  const [audioBlocked, setAudioBlocked] = useState(false); const [replay, setReplay] = useState(0);
  const [network, setNetwork] = useState(""); const [screenId, setScreenId] = useState("");
  const stop = useCallback(() => {
    attempt.current++; connected.current = null; joining.current = false;
    camera.current?.close(); camera.current = null;
    const previous = call.current; call.current = null;
    if (previous) disposeStageCall(previous);
    if (mounted.current) { setParticipants([]); setConnection("idle"); setNetwork(""); setCameraBusy(false); }
  }, []);
  const loadState = useCallback(async () => {
    const readId = ++reads.current;
    const { data, error: e } = await supabase!.rpc("cpp_live_stage_state", { p_event_id: control.event_id }).abortSignal(AbortSignal.timeout(12000));
    if (e || !data || !Object.hasOwn(stageRoleLabels, data.role) || !Array.isArray(data.people)
      || typeof data.can_speak !== "boolean" || !["panel", "lecture"].includes(data.display_mode)) throw new Error("登壇状態を確認できません。再接続してください。");
    return { ...data, readId } as StageState & { readId: number };
  }, [control.event_id]);
  const acceptState = useCallback((next: StageState & { readId: number }) => {
    if (next.readId < appliedRead.current) return;
    appliedRead.current = next.readId; setState(next);
    const current = connected.current;
    if (next.closing || (current && (next.ticket_id !== current.ticketId || next.role !== current.role || next.can_speak !== current.canSpeak))) {
      stop(); setError(next.closing ? "STAGEの切り替え中です。司会者の案内をお待ちください。" : "発言権限が変わりました。下のボタンで接続し直してください。");
    }
    camera.current?.setAllowed(next.role !== "host" || next.host_visible);
  }, [stop]);
  useEffect(() => {
    mounted.current = true; setBackground("blur"); let active = true; let loading = false; let available = false;
    const abort = new AbortController();
    async function poll() {
      if (loading) return; loading = true;
      try { const next = await loadState(); if (active) acceptState(next); }
      catch { if (active) { setState(null); stop(); setError("登壇状態を確認できません。接続を確認し、再接続してください。"); } }
      finally { loading = false; }
    }
    void fetch("/api/parari/live/cpp/stage", { cache: "no-store", signal: abort.signal }).then(async r => {
      if (!r.ok) throw new Error(); const data = await r.json();
      if (active) { available = data.enabled === true; setEnabled(available); if (available) await poll(); }
    }).catch(() => { if (active) { setEnabled(false); setError("配信設定を確認できません。会場を開き直してください。"); } });
    const timer = window.setInterval(() => { if (active && available) void poll(); }, 3000);
    const onFocus = () => { if (active && available) void poll(); };
    window.addEventListener("focus", onFocus); window.addEventListener("online", onFocus); window.addEventListener("pagehide", stop);
    const resize = () => setPageSize(window.innerWidth >= 1024 ? 49 : window.innerWidth >= 640 ? 12 : 6);
    resize(); window.addEventListener("resize", resize);
    return () => { active = false; mounted.current = false; abort.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); window.removeEventListener("pagehide", stop);
      window.removeEventListener("resize", resize); stop(); };
  }, [loadState, acceptState, stop, userId]);

  async function join() {
    if (!enabled || joining.current || actionLock.current) return;
    stop(); joining.current = true; const generation = attempt.current; setError(""); setConnection("joining");
    const current = () => mounted.current && generation === attempt.current;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await stageRequest(userId, { action: "join", eventId: control.event_id });
      const url = new URL(result.roomUrl);
      if (url.protocol !== "https:" || !url.hostname.endsWith(".daily.co") || url.username || url.password || url.search || url.hash
        || Date.parse(result.expiresAt) <= Date.now() || !Object.hasOwn(stageRoleLabels, result.role) || typeof result.canSpeak !== "boolean") throw new Error("配信接続を確認できません。");
      const next = await loadState(); if (!current()) return;
      acceptState(next); if (!current()) return;
      if (next.closing || next.ticket_id !== result.ticketId || next.role !== result.role || next.can_speak !== result.canSpeak) throw new Error("登壇権限が変わりました。再接続してください。");
      const { call: sdk, supportsVideoProcessing } = await createStageCall();
      if (!current()) { disposeStageCall(sdk); return; }
      call.current = sdk;
      setBackgroundSupported(supportsVideoProcessing);
      camera.current = new StageCamera(sdk, supportsVideoProcessing,
        value => { if (current()) setCameraBusy(value); }, message => { if (current()) setError(message); });
      camera.current.setAllowed(next.role !== "host" || next.host_visible);
      connected.current = { ticketId: result.ticketId, role: result.role, canSpeak: result.canSpeak };
      const sync = () => { if (current()) setParticipants(Object.values(sdk.participants()));  };
      for (const event of ["participant-joined", "participant-updated", "participant-left", "track-started", "track-stopped"] as const) sdk.on(event, sync);
      sdk.on("left-meeting", () => { if (current()) { stop(); setError("配信から切断されました。役割と接続を確認して再接続してください。"); } });
      sdk.on("error", () => { if (current()) { stop(); setError("映像・音声の接続を続けられません。再接続してください。"); } });
      sdk.on("network-connection", event => { if (current()) setNetwork(event?.event === "interrupted" ? "通信を再接続しています…" : ""); });
      await Promise.race([sdk.join({ url: url.toString(), token: result.token, startAudioOff: true, startVideoOff: true }),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("接続に時間がかかっています。接続し直してください。")), 45000); })]);
      if (!current()) return;
      acceptState(await loadState()); if (!current()) return;
      joining.current = false; setConnection("open"); sync();
    } catch (e) { if (current()) { stop(); setError(e instanceof Error ? e.message : "接続できませんでした。"); } }
    finally { if (timeout) clearTimeout(timeout); }
  }
  async function hand() {
    if (!state || actionLock.current) return; actionLock.current = true; setBusy(true); setError("");
    try {
      const { error: e } = await supabase!.rpc("cpp_live_stage_hand", { p_event_id: control.event_id, p_raised: !state.hand_raised }).abortSignal(AbortSignal.timeout(12000));
      if (e) throw new Error(); const next = await loadState(); if (mounted.current) acceptState(next);
    } catch { if (mounted.current) setError("質問の希望を更新できませんでした。接続後に再試行してください。"); }
    finally { actionLock.current = false; if (mounted.current) setBusy(false); }
  }
  async function act(action: StageAction, targetId?: string, visible?: boolean) {
    if (!state || actionLock.current) return; actionLock.current = true; setBusy(true); setError("");
    try { await stageRequest(userId, { action, eventId: control.event_id, version: state.version, ...(targetId ? { targetId } : {}), ...(visible !== undefined ? { visible } : {}) }); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "登壇操作を完了できませんでした。"); }
    finally {
      // A provider error may follow a committed permission change. Read the new version for retry.
      try { const next = await loadState(); if (mounted.current) acceptState(next); await refresh(); }
      catch { if (mounted.current) { stop(); setState(null); setError("現在の状態を確認できません。会場を開き直してください。"); } }
      actionLock.current = false; if (mounted.current) setBusy(false);
    }
  }
  const layout = state ? stageLayout(state, page, pageSize) : null;
  const byTicket = new Map(participants.map(p => [p.user_id, p]));
  const known = new Map(state?.people.filter(p => p.ticket_id).map(p => [p.ticket_id!, p]));
  const subscriptions = participants.filter(p => !p.local).map(p => {
    const person = known.get(p.user_id); const screens = !!person?.can_speak && ["host", "presenter"].includes(person.role);
    return { id: p.session_id, video: !!layout?.visibleTickets.has(p.user_id), audio: person?.can_speak === true, screens };
  });
  const subscriptionKey = JSON.stringify(subscriptions);
  useEffect(() => {
    if (connection !== "open" || !call.current) return;
    const updates: Record<string, DailyParticipantUpdateOptions> = {};
    for (const p of JSON.parse(subscriptionKey) as typeof subscriptions) updates[p.id] = { setSubscribedTracks: { video: p.video, audio: p.audio, screenAudio: p.screens, screenVideo: p.screens } };
    try { call.current.updateParticipants(updates); }
    catch { stop(); setError("映像の受信設定を確認できません。再接続してください。"); }
  }, [subscriptionKey, connection, stop]);
  const lecturerSession = state?.display_mode === "lecture"
    ? byTicket.get(state.people.find(p => p.user_id === state.lecturer_user_id)?.ticket_id ?? "")?.session_id : undefined;
  useEffect(() => {
    const sdk = call.current; if (!sdk || connection !== "open") return;
    void sdk.updateReceiveSettings({ "*": { video: { layer: 0 } },
      ...(lecturerSession ? { [lecturerSession]: { video: { layer: 2 } } } : {}) }).catch(() => {
      if (mounted.current && call.current === sdk) setError("画質を調整できませんでした。現在の画質で受信を続けます。");
    });
  }, [lecturerSession, connection]);
  const local = participants.find(p => p.local);
  const screenShares = participants.filter(p => { const person = known.get(p.user_id); return person?.can_speak && ["host", "presenter"].includes(person.role) && p.tracks.screenVideo.state === "playable"; });
  const screen = screenShares.find(p => p.session_id === screenId) ?? screenShares[0];
  const onBlocked = useCallback(() => setAudioBlocked(true), []);
  function device(kind: "audio" | "screen") {
    const sdk = call.current; if (!sdk || connection !== "open" || !state) return; setError("");
    try {
      if (kind === "audio" && state.can_speak) sdk.setLocalAudio(!sdk.localAudio());
      if (kind === "screen" && state.can_speak && ["host", "presenter"].includes(state.role)) {
        if (sdk.localScreenVideo()) sdk.stopScreenShare(); else sdk.startScreenShare();
      }
    } catch { setError("機器を操作できません。ブラウザーの許可をご確認ください。"); }
  }
  return <div ref={container} className="mt-6 space-y-4 rounded-xl bg-white p-3 text-neutral-900 sm:p-4" aria-label="STAGE配信">
    <p className="text-sm">{enabled === null ? "配信設定を確認しています…" : !enabled ? "この環境ではSTAGE配信はまだ有効になっていません。" : `あなたは${stageRoleLabels[state?.role ?? "viewer"]}です。`}</p>
    {enabled && <>
      <p className="text-sm text-neutral-600">参加直後はマイク・カメラともOFFです。カメラはご自身でONにできます。発言は司会者の許可後、ご自身でマイクをONにしてください。</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={connection === "joining" || state?.closing || busy} onClick={() => void join()} className="rounded-full bg-indigo-700 px-5 py-2 text-sm text-white disabled:opacity-50">{connection === "joining" ? "接続中…" : connection === "open" ? "STAGEに再接続する" : "STAGEに接続する"}</button>
        {connection !== "idle" && <button type="button" onClick={stop} className="rounded-full border px-4 py-2 text-sm">配信から切断する</button>}
        {!control.can_control && state && <button type="button" disabled={busy || !state.room_id || state.closing} onClick={() => void hand()} className="rounded-full border px-4 py-2 text-sm disabled:opacity-50">{state.hand_raised ? "質問の希望を取り消す" : "質問を希望する"}</button>}
      </div>
      {connection === "open" && <CppLiveStageBackground value={background} supported={backgroundSupported} busy={cameraBusy} local={local} onChange={value => {
        camera.current?.disable(); setBackground(value); setError("");
      }} />}
      {connection === "open" && <div className="flex flex-wrap items-center gap-2" aria-label="自分の機器">
        <button type="button" onClick={() => { setError(""); void camera.current?.toggle(background); }} disabled={cameraBusy || (!backgroundSupported && background !== "none") || (state?.role === "host" && !state.host_visible)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">カメラを{local?.video ? "OFF" : "ON"}</button>
        <button type="button" onClick={() => device("audio")} disabled={!state?.can_speak} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">マイクを{local?.audio ? "OFF" : "ON"}</button>
        {state?.can_speak && ["host", "presenter"].includes(state.role) && <button type="button" onClick={() => device("screen")} className="rounded-lg border px-3 py-2 text-sm">{local?.screen ? "画面共有を終了" : "画面を共有"}</button>}
        {!state?.can_speak && <span className="text-xs text-neutral-600">マイクは司会者の許可後に使用できます。</span>}
      </div>}
      {audioBlocked && <button type="button" className="rounded-lg bg-amber-100 p-3 text-sm" onClick={() => {
        setAudioBlocked(false); container.current?.querySelectorAll("audio").forEach(el => { void el.play().catch(onBlocked); }); setReplay(v => v + 1);
      }}>音声を再生する</button>}
      {network && <p role="status" className="text-sm text-amber-800">{network}</p>}
      {screen && <div className="space-y-2">
        {screenShares.length > 1 && <label className="text-sm">表示する共有画面 <select value={screen.session_id} onChange={e => setScreenId(e.target.value)}>{screenShares.map(p => <option key={p.session_id} value={p.session_id}>{known.get(p.user_id)?.display_name}</option>)}</select></label>}
        <div className="aspect-video max-h-[70vh] bg-black"><StageVideo track={screen.tracks.screenVideo} screen /></div>
      </div>}
      {layout && state && <div className="space-y-3" aria-label="STAGE映像一覧">
        <p className="text-sm font-semibold">{state.display_mode === "panel" ? "パネルディスカッション" : "講演"}</p>
        <div aria-label="登壇者" className={state.display_mode === "panel" ? "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" : "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]"}>
          {layout.onStage.map((person, i) => <StageTile key={person?.user_id ?? `slot-${i}`} person={person} participant={person?.ticket_id ? byTicket.get(person.ticket_id) : undefined}
            selected={target === person?.user_id} onSelect={control.can_control ? setTarget : undefined} placeholder={i === 0 && !state.host_visible ? "司会は音声で参加" : "登壇枠"} />)}
        </div>
        {layout.waitingHands > 0 && <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="質問待ちの案内">
          <span>質問待ち {layout.waitingHands}人 · 挙手した順に1ページ目の先頭から表示</span>
          {layout.page > 0 && <button type="button" className="rounded border px-3 py-1" onClick={() => setPage(0)}>質問待ちの先頭へ</button>}
        </div>}
        <div aria-label="参加者ギャラリー" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {layout.gallery.map(person => <StageTile key={person.user_id} person={person} participant={person.ticket_id ? byTicket.get(person.ticket_id) : undefined} selected={target === person.user_id} onSelect={control.can_control ? setTarget : undefined} />)}
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <button type="button" disabled={layout.page === 0} className="rounded border px-3 py-1 disabled:opacity-40" onClick={() => setPage(layout.page - 1)}>前のページ</button>
          <span>{layout.page + 1} / {layout.pages}ページ · 最大{pageSize}人表示</span>
          <button type="button" disabled={layout.page + 1 >= layout.pages} className="rounded border px-3 py-1 disabled:opacity-40" onClick={() => setPage(layout.page + 1)}>次のページ</button>
        </div>
      </div>}
      {participants.filter(p => !p.local && known.get(p.user_id)?.can_speak).map(p => <div key={p.session_id}>
        <StageAudio track={p.tracks.audio} replay={replay} onBlocked={onBlocked} />
        {["host", "presenter"].includes(known.get(p.user_id)!.role) && <StageAudio track={p.tracks.screenAudio} replay={replay} onBlocked={onBlocked} />}
      </div>)}
    </>}
    {enabled && control.can_control && state && <CppLiveStageControls state={state} target={target} setTarget={setTarget} busy={busy} act={(...args) => void act(...args)} />}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
