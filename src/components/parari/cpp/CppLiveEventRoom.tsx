"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loginHref } from "@/lib/auth/loginLinks";
import { supabase } from "@/lib/supabaseClient";
import CppLiveUnifiedVenue from "@/components/parari/cpp/CppLiveUnifiedVenue";

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  can_enter: boolean;
};
type CheckState = "loading" | "allowed" | "denied" | "error";

// 2026-10-14 JST / PART: Ask for login before calling the authenticated event gate.
export default function CppLiveEventRoom({ eventId }: { eventId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    const client = supabase;
    if (!client) { setAuthError(true); return; }
    let active = true; let generation = 0;
    const initial = generation;
    void client.auth.getSession().then(({ data, error }) => {
      if (!active || generation !== initial) return;
      if (error) setAuthError(true);
      else setUserId(data.session?.user.id ?? "");
    }).catch(() => { if (active && generation === initial) setAuthError(true); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      generation++; if (!active) return;
      setAuthError(false); setUserId(session?.user.id ?? "");
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <main className="min-h-screen bg-neutral-50 pt-16">
    <div className="mx-auto max-w-6xl px-4 py-4"><Link href="/my/cpp/live" className="text-sm font-semibold underline">← LIVE開催案内へ戻る</Link></div>
    {authError ? <section className="mx-auto max-w-6xl space-y-3 px-4 py-8">
      <p role="alert">ログイン状態を確認できません。通信状態を確認して開き直してください。</p>
      <button type="button" onClick={() => window.location.reload()} className="rounded-xl border px-4 py-3">再読み込みする</button>
    </section> : userId === null ? <p className="p-6">ログイン状態を確認しています…</p>
      : !userId ? <section className="mx-auto max-w-6xl space-y-3 px-4 py-8">
        <h1 className="text-lg font-semibold">LIVEに参加するにはログインが必要です</h1>
        <p className="text-sm leading-6">メールのリンクでログインしたブラウザーから会場を開いてください。このブラウザーで参加する場合は、下のボタンからログインしてください。</p>
        <Link href={loginHref(`/my/cpp/live/room/${encodeURIComponent(eventId)}`)} className="inline-block rounded-xl bg-black px-4 py-3 text-sm text-white">ログインして会場に戻る</Link>
      </section>
      : <AuthenticatedRoom key={`${userId}:${eventId}`} eventId={eventId} />}
  </main>;
}

function AuthenticatedRoom({ eventId }: { eventId: string }) {
  const [state, setState] = useState<CheckState>("loading");
  const [eventName, setEventName] = useState("");
  useEffect(() => {
    let active = true; let checking = false;
    const check = async () => {
      if (checking || !supabase) return;
      checking = true;
      try {
        const { data, error } = await supabase.rpc("cpp_live_event_access", { p_event_id: eventId }).abortSignal(AbortSignal.timeout(8000));
        if (!active) return;
        if (error) { setState("error"); return; }
        const event = ((data ?? []) as EventRow[]).find(x => x.id === eventId);
        if (!event?.can_enter) { setState("denied"); return; }
        setEventName(event.title); setState("allowed");
      } catch { if (active) setState("error"); }
      finally { checking = false; }
    };
    void check();
    const interval = window.setInterval(() => void check(), 10000);
    return () => { active = false; window.clearInterval(interval); };
  }, [eventId]);
  return <>
    <div className="mx-auto max-w-6xl px-4 py-4">
      {state === "allowed" && <h1 className="mt-4 text-xl font-bold">{eventName} · LIVE会場</h1>}
    </div>
    {state === "loading" ? <p className="mx-auto max-w-6xl px-4 py-8">会場への入室資格を確認しています…</p>
      : state === "error" ? <p role="alert" className="mx-auto max-w-6xl px-4 py-8">開催状況を確認できません。安全のため会場への入室を停止しています。</p>
      : state === "denied" ? <section className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="text-lg font-bold">この会場は現在入室できません</h2>
        <p className="mt-2 text-sm">開催日時と参加対象をご確認ください。</p>
      </section>
      : <CppLiveUnifiedVenue eventId={eventId} />}
  </>;
}
