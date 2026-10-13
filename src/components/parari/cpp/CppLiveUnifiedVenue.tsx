"use client";
// src/components/parari/cpp/CppLiveUnifiedVenue.tsx / 2026-10-13 JST
// PART: Existing event PRIVATE TALK with authoritative phase admission.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CppPrivateWorld from "./CppPrivateWorld";
import CppLiveNamecard from "./CppLiveNamecard";

type Person = { user_id: string; display_name: string; photo_url: string | null; live_role: string; is_me: boolean };
type Call = { id: string; requester_id: string; invited_id: string; status: string; created_at: string; ends_at: string | null };
type Chat = { sender_id: string; body: string; created_at: string };
const roleLabels: Record<string, string> = { admin: "管理者", alumni: "同窓会", researcher: "研究者", company: "企業" };
const roleColors: Record<string, string> = { admin: "bg-violet-500", alumni: "bg-emerald-600", researcher: "bg-indigo-600", company: "bg-orange-500" };
export default function CppLiveUnifiedVenue({ eventId, selfId, now, talkAllowed, autoJoin }: {
  eventId: string; selfId: string; now: number; talkAllowed: boolean; autoJoin: boolean;
}) {
  const [joined, setJoined] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [tracked, setTracked] = useState<Call | null>(null);
  const [messages, setMessages] = useState<Chat[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const acting = useRef(false);
  const reading = useRef(false);
  const endedLocally = useRef(new Map<string, string>());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const refresh = useCallback(async () => {
    if (!supabase || reading.current) return;
    reading.current = true;
    try {
      const [r, c] = await Promise.all([
        supabase.rpc("cpp_live_event_roster", { p_event_id: eventId }),
        supabase.rpc("cpp_live_event_my_calls", { p_event_id: eventId }),
      ]);
      if (!alive.current) return;
      if (r.error || c.error) { setError("会場の状態を更新できませんでした。"); return; }
      setPeople(r.data ?? []);
      setCalls(((c.data ?? []) as Call[]).map(call => endedLocally.current.has(call.id)
        ? { ...call, status: "ended", ends_at: endedLocally.current.get(call.id)! } : call));
      const active = ((c.data ?? []) as Call[]).find(x => x.status === "active");
      if (active) {
        const m = await supabase.rpc("cpp_live_event_chat", { p_call_id: active.id });
        if (alive.current && !m.error) setMessages(m.data ?? []);
      } else setMessages([]);
    } catch { if (alive.current) setError("会場の状態を更新できませんでした。"); }
    finally { reading.current = false; }
  }, [eventId]);
  const act = useCallback(async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (acting.current) return false;
    acting.current = true; setBusy(true); setError("");
    try {
      const res = await fn();
      if (!alive.current) return false;
      if (res.error) { setError("操作できませんでした。会話の受付と接続状態をご確認ください。"); return false; }
      await refresh(); return true;
    } catch { if (alive.current) setError("操作に失敗しました。もう一度お試しください。"); return false; }
    finally { acting.current = false; if (alive.current) setBusy(false); }
  }, [refresh]);
  const enter = useCallback(() => act(async () => {
    if (!supabase) return { error: { message: "Unavailable" } };
    const res = await supabase.rpc("cpp_live_event_join", { p_event_id: eventId, p_active: true });
    if (alive.current && !res.error) setJoined(true);
    return res;
  }), [act, eventId]);
  useEffect(() => { if (autoJoin) void enter(); }, [autoJoin, enter]);
  useEffect(() => {
    if (!joined) return;
    const timer = window.setInterval(() => {
      void supabase?.rpc("cpp_live_event_join", { p_event_id: eventId, p_active: true }).then(({ error: e }) => {
        if (alive.current && e) { setJoined(false); setError("イベントが終了したか、参加資格がありません。"); }
      });
      void refresh();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [eventId, joined, refresh]);
  useEffect(() => {
    if (!joined) return;
    const active = calls.find(c => c.status === "active" && c.ends_at && Date.parse(c.ends_at) > now);
    setTracked(previous => previous ? calls.find(c => c.id === previous.id) ?? previous : active ?? null);
  }, [calls, joined, now]);
  const latest = calls.find(c => c.status === "active" && c.ends_at && Date.parse(c.ends_at) > now)
    ?? calls.find(c => c.status === "pending" && Date.parse(c.created_at) + 120000 > now);
  const leave = () => void act(async () => {
    const res = await supabase!.rpc("cpp_live_event_join", { p_event_id: eventId, p_active: false });
    if (alive.current && !res.error) { setJoined(false); setPeople([]); setCalls([]); setTracked(null); }
    return res;
  });
  const errorPanel = error && <p role="alert" className="mx-auto max-w-6xl rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (joined && tracked?.ends_at) {
    const partnerId = tracked.requester_id === selfId ? tracked.invited_id : tracked.requester_id;
    return <>{errorPanel}<CppPrivateWorld key={tracked.id} eventId={eventId} selfId={selfId} callId={tracked.id} partnerId={partnerId}
      partnerName={people.find(p => p.user_id === partnerId)?.display_name ?? "お相手"} endsAt={tracked.ends_at} now={now}
      messages={messages} busy={busy} reviewing={tracked.status !== "active" || Date.parse(tracked.ends_at) <= now}
      onExit={() => void act(async () => {
        const res = await supabase!.rpc("cpp_live_event_end_call", { p_call_id: tracked.id });
        if (!res.error && alive.current) {
          const end = new Date(now).toISOString(); endedLocally.current.set(tracked.id, end);
          setTracked({ ...tracked, status: "ended", ends_at: end });
          setCalls(old => old.map(c => c.id === tracked.id ? { ...c, status: "ended", ends_at: end } : c));
        }
        return res;
      })}
      onReturn={() => { setTracked(null); setMessages([]); }}
      sendMessage={text => act(() => supabase!.rpc("cpp_live_event_send", { p_call_id: tracked.id, p_body: text }))} /></>;
  }
  return <section className="mx-auto max-w-6xl space-y-5 px-4 pb-8" aria-label="LOUNGE">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
      <div><h2 className="font-bold">CPP LIVE 会場</h2><p className="text-sm text-neutral-500">研究者・企業・同窓会・管理者が同じ会場で交流します。</p></div>
      {joined ? <button className="rounded-full border px-5 py-2 text-sm font-bold" disabled={busy} onClick={leave}>会場から退出</button>
        : <button className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-bold text-white" disabled={busy} onClick={() => void enter()}>会場に入る</button>}
    </div>
    {errorPanel}
    {joined && <>
      <div className="rounded-xl border bg-white p-5"><h2 className="font-bold">今ここにいる人（{people.length}人）</h2>
        <div className="mt-4 flex flex-wrap gap-4">{people.map(p => <div key={p.user_id} className="w-32 space-y-2 text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-white ${roleColors[p.live_role] ?? "bg-gray-500"}`}>{p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : p.display_name.slice(0, 1)}</div>
          <p className="break-words text-sm font-semibold">{p.display_name}{p.is_me ? "（自分）" : ""}</p><p className="text-xs text-neutral-500">{roleLabels[p.live_role] ?? p.live_role}</p>
          {!p.is_me && <CppLiveNamecard eventId={eventId} userId={p.user_id} />}
          {!p.is_me && !latest && <button disabled={busy || !talkAllowed} className="rounded-full border px-3 py-1 text-xs disabled:opacity-40" onClick={() => { if (talkAllowed) void act(() => supabase!.rpc("cpp_live_event_request", { p_event_id: eventId, p_target_id: p.user_id })); }}>10分会話を申し込む</button>}
        </div>)}</div>
      </div>
      {latest?.status === "pending" && <div className="space-y-3 rounded-xl border bg-white p-5">{latest.invited_id === selfId ? <>
        <h3 className="font-bold">会話の申し込みがあります</h3><CppLiveNamecard eventId={eventId} userId={latest.requester_id} label="申し込んだ方の名札を見る" />
        <div className="flex gap-2"><button disabled={busy || !talkAllowed} className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-40" onClick={() => { if (talkAllowed) void act(() => supabase!.rpc("cpp_live_event_respond", { p_call_id: latest.id, p_accept: true })); }}>承諾する</button>
          <button disabled={busy} className="rounded-full border px-4 py-2 text-sm" onClick={() => void act(() => supabase!.rpc("cpp_live_event_respond", { p_call_id: latest.id, p_accept: false }))}>辞退する</button></div>
      </> : <p className="text-sm">相手の承諾を待っています（申し込みの有効期限は2分）。</p>}</div>}
    </>}
    <Link href="/my/cpp/live" className="inline-block text-sm underline">← 開催案内へ戻る</Link>
  </section>;
}
