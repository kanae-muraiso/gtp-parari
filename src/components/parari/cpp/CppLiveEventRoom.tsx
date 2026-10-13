"use client";
// src/components/parari/cpp/CppLiveEventRoom.tsx / 2026-10-13 JST
// PART: Auth-scoped event shell; STAGE always takes precedence over private review.
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCppLiveControl } from "@/lib/parari/live/useCppLiveControl";
import { canInvite, isStage } from "@/lib/parari/live/eventControl";
import { clearLiveNoteDrafts } from "@/lib/parari/live/noteDrafts";
import CppLiveUnifiedVenue from "./CppLiveUnifiedVenue";
import CppLiveStage from "./CppLiveStage";
import CppLiveHostPanel from "./CppLiveHostPanel";
import { CppLivePendingNotes } from "./CppLiveNote";

export default function CppLiveEventRoom({ eventId }: { eventId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) { setUserId(""); return; }
    let disposed = false; let generation = 0; let current = "";
    function accept(id: string) {
      if (disposed) return;
      if (current && current !== id) clearLiveNoteDrafts(current);
      current = id; setUserId(id);
    }
    const initial = generation;
    void supabase.auth.getUser().then(({ data }) => { if (initial === generation) accept(data.user?.id ?? ""); }).catch(() => { if (initial === generation) accept(""); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      generation += 1; accept(session?.user.id ?? "");
    });
    return () => { disposed = true; subscription.unsubscribe(); };
  }, []);
  return <main className="min-h-screen bg-neutral-50 pt-16">
    <div className="mx-auto max-w-6xl px-4 py-4"><Link href="/my/cpp/live" className="text-sm font-semibold underline">← LIVE開催案内へ戻る</Link></div>
    {userId === null ? <p className="p-6">ログイン状態を確認しています…</p>
      : !userId ? <p className="p-6">ログインしてから会場を開いてください。</p>
      : <EventSession key={`${userId}:${eventId}`} userId={userId} eventId={eventId} />}
  </main>;
}
function EventSession({ userId, eventId }: { userId: string; eventId: string }) {
  const { event, control, status, now, refresh } = useCppLiveControl(eventId, userId);
  const expired = !!event && now >= Date.parse(event.ends_at);
  const allowed = !!event?.can_enter && !expired;
  const managed = control?.managed ? control : null;
  const phase = expired && managed ? "ended" : managed?.effective_phase;
  const stage = !!phase && (isStage(phase) || phase === "waiting" || phase === "ended");
  const showVenue = status === "ready" && allowed && !!control && !stage;
  // Opening/closing attendees remain present without constructing any media client.
  useEffect(() => {
    if (!allowed || status !== "ready" || !stage || phase === "ended" || !supabase) return;
    const attend = () => { void supabase?.rpc("cpp_live_event_join", { p_event_id: eventId, p_active: true }); };
    attend(); const timer = window.setInterval(attend, 10000);
    return () => window.clearInterval(timer);
  }, [eventId, allowed, status, stage, phase]);
  return <>
    {event && <h1 className="mx-auto mb-5 max-w-6xl px-4 text-xl font-bold">{event.title} · LIVE会場</h1>}
    {status === "loading" && <p className="mx-auto max-w-6xl px-4 py-8">会場への入室資格と進行を確認しています…</p>}
    {status === "error" && <div role="alert" className="mx-auto mb-5 max-w-6xl space-y-3 px-4"><p>進行を確認できません。接続が戻るまで新しい操作を停止しています。</p><button type="button" className="rounded-full border px-4 py-2" onClick={() => void refresh()}>再接続する</button></div>}
    {managed && <CppLiveHostPanel control={managed} userId={userId} now={now} synced={status === "ready" && allowed} refresh={refresh} />}
    {stage && managed && <CppLiveStage control={phase === "ended" ? { ...managed, effective_phase: "ended" } : managed} now={now} />}
    {status === "ready" && !allowed && !stage && <section className="mx-auto max-w-6xl px-4 py-8"><h2 className="text-lg font-bold">この会場は現在入室できません</h2><p className="mt-2 text-sm">開催日時と参加対象をご確認ください。</p></section>}
    {showVenue && <>
      {managed && <div className="mx-auto mb-4 max-w-6xl px-4"><p className="rounded-xl border bg-white p-4 text-sm" role="status">
        {canInvite(control, now, true) ? "LOUNGE · 自由に10分間の会話をお楽しみください。" : "新しい会話の受付は終了しました。進行中の会話は終了時刻まで続けられます。"}
        {managed.closing_target_at && <span className="ml-2">クロージング予定：{new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(managed.closing_target_at))}</span>}
      </p></div>}
      <CppLiveUnifiedVenue eventId={eventId} selfId={userId} now={now} talkAllowed={canInvite(control, now, status === "ready")} autoJoin={!!managed} />
    </>}
    <CppLivePendingNotes userId={userId} eventId={eventId} autoSave={stage || status === "error" || (status === "ready" && !allowed)} />
  </>;
}
