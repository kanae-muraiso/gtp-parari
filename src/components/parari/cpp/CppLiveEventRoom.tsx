"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CppLiveModeGate from "@/components/parari/cpp/CppLiveModeGate";

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  can_enter: boolean;
};
type CheckState = "loading" | "allowed" | "denied" | "error";

export default function CppLiveEventRoom({ eventId }: { eventId: string }) {
  const [state, setState] = useState<CheckState>("loading");
  const [eventName, setEventName] = useState("");

  const check = useCallback(async () => {
    if (!supabase) { setState("error"); return; }
    const { data, error } = await supabase.rpc("cpp_live_event_access", { p_event_id: eventId });
    if (error) { setState("error"); return; }
    const event = ((data ?? []) as EventRow[]).find(x => x.id === eventId);
    if (!event?.can_enter) { setState("denied"); return; }
    setEventName(event.title);
    setState("allowed");
  }, [eventId]);

  useEffect(() => {
    void check();
    const interval = window.setInterval(() => void check(), 10000);
    return () => window.clearInterval(interval);
  }, [check]);

  return <main className="min-h-screen bg-neutral-50 pt-16">
    <div className="mx-auto max-w-6xl px-4 py-4">
      <Link href="/my/cpp/live" className="text-sm font-semibold underline">← LIVE開催案内へ戻る</Link>
      {state === "allowed" && <h1 className="mt-4 text-xl font-bold">{eventName} · LIVE会場</h1>}
    </div>
    {state === "loading" ? <p className="mx-auto max-w-6xl px-4 py-8">会場への入室資格を確認しています…</p>
      : state === "error" ? <p role="alert" className="mx-auto max-w-6xl px-4 py-8">開催状況を確認できません。安全のため会場への入室を停止しています。</p>
      : state === "denied" ? <section className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-lg font-bold">この会場は現在入室できません</h2>
        <p className="mt-2 text-sm">開催日時と参加対象をご確認ください。</p>
      </section>
      : <CppLiveModeGate />}
  </main>;
}
