"use client";
// src/components/parari/cpp/CppLiveNote.tsx / 2026-10-13 JST
// PART: Private note editor and recoverable drafts independent of venue/media mount.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabaseClient";
import { noteDraftStore } from "@/lib/parari/live/noteDrafts";

export function CppLiveNote({ userId, eventId, callId, partnerName, onReturn }: {
  userId: string; eventId: string; callId: string; partnerName: string; onReturn?: () => void;
}) {
  const store = useMemo(() => noteDraftStore(userId, eventId), [userId, eventId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [saved, setSaved] = useState<{ starred: boolean; memo: string } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const draft = snapshot.drafts[callId];
  const current = draft ?? snapshot.confirmed[callId] ?? saved;
  useEffect(() => {
    let active = true;
    if (!supabase) return;
    setLoadError("");
    const local = store.getSnapshot().drafts[callId];
    if (local) { setSaved({ starred: local.starred, memo: local.memo }); return; }
    const expected = store.getSnapshot().confirmed[callId];
    void supabase.rpc("cpp_live_note_get", { p_call_id: callId }).then(({ data, error }) => {
      if (!active) return;
      if (error) { setLoadError("記録を読み込めませんでした。"); return; }
      const note = (data ?? [])[0] ?? { starred: false, memo: "" };
      store.acceptSaved(callId, note, expected); setSaved(note);
    });
    return () => { active = false; };
  }, [callId, userId, attempt, store]);
  function edit(starred: boolean, memo: string) { store.edit({ callId, partnerName, starred, memo }); }
  async function save(returnAfter = false) {
    if (!supabase || !current) return;
    const captured = { starred: current.starred, memo: current.memo };
    const ok = await store.save(supabase, userId, callId);
    if (ok) { setSaved(captured); if (returnAfter) onReturn?.(); }
  }
  const busy = snapshot.busy[callId] === true;
  return <section className="space-y-3 rounded-xl border bg-neutral-50 p-4" aria-label="自分だけの会話記録">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-sm font-semibold">この出会いを記録</p><p className="text-xs text-neutral-500">相手には通知されません。後から変更できます。</p></div>
      <button type="button" aria-pressed={current?.starred ?? false} disabled={!current || busy}
        onClick={() => { if (current) { edit(!current.starred, current.memo); void saveStar(); } }}
        className="rounded-full border bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">{current?.starred ? "★ 気になる" : "☆ 気になる"}</button>
    </div>
    <label className="block text-sm">自分だけのメモ
      <textarea aria-label="自分だけのメモ" value={current?.memo ?? ""} disabled={!current}
        onChange={e => { if (current) edit(current.starred, e.target.value); }} maxLength={2000} rows={3}
        placeholder="話題、次に聞きたいことなど（相手には見えません）" className="mt-2 w-full rounded-lg border bg-white p-2" />
    </label>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!current || busy} onClick={() => void save()} className="rounded-full border bg-white px-4 py-2 text-sm disabled:opacity-50">{busy ? "保存中…" : "メモを保存"}</button>
      {onReturn && <button type="button" disabled={!current || busy} onClick={() => void save(true)} className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">LIVE会場に戻る</button>}
    </div>
    {draft && <p className="text-xs text-neutral-600">未保存の下書きがあります。</p>}
    {loadError && <p role="alert" className="text-xs text-red-700">{loadError} <button type="button" className="underline" onClick={() => setAttempt(n => n + 1)}>読み込み直す</button></p>}
    {snapshot.error && <p role="alert" className="text-xs text-red-700">{snapshot.error}</p>}
    {!snapshot.durable && <p role="alert" className="text-xs text-amber-800">下書きはこの画面内で保持しています。ページを閉じる前に保存してください。</p>}
  </section>;
  async function saveStar() {
    if (!supabase) return;
    const captured = store.getSnapshot().drafts[callId];
    if (captured && await store.save(supabase, userId, callId)) setSaved({ starred: captured.starred, memo: captured.memo });
  }
}

export function CppLivePendingNotes({ userId, eventId, autoSave }: { userId: string; eventId: string; autoSave: boolean }) {
  const store = useMemo(() => noteDraftStore(userId, eventId), [userId, eventId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (autoSave && supabase) for (const callId of Object.keys(store.getSnapshot().drafts)) void store.save(supabase, userId, callId);
    // One attempt on a STAGE/exit transition; failures stay available for explicit retry.
  }, [autoSave, store, userId]);
  const drafts = Object.values(snapshot.drafts);
  const hasDrafts = drafts.length > 0;
  useEffect(() => {
    if (!hasDrafts) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDrafts]);
  if (!drafts.length) return null;
  return <aside className="mx-auto mt-5 max-w-6xl space-y-3 px-4 pb-6" aria-label="保存待ちの会話メモ">
    <p className="text-sm font-semibold">保存待ちの会話メモ（{drafts.length}件）</p>
    <p className="text-xs text-neutral-600">画面が切り替わっても下書きはこのタブに残ります。タブを閉じる前に保存してください。</p>
    {snapshot.error && <p role="alert" className="text-sm text-red-700">{snapshot.error}</p>}
    {!snapshot.durable && <p role="alert" className="text-sm text-amber-800">下書きはこの画面内で保持しています。再読み込みやタブを閉じる前に保存してください。</p>}
    {drafts.map(draft => <div key={draft.callId} className="space-y-2 rounded-xl border bg-white p-3">
      <button type="button" className="text-sm underline" aria-expanded={open === draft.callId} onClick={() => setOpen(open === draft.callId ? null : draft.callId)}>{draft.partnerName}さんとのメモを確認</button>
      <button type="button" className="ml-3 rounded-full border px-3 py-1 text-sm disabled:opacity-50" disabled={snapshot.busy[draft.callId]} onClick={() => { if (supabase) void store.save(supabase, userId, draft.callId); }}>再度保存する</button>
      {open === draft.callId && <CppLiveNote userId={userId} eventId={eventId} callId={draft.callId} partnerName={draft.partnerName} />}
    </div>)}
  </aside>;
}
